"""
In-process background task queue with pause/resume/cancel.
Designed to be swap-compatible with Celery/ARQ later via the same Task interface.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class TaskProgress:
    current: int = 0
    total: int = 0
    message: str = ""
    percent: float = 0.0


@dataclass
class Task:
    id: str
    name: str
    type: str  # index | reindex | ocr | embed | export
    status: TaskStatus = TaskStatus.PENDING
    progress: TaskProgress = field(default_factory=TaskProgress)
    workspace_id: Optional[str] = None
    file_id: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    meta: Dict[str, Any] = field(default_factory=dict)

    # Internal control flags (not serialized)
    _pause_event: threading.Event = field(default_factory=threading.Event, repr=False)
    _cancel_flag: threading.Event = field(default_factory=threading.Event, repr=False)

    def __post_init__(self):
        self._pause_event.set()  # not paused by default

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "status": self.status.value,
            "progress": {
                "current": self.progress.current,
                "total": self.progress.total,
                "message": self.progress.message,
                "percent": self.progress.percent,
            },
            "workspace_id": self.workspace_id,
            "file_id": self.file_id,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "error": self.error,
            "result": self.result,
            "meta": self.meta,
        }


class TaskQueue:
    """
    Thread-pool based queue.
    Workers call task._pause_event.wait() to respect pause,
    and check task._cancel_flag.is_set() to abort.
    """

    _instance: Optional["TaskQueue"] = None

    def __new__(cls) -> "TaskQueue":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, max_workers: int = 2):
        if self._initialized:
            return
        self._tasks: Dict[str, Task] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="ragbook-worker")
        self._handlers: Dict[str, Callable] = {}
        self._initialized = True
        logger.info("TaskQueue initialized with %d workers", max_workers)

    def register_handler(self, task_type: str, handler: Callable) -> None:
        self._handlers[task_type] = handler

    def submit(
        self,
        name: str,
        task_type: str,
        workspace_id: Optional[str] = None,
        file_id: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> Task:
        task = Task(
            id=str(uuid.uuid4()),
            name=name,
            type=task_type,
            workspace_id=workspace_id,
            file_id=file_id,
            meta=meta or {},
        )
        with self._lock:
            self._tasks[task.id] = task
        self._executor.submit(self._run, task)
        logger.info("Submitted task %s (%s)", task.id, task_type)
        return task

    def _run(self, task: Task) -> None:
        handler = self._handlers.get(task.type)
        if not handler:
            task.status = TaskStatus.FAILED
            task.error = f"No handler for task type: {task.type}"
            task.finished_at = datetime.utcnow().isoformat() + "Z"
            return

        task.status = TaskStatus.RUNNING
        task.started_at = datetime.utcnow().isoformat() + "Z"
        try:
            result = handler(task)
            if task._cancel_flag.is_set():
                task.status = TaskStatus.CANCELLED
            else:
                task.status = TaskStatus.COMPLETED
                task.result = result if isinstance(result, dict) else {"data": result}
                task.progress.percent = 100.0
                task.progress.message = "Done"
        except Exception as e:
            logger.exception("Task %s failed", task.id)
            task.status = TaskStatus.FAILED
            task.error = str(e)
        finally:
            task.finished_at = datetime.utcnow().isoformat() + "Z"

    def get(self, task_id: str) -> Optional[Task]:
        return self._tasks.get(task_id)

    def list(
        self,
        workspace_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[Task]:
        tasks = list(self._tasks.values())
        if workspace_id:
            tasks = [t for t in tasks if t.workspace_id == workspace_id]
        if status:
            tasks = [t for t in tasks if t.status.value == status]
        tasks.sort(key=lambda t: t.created_at, reverse=True)
        return tasks[:limit]

    def pause(self, task_id: str) -> bool:
        task = self._tasks.get(task_id)
        if not task or task.status != TaskStatus.RUNNING:
            return False
        task._pause_event.clear()
        task.status = TaskStatus.PAUSED
        return True

    def resume(self, task_id: str) -> bool:
        task = self._tasks.get(task_id)
        if not task or task.status != TaskStatus.PAUSED:
            return False
        task._pause_event.set()
        task.status = TaskStatus.RUNNING
        return True

    def cancel(self, task_id: str) -> bool:
        task = self._tasks.get(task_id)
        if not task or task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            return False
        task._cancel_flag.set()
        task._pause_event.set()  # unblock if paused
        if task.status == TaskStatus.PENDING:
            task.status = TaskStatus.CANCELLED
            task.finished_at = datetime.utcnow().isoformat() + "Z"
        return True

    def update_progress(self, task: Task, current: int, total: int, message: str = "") -> None:
        # Respect pause
        task._pause_event.wait()
        if task._cancel_flag.is_set():
            raise InterruptedError("Task cancelled")
        task.progress.current = current
        task.progress.total = total
        task.progress.message = message
        task.progress.percent = round(100.0 * current / total, 1) if total > 0 else 0.0


def get_task_queue() -> TaskQueue:
    return TaskQueue()
