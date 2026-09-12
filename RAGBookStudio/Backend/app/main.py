"""
RAGBook Studio – FastAPI application entry point.
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from Backend.app.api.routes import (
    analytics,
    chat,
    device,
    models,
    pdf,
    plugins,
    search,
    settings,
    tasks,
    workspaces,
)
from Core.device.manager import get_device_manager
from Core.registry.model_registry import get_model_registry
from Workers.task_queue import get_task_queue
from Workers.indexing_worker import register_indexing_handlers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("ragbook")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting RAGBook Studio backend...")
    dm = get_device_manager()
    info = dm.get_display_info()
    logger.info("Device: %s (%s)", info["name"], info["backend"])

    registry = get_model_registry()
    models_list = registry.list_models()
    logger.info("Discovered %d models", len(models_list))

    queue = get_task_queue()
    register_indexing_handlers(queue)
    logger.info("Task queue ready")

    yield

    logger.info("Shutting down...")
    registry.unload_all()


app = FastAPI(
    title="RAGBook Studio API",
    version="1.1.0",
    description="Production-ready offline-first RAG Study Platform for PDF books",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(device.router, prefix="/api/device", tags=["Device"])
app.include_router(models.router, prefix="/api/models", tags=["Models"])
app.include_router(workspaces.router, prefix="/api/workspaces", tags=["Workspaces"])
app.include_router(pdf.router, prefix="/api/pdf", tags=["PDF"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(plugins.router, prefix="/api/plugins", tags=["Plugins"])


@app.get("/api/health")
async def health():
    dm = get_device_manager()
    return {
        "status": "ok",
        "version": "1.1.0",
        "device": dm.get_display_info(),
    }


@app.get("/")
async def root():
    return {"name": "RAGBook Studio", "version": "1.1.0", "docs": "/docs"}
