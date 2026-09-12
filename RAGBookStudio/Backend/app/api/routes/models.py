"""Model registry endpoints."""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from Core.registry.model_registry import get_model_registry

router = APIRouter()


class ModelAction(BaseModel):
    type: str
    name: str


@router.get("/")
async def list_models(type: Optional[str] = None, enabled_only: bool = False):
    registry = get_model_registry()
    models = registry.list_models(model_type=type, enabled_only=enabled_only)
    return [
        {
            "name": m.name,
            "type": m.type,
            "version": m.version,
            "provider": m.provider,
            "device_support": m.device_support,
            "dimension": m.dimension,
            "parameters": m.parameters,
            "description": m.description,
            "enabled": m.enabled,
            "path": m.path,
            "ready": m.extra.get("ready", True),
            "using_custom_weights": m.extra.get("using_custom_weights", False),
        }
        for m in models
    ]


@router.post("/enable")
async def enable_model(body: ModelAction):
    registry = get_model_registry()
    try:
        registry.enable(body.type, body.name)
        return {"status": "enabled", "type": body.type, "name": body.name}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/disable")
async def disable_model(body: ModelAction):
    registry = get_model_registry()
    try:
        registry.disable(body.type, body.name)
        return {"status": "disabled", "type": body.type, "name": body.name}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/discover")
async def rediscover():
    registry = get_model_registry()
    models = registry.discover()
    return {"count": len(models), "models": [m.name for m in models]}


@router.get("/{model_type}/{name}")
async def get_model(model_type: str, name: str):
    registry = get_model_registry()
    meta = registry.get_metadata(model_type, name)
    if not meta:
        raise HTTPException(status_code=404, detail="Model not found")
    return {
        "name": meta.name,
        "type": meta.type,
        "version": meta.version,
        "provider": meta.provider,
        "device_support": meta.device_support,
        "dimension": meta.dimension,
        "parameters": meta.parameters,
        "description": meta.description,
        "enabled": meta.enabled,
        "path": meta.path,
        "extra": meta.extra,
    }
