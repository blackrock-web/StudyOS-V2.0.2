"""Application settings endpoints."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

SETTINGS_FILE = Path(__file__).resolve().parents[4] / "Storage" / "settings.json"
SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)

DEFAULTS: Dict[str, Any] = {
    "theme": "light",
    "language": "en",
    "device_preference": "auto",
    "default_embedding_model": None,
    "default_llm_model": None,
    "default_ocr_provider": None,
    "default_vector_db": "faiss",
    "chunk_strategy": "paragraph",
    "chunk_size": 512,
    "chunk_overlap": 64,
    "top_k": 5,
    "temperature": 0.7,
}


def _load() -> Dict[str, Any]:
    if SETTINGS_FILE.exists():
        try:
            data = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
            return {**DEFAULTS, **data}
        except Exception:
            pass
    return dict(DEFAULTS)


def _save(data: Dict[str, Any]) -> None:
    SETTINGS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


class SettingsUpdate(BaseModel):
    theme: Optional[str] = None
    language: Optional[str] = None
    device_preference: Optional[str] = None
    default_embedding_model: Optional[str] = None
    default_llm_model: Optional[str] = None
    default_ocr_provider: Optional[str] = None
    default_vector_db: Optional[str] = None
    chunk_strategy: Optional[str] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    top_k: Optional[int] = None
    temperature: Optional[float] = None


@router.get("/")
async def get_settings():
    return _load()


@router.patch("/")
async def update_settings(body: SettingsUpdate):
    current = _load()
    updates = body.model_dump(exclude_none=True)
    current.update(updates)
    _save(current)

    # Apply device preference immediately
    if "device_preference" in updates:
        from Core.device.manager import get_device_manager
        dm = get_device_manager()
        dm.set_preference(updates["device_preference"])
        dm.refresh()

    return current
