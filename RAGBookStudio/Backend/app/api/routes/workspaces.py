"""Workspace management endpoints."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

# Simple file-based workspace store (replaceable by DB repository later)
STORAGE_ROOT = Path(__file__).resolve().parents[4] / "Storage" / "workspaces"
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)


class WorkspaceCreate(BaseModel):
    name: str
    description: str = ""


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


def _ws_path(ws_id: str) -> Path:
    return STORAGE_ROOT / ws_id


def _load_meta(ws_id: str) -> Dict[str, Any]:
    meta_file = _ws_path(ws_id) / "workspace.json"
    if not meta_file.exists():
        raise FileNotFoundError(ws_id)
    return json.loads(meta_file.read_text(encoding="utf-8"))


def _save_meta(ws_id: str, data: Dict[str, Any]) -> None:
    path = _ws_path(ws_id)
    path.mkdir(parents=True, exist_ok=True)
    (path / "workspace.json").write_text(json.dumps(data, indent=2), encoding="utf-8")


@router.get("/")
async def list_workspaces():
    results = []
    for d in STORAGE_ROOT.iterdir():
        if d.is_dir() and (d / "workspace.json").exists():
            try:
                meta = json.loads((d / "workspace.json").read_text(encoding="utf-8"))
                results.append(meta)
            except Exception:
                continue
    results.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return results


@router.post("/")
async def create_workspace(body: WorkspaceCreate):
    ws_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    meta = {
        "id": ws_id,
        "name": body.name,
        "description": body.description,
        "created_at": now,
        "updated_at": now,
        "books": [],
        "chats": [],
        "settings": {},
    }
    _save_meta(ws_id, meta)
    # Subdirs
    for sub in ("books", "chats", "notes", "embeddings", "vectors"):
        (_ws_path(ws_id) / sub).mkdir(exist_ok=True)
    return meta


@router.get("/{ws_id}")
async def get_workspace(ws_id: str):
    try:
        return _load_meta(ws_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Workspace not found")


@router.patch("/{ws_id}")
async def update_workspace(ws_id: str, body: WorkspaceUpdate):
    try:
        meta = _load_meta(ws_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if body.name is not None:
        meta["name"] = body.name
    if body.description is not None:
        meta["description"] = body.description
    if body.settings is not None:
        meta["settings"] = {**meta.get("settings", {}), **body.settings}
    meta["updated_at"] = datetime.utcnow().isoformat() + "Z"
    _save_meta(ws_id, meta)
    return meta


@router.delete("/{ws_id}")
async def delete_workspace(ws_id: str):
    path = _ws_path(ws_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Workspace not found")
    import shutil
    shutil.rmtree(path)
    return {"status": "deleted", "id": ws_id}
