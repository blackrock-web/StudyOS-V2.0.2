"""Analytics dashboard data."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter

from Core.device.manager import get_device_manager
from Core.registry.model_registry import get_model_registry
from Workers.task_queue import get_task_queue

router = APIRouter()

STORAGE_ROOT = Path(__file__).resolve().parents[4] / "Storage" / "workspaces"
STORAGE_BASE = Path(__file__).resolve().parents[4] / "Storage"


def _dir_size(path: Path) -> int:
    total = 0
    if not path.exists():
        return 0
    for f in path.rglob("*"):
        if f.is_file():
            try:
                total += f.stat().st_size
            except OSError:
                pass
    return total


@router.get("/overview")
async def overview():
    workspaces = []
    total_books = 0
    total_chunks = 0
    indexed = 0
    pending = 0
    errors = 0

    if STORAGE_ROOT.exists():
        for ws_dir in STORAGE_ROOT.iterdir():
            if not ws_dir.is_dir():
                continue
            books_dir = ws_dir / "books"
            book_count = 0
            chunk_count = 0
            if books_dir.exists():
                for f in books_dir.glob("*.json"):
                    if f.name.endswith(".chunks.json"):
                        continue
                    book_count += 1
                    try:
                        meta = json.loads(f.read_text(encoding="utf-8"))
                        total_books += 1
                        cc = meta.get("chunk_count", 0) or 0
                        chunk_count += cc
                        total_chunks += cc
                        st = meta.get("status", "parsed")
                        if st == "indexed":
                            indexed += 1
                        elif st == "indexing":
                            pending += 1
                        elif st == "error":
                            errors += 1
                    except Exception:
                        pass
            workspaces.append({
                "id": ws_dir.name,
                "books": book_count,
                "chunks": chunk_count,
            })

    dm = get_device_manager()
    device = dm.get_display_info()
    registry = get_model_registry()
    models = registry.list_models()
    enabled_models = [m for m in models if m.enabled]

    storage_bytes = _dir_size(STORAGE_BASE)
    queue = get_task_queue()
    active_tasks = queue.list(status="running", limit=20) + queue.list(status="pending", limit=20)

    return {
        "workspaces": len(workspaces),
        "total_books": total_books,
        "total_chunks": total_chunks,
        "indexed": indexed,
        "pending_index": pending,
        "errors": errors,
        "storage_bytes": storage_bytes,
        "storage_mb": round(storage_bytes / (1024 * 1024), 2),
        "device": device,
        "models_total": len(models),
        "models_enabled": len(enabled_models),
        "active_tasks": len(active_tasks),
        "workspace_breakdown": workspaces,
    }


@router.get("/activity")
async def recent_activity(limit: int = 20):
    """Recent indexing tasks + book uploads."""
    queue = get_task_queue()
    tasks = queue.list(limit=limit)
    activity = []
    for t in tasks:
        activity.append({
            "type": "task",
            "id": t.id,
            "name": t.name,
            "status": t.status.value,
            "workspace_id": t.workspace_id,
            "file_id": t.file_id,
            "created_at": t.created_at,
            "progress": t.progress.percent,
        })

    # Recent books
    if STORAGE_ROOT.exists():
        books = []
        for ws_dir in STORAGE_ROOT.iterdir():
            books_dir = ws_dir / "books"
            if not books_dir.exists():
                continue
            for f in books_dir.glob("*.json"):
                if f.name.endswith(".chunks.json"):
                    continue
                try:
                    meta = json.loads(f.read_text(encoding="utf-8"))
                    books.append({
                        "type": "book",
                        "id": meta.get("file_id"),
                        "name": meta.get("title") or meta.get("original_name"),
                        "status": meta.get("status"),
                        "workspace_id": ws_dir.name,
                        "created_at": meta.get("uploaded_at"),
                    })
                except Exception:
                    pass
        books.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        activity.extend(books[:limit])

    activity.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return activity[:limit]
