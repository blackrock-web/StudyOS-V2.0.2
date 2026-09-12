"""Plugin manager endpoints."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from Core.registry.model_registry import get_model_registry

router = APIRouter()

PLUGINS_ROOT = Path(__file__).resolve().parents[4] / "Plugins"


@router.get("/")
async def list_plugins():
    plugins = []
    if not PLUGINS_ROOT.exists():
        return plugins
    for d in PLUGINS_ROOT.iterdir():
        if not d.is_dir() or d.name.startswith("_"):
            continue
        info: Dict[str, Any] = {
            "name": d.name,
            "path": str(d),
            "has_init": (d / "__init__.py").exists(),
            "enabled": True,
            "description": "",
            "version": "0.0.0",
        }
        meta_file = d / "plugin.json"
        if meta_file.exists():
            try:
                data = json.loads(meta_file.read_text(encoding="utf-8"))
                info.update({
                    "description": data.get("description", ""),
                    "version": data.get("version", "0.0.0"),
                    "author": data.get("author", ""),
                    "enabled": data.get("enabled", True),
                    "provides": data.get("provides", []),
                })
            except Exception:
                pass
        plugins.append(info)
    return plugins


@router.post("/{name}/reload")
async def reload_plugin(name: str):
    plugin_dir = PLUGINS_ROOT / name
    if not plugin_dir.exists():
        raise HTTPException(status_code=404, detail="Plugin not found")
    init_file = plugin_dir / "__init__.py"
    if not init_file.exists():
        raise HTTPException(status_code=400, detail="No __init__.py")
    try:
        spec = importlib.util.spec_from_file_location(f"plugins.{name}", init_file)
        if spec is None or spec.loader is None:
            raise RuntimeError("Cannot load plugin")
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        registry = get_model_registry()
        if hasattr(module, "register"):
            module.register(registry)
        return {"status": "reloaded", "name": name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/discover")
async def discover_all():
    registry = get_model_registry()
    models = registry.discover()
    return {"models": len(models), "names": [m.name for m in models]}
