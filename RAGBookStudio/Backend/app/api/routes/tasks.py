"""Background task queue endpoints – pause/resume/cancel/progress."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from Workers.task_queue import get_task_queue

router = APIRouter()


class IndexTaskBody(BaseModel):
    workspace_id: str
    file_id: str
    strategy: str = "paragraph"
    chunk_size: int = 512
    chunk_overlap: int = 64
    embedding_model: Optional[str] = None
    ocr_provider: Optional[str] = None


@router.get("/")
async def list_tasks(
    workspace_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
):
    queue = get_task_queue()
    tasks = queue.list(workspace_id=workspace_id, status=status, limit=limit)
    return [t.to_dict() for t in tasks]


@router.get("/{task_id}")
async def get_task(task_id: str):
    queue = get_task_queue()
    task = queue.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task.to_dict()


@router.post("/index")
async def submit_index(body: IndexTaskBody):
    queue = get_task_queue()
    task = queue.submit(
        name=f"Index {body.file_id[:8]}",
        task_type="index",
        workspace_id=body.workspace_id,
        file_id=body.file_id,
        meta={
            "strategy": body.strategy,
            "chunk_size": body.chunk_size,
            "chunk_overlap": body.chunk_overlap,
            "embedding_model": body.embedding_model,
            "ocr_provider": body.ocr_provider,
        },
    )
    return task.to_dict()


@router.post("/{task_id}/pause")
async def pause_task(task_id: str):
    queue = get_task_queue()
    if not queue.pause(task_id):
        raise HTTPException(status_code=400, detail="Cannot pause task")
    return queue.get(task_id).to_dict()


@router.post("/{task_id}/resume")
async def resume_task(task_id: str):
    queue = get_task_queue()
    if not queue.resume(task_id):
        raise HTTPException(status_code=400, detail="Cannot resume task")
    return queue.get(task_id).to_dict()


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str):
    queue = get_task_queue()
    if not queue.cancel(task_id):
        raise HTTPException(status_code=400, detail="Cannot cancel task")
    return queue.get(task_id).to_dict()
