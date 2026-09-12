"""
Background indexing handler – registered with TaskQueue.
Supports progress reporting, pause/resume/cancel, incremental re-index.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

STORAGE_ROOT = Path(__file__).resolve().parents[1] / "Storage" / "workspaces"


def register_indexing_handlers(queue) -> None:
    queue.register_handler("index", handle_index)
    queue.register_handler("reindex", handle_index)
    logger.info("Indexing handlers registered")


def handle_index(task) -> Dict[str, Any]:
    from Core.chunking.strategies import get_chunker
    from Core.pdf.engine import PDFEngine
    from Core.registry.model_registry import get_model_registry
    from Adapters.vectordb.faiss_adapter import FAISSVectorDB
    from Adapters.embedding.sentence_transformers_adapter import SentenceTransformersEmbedding
    from Interfaces.chunking import ChunkingConfig, ChunkStrategy
    from Interfaces.vectordb import VectorDBConfig, VectorDocument
    from Interfaces.providers import DeviceType, ModelMetadata
    from Workers.task_queue import get_task_queue

    queue = get_task_queue()
    ws_id = task.workspace_id
    file_id = task.file_id
    meta_cfg = task.meta or {}

    meta_path = STORAGE_ROOT / ws_id / "books" / f"{file_id}.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"Book metadata not found: {file_id}")

    book_meta = json.loads(meta_path.read_text(encoding="utf-8"))
    book_meta["status"] = "indexing"
    meta_path.write_text(json.dumps(book_meta, indent=2), encoding="utf-8")

    strategy = meta_cfg.get("strategy", "paragraph")
    chunk_size = meta_cfg.get("chunk_size", 512)
    chunk_overlap = meta_cfg.get("chunk_overlap", 64)
    embedding_model = meta_cfg.get("embedding_model")
    ocr_provider_name = meta_cfg.get("ocr_provider")

    # OCR provider injection
    ocr = None
    if ocr_provider_name:
        ocr = _resolve_ocr(ocr_provider_name)

    queue.update_progress(task, 0, 100, "Parsing PDF...")
    engine = PDFEngine(ocr_provider=ocr)
    pdf = engine.open(
        book_meta["path"],
        extract_images=False,
        extract_tables=True,
        ocr_if_needed=True,
    )

    queue.update_progress(task, 10, 100, f"Chunking {pdf.page_count} pages...")
    chunker = get_chunker(strategy)
    config = ChunkingConfig(
        strategy=ChunkStrategy(strategy) if strategy in [s.value for s in ChunkStrategy] else ChunkStrategy.PARAGRAPH,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    all_chunks = []
    for i, page in enumerate(pdf.pages):
        queue.update_progress(
            task, 10 + int(30 * (i + 1) / max(pdf.page_count, 1)),
            100, f"Chunking page {i + 1}/{pdf.page_count}",
        )
        doc_meta = {
            "file_id": file_id,
            "workspace_id": ws_id,
            "page": page.page_number,
            "title": pdf.title,
        }
        page_chunks = chunker.chunk(page.text or "", config, doc_meta)
        all_chunks.extend(page_chunks)

    if not all_chunks:
        book_meta["status"] = "indexed"
        book_meta["chunk_count"] = 0
        meta_path.write_text(json.dumps(book_meta, indent=2), encoding="utf-8")
        return {"chunk_count": 0, "message": "No text content found"}

    queue.update_progress(task, 45, 100, f"Embedding {len(all_chunks)} chunks...")

    registry = get_model_registry()
    emb_models = registry.list_models(model_type="embedding", enabled_only=True)
    if emb_models:
        name = embedding_model or emb_models[0].name
        try:
            embedder = registry.get_provider("embedding", name)
        except Exception:
            embedder = _default_embedder()
    else:
        embedder = _default_embedder()

    embedder.load(DeviceType.AUTO)

    batch_size = 32
    all_embeddings = []
    for i in range(0, len(all_chunks), batch_size):
        batch = all_chunks[i : i + batch_size]
        texts = [c.text for c in batch]
        result = embedder.generate_embeddings(texts, batch_size=batch_size)
        all_embeddings.extend(result.embeddings)
        done = min(i + batch_size, len(all_chunks))
        queue.update_progress(
            task, 45 + int(40 * done / len(all_chunks)),
            100, f"Embedded {done}/{len(all_chunks)} chunks",
        )

    dim = len(all_embeddings[0]) if all_embeddings else 384

    queue.update_progress(task, 90, 100, "Building vector index...")
    vec_dir = STORAGE_ROOT / ws_id / "vectors" / file_id
    # Clear old index for reindex
    if vec_dir.exists():
        import shutil
        shutil.rmtree(vec_dir)
    vec_dir.mkdir(parents=True, exist_ok=True)

    vdb = FAISSVectorDB()
    vdb.initialize(
        VectorDBConfig(
            collection_name=file_id,
            dimension=dim,
            metric="cosine",
            path=str(vec_dir),
        )
    )
    docs = [
        VectorDocument(
            id=c.id,
            embedding=emb,
            text=c.text,
            metadata={
                "page": c.page,
                "chapter": c.chapter,
                "heading": c.heading,
                "file_id": c.file_id,
                "workspace_id": c.workspace_id,
                "strategy": c.strategy,
            },
        )
        for c, emb in zip(all_chunks, all_embeddings)
    ]
    vdb.add(docs)
    vdb.close()

    # Save chunk previews
    chunks_path = STORAGE_ROOT / ws_id / "books" / f"{file_id}.chunks.json"
    chunks_path.write_text(
        json.dumps(
            [{"id": c.id, "text": c.text[:300], "page": c.page, "chapter": c.chapter} for c in all_chunks],
            indent=2,
        ),
        encoding="utf-8",
    )

    book_meta["status"] = "indexed"
    book_meta["chunk_count"] = len(all_chunks)
    book_meta["embedding_dim"] = dim
    book_meta["is_scanned"] = pdf.is_scanned
    meta_path.write_text(json.dumps(book_meta, indent=2), encoding="utf-8")

    queue.update_progress(task, 100, 100, "Indexing complete")
    return {
        "chunk_count": len(all_chunks),
        "embedding_dim": dim,
        "page_count": pdf.page_count,
        "is_scanned": pdf.is_scanned,
    }


def _default_embedder():
    from Adapters.embedding.sentence_transformers_adapter import SentenceTransformersEmbedding
    from Interfaces.providers import ModelMetadata

    meta = ModelMetadata(
        name="bge-small-en-v1.5",
        type="embedding",
        version="1.5",
        provider="sentence-transformers",
        dimension=384,
        extra={"model_name": "BAAI/bge-small-en-v1.5"},
    )
    return SentenceTransformersEmbedding(meta)


def _resolve_ocr(name: str):
    name = name.lower()
    if name == "tesseract":
        from Adapters.ocr.tesseract_adapter import TesseractOCR
        return TesseractOCR()
    if name == "easyocr":
        from Adapters.ocr.easyocr_adapter import EasyOCRProvider
        return EasyOCRProvider()
    if name == "paddleocr":
        from Adapters.ocr.paddleocr_adapter import PaddleOCRProvider
        return PaddleOCRProvider()
    # Try registry
    try:
        from Core.registry.model_registry import get_model_registry
        return get_model_registry().get_provider("ocr", name)
    except Exception:
        return None
