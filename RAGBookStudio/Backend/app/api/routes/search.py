"""Global search across books, chats, chunks, notes."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()

STORAGE_ROOT = Path(__file__).resolve().parents[4] / "Storage" / "workspaces"


class SearchResultItem(BaseModel):
    type: str  # book | chunk | chat | note
    id: str
    title: str
    snippet: str
    score: float = 0.0
    metadata: Dict[str, Any] = {}


@router.get("/")
async def global_search(
    q: str = Query(..., min_length=1),
    workspace_id: Optional[str] = None,
    types: Optional[str] = None,  # comma-separated
    limit: int = 20,
):
    """
    Keyword search across workspace content.
    Semantic search is available via the chat / retrieval endpoint.
    """
    query = q.lower()
    wanted = set(types.split(",")) if types else {"book", "chunk", "chat", "note"}
    results: List[Dict[str, Any]] = []

    workspaces = [STORAGE_ROOT / workspace_id] if workspace_id else list(STORAGE_ROOT.iterdir())

    for ws in workspaces:
        if not ws.is_dir():
            continue
        ws_id = ws.name

        # Books
        if "book" in wanted:
            books_dir = ws / "books"
            if books_dir.exists():
                for f in books_dir.glob("*.json"):
                    if f.name.endswith(".chunks.json"):
                        continue
                    try:
                        meta = json.loads(f.read_text(encoding="utf-8"))
                        title = (meta.get("title") or meta.get("original_name") or "").lower()
                        if query in title:
                            results.append(
                                {
                                    "type": "book",
                                    "id": meta.get("file_id", f.stem),
                                    "title": meta.get("title") or meta.get("original_name"),
                                    "snippet": f"{meta.get('page_count', '?')} pages",
                                    "score": 1.0,
                                    "metadata": {"workspace_id": ws_id},
                                }
                            )
                    except Exception:
                        continue

        # Chunks
        if "chunk" in wanted:
            books_dir = ws / "books"
            if books_dir.exists():
                for f in books_dir.glob("*.chunks.json"):
                    try:
                        chunks = json.loads(f.read_text(encoding="utf-8"))
                        for c in chunks:
                            text = (c.get("text") or "").lower()
                            if query in text:
                                results.append(
                                    {
                                        "type": "chunk",
                                        "id": c.get("id", ""),
                                        "title": f"Page {c.get('page', '?')}",
                                        "snippet": c.get("text", "")[:200],
                                        "score": 0.8,
                                        "metadata": {
                                            "workspace_id": ws_id,
                                            "page": c.get("page"),
                                            "file_id": f.stem.replace(".chunks", ""),
                                        },
                                    }
                                )
                    except Exception:
                        continue

        # Chats
        if "chat" in wanted:
            chats_dir = ws / "chats"
            if chats_dir.exists():
                for f in chats_dir.glob("*.json"):
                    try:
                        history = json.loads(f.read_text(encoding="utf-8"))
                        for turn in history:
                            content = (turn.get("content") or "").lower()
                            if query in content:
                                results.append(
                                    {
                                        "type": "chat",
                                        "id": f.stem,
                                        "title": f"Chat {f.stem[:8]}",
                                        "snippet": turn.get("content", "")[:200],
                                        "score": 0.7,
                                        "metadata": {"workspace_id": ws_id, "role": turn.get("role")},
                                    }
                                )
                                break
                    except Exception:
                        continue

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]
