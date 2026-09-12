"""Chat / RAG query endpoints with streaming, citations, and retrieval debug."""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from Adapters.vectordb.faiss_adapter import FAISSVectorDB
from Core.registry.model_registry import get_model_registry
from Interfaces.providers import DeviceType, LLMMessage
from Interfaces.vectordb import VectorDBConfig

router = APIRouter()

STORAGE_ROOT = Path(__file__).resolve().parents[4] / "Storage" / "workspaces"

SYSTEM_PROMPT = """You are RAGBook Studio, an expert study assistant that answers questions about the user's PDF books.
Always ground your answers in the provided context.
When you use information from a source, cite it using the format [page X].
If the context does not contain enough information, say so clearly.
Be concise, accurate, and helpful for studying."""


class ChatRequest(BaseModel):
    workspace_id: str
    message: str
    chat_id: Optional[str] = None
    file_ids: Optional[List[str]] = None
    top_k: int = 5
    temperature: float = 0.7
    max_tokens: int = 1024
    llm_model: Optional[str] = None
    embedding_model: Optional[str] = None
    stream: bool = False
    system_prompt: Optional[str] = None
    include_debug: bool = True
    score_threshold: Optional[float] = None


def _retrieve(
    workspace_id: str,
    query: str,
    file_ids: Optional[List[str]],
    top_k: int,
    embedding_model: Optional[str],
    score_threshold: Optional[float] = None,
) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    from Adapters.embedding.sentence_transformers_adapter import SentenceTransformersEmbedding
    from Interfaces.providers import ModelMetadata

    debug: Dict[str, Any] = {"timings_ms": {}, "chunks": []}
    t0 = time.perf_counter()

    registry = get_model_registry()
    emb_models = registry.list_models(model_type="embedding", enabled_only=True)
    if emb_models:
        name = embedding_model or emb_models[0].name
        try:
            embedder = registry.get_provider("embedding", name)
        except Exception:
            embedder = _default_embedder()
            name = "bge-small-en-v1.5"
    else:
        embedder = _default_embedder()
        name = "bge-small-en-v1.5"

    embedder.load(DeviceType.AUTO)
    t1 = time.perf_counter()
    debug["timings_ms"]["embed_load"] = round((t1 - t0) * 1000, 1)

    emb = embedder.generate_embeddings([query]).embeddings[0]
    t2 = time.perf_counter()
    debug["timings_ms"]["embed_query"] = round((t2 - t1) * 1000, 1)
    debug["embedding_model"] = name
    debug["embedding_dim"] = len(emb)

    results = []
    vec_root = STORAGE_ROOT / workspace_id / "vectors"
    if not vec_root.exists():
        debug["timings_ms"]["search"] = 0
        return results, debug

    targets = file_ids or [d.name for d in vec_root.iterdir() if d.is_dir()]
    for fid in targets:
        idx_path = vec_root / fid
        if not (idx_path / "index.faiss").exists():
            continue
        book_meta_path = STORAGE_ROOT / workspace_id / "books" / f"{fid}.json"
        dim = 384
        title = fid
        if book_meta_path.exists():
            bm = json.loads(book_meta_path.read_text(encoding="utf-8"))
            dim = bm.get("embedding_dim", 384)
            title = bm.get("title") or bm.get("original_name") or fid

        vdb = FAISSVectorDB()
        vdb.initialize(
            VectorDBConfig(collection_name=fid, dimension=dim, metric="cosine", path=str(idx_path))
        )
        hits = vdb.search(emb, top_k=top_k, score_threshold=score_threshold)
        for h in hits:
            item = {
                "id": h.id,
                "score": round(h.score, 4),
                "text": h.text,
                "page": h.metadata.get("page"),
                "file_id": fid,
                "title": title,
                "chapter": h.metadata.get("chapter"),
                "heading": h.metadata.get("heading"),
                "strategy": h.metadata.get("strategy"),
            }
            results.append(item)
            debug["chunks"].append(item)
        vdb.close()

    t3 = time.perf_counter()
    debug["timings_ms"]["search"] = round((t3 - t2) * 1000, 1)
    results.sort(key=lambda x: x["score"], reverse=True)
    results = results[:top_k]
    debug["chunks"] = results
    debug["timings_ms"]["total"] = round((t3 - t0) * 1000, 1)
    return results, debug


def _default_embedder():
    from Adapters.embedding.sentence_transformers_adapter import SentenceTransformersEmbedding
    from Interfaces.providers import ModelMetadata
    meta = ModelMetadata(
        name="bge-small-en-v1.5", type="embedding", version="1.5",
        provider="sentence-transformers", dimension=384,
        extra={"model_name": "BAAI/bge-small-en-v1.5"},
    )
    return SentenceTransformersEmbedding(meta)


@router.post("/")
async def chat(body: ChatRequest):
    ws_path = STORAGE_ROOT / body.workspace_id
    if not ws_path.exists():
        raise HTTPException(status_code=404, detail="Workspace not found")

    contexts, debug = _retrieve(
        body.workspace_id, body.message, body.file_ids,
        body.top_k, body.embedding_model, body.score_threshold,
    )

    context_block = "\n\n".join(
        f"[page {c.get('page', '?')} | {c.get('title', '')}] {c['text']}" for c in contexts
    ) or "No relevant context found."

    # Confidence heuristic from top scores
    confidence = 0.0
    if contexts:
        scores = [c["score"] for c in contexts]
        confidence = round(min(1.0, sum(scores) / len(scores)), 3)

    system = body.system_prompt or SYSTEM_PROMPT
    messages = [
        LLMMessage(role="system", content=system),
        LLMMessage(
            role="user",
            content=f"Context from the books:\n{context_block}\n\nQuestion: {body.message}",
        ),
    ]

    registry = get_model_registry()
    llm_models = registry.list_models(model_type="llm", enabled_only=True)

    if not llm_models:
        answer = (
            "No local LLM is currently installed or enabled. "
            "Here is the retrieved context that would ground the answer:\n\n" + context_block
        )
        citations = [
            {"page": c.get("page"), "file_id": c.get("file_id"), "title": c.get("title"),
             "score": c.get("score"), "text_preview": c["text"][:150]}
            for c in contexts
        ]
        return {
            "chat_id": body.chat_id or str(uuid.uuid4()),
            "answer": answer,
            "citations": citations,
            "contexts": contexts,
            "confidence": confidence,
            "model": "none",
            "debug": debug if body.include_debug else None,
        }

    name = body.llm_model or llm_models[0].name
    llm = registry.get_provider("llm", name)
    llm.load(DeviceType.AUTO)

    if body.stream:
        async def event_stream():
            async for token in llm.stream(messages, max_tokens=body.max_tokens, temperature=body.temperature):
                yield f"data: {json.dumps({'token': token})}\n\n"
            payload = {
                "done": True,
                "citations": [
                    {"page": c.get("page"), "file_id": c.get("file_id"), "title": c.get("title"), "score": c.get("score")}
                    for c in contexts
                ],
                "confidence": confidence,
                "debug": debug if body.include_debug else None,
            }
            yield f"data: {json.dumps(payload)}\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    t_llm = time.perf_counter()
    response = llm.generate(messages, max_tokens=body.max_tokens, temperature=body.temperature)
    debug["timings_ms"]["llm"] = round((time.perf_counter() - t_llm) * 1000, 1)

    citations = [
        {"page": c.get("page"), "file_id": c.get("file_id"), "title": c.get("title"),
         "score": c.get("score"), "text_preview": c["text"][:150]}
        for c in contexts
    ]

    chat_id = body.chat_id or str(uuid.uuid4())
    chats_dir = ws_path / "chats"
    chats_dir.mkdir(exist_ok=True)
    chat_file = chats_dir / f"{chat_id}.json"
    history = []
    if chat_file.exists():
        history = json.loads(chat_file.read_text(encoding="utf-8"))
    history.append({"role": "user", "content": body.message, "timestamp": datetime.utcnow().isoformat() + "Z"})
    history.append({
        "role": "assistant", "content": response.content, "citations": citations,
        "confidence": confidence, "timestamp": datetime.utcnow().isoformat() + "Z",
    })
    chat_file.write_text(json.dumps(history, indent=2), encoding="utf-8")

    return {
        "chat_id": chat_id,
        "answer": response.content,
        "citations": citations,
        "contexts": contexts,
        "confidence": confidence,
        "model": response.model,
        "usage": response.usage,
        "debug": debug if body.include_debug else None,
    }


@router.get("/{workspace_id}/{chat_id}")
async def get_chat(workspace_id: str, chat_id: str):
    path = STORAGE_ROOT / workspace_id / "chats" / f"{chat_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Chat not found")
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("/{workspace_id}")
async def list_chats(workspace_id: str):
    chats_dir = STORAGE_ROOT / workspace_id / "chats"
    if not chats_dir.exists():
        return []
    result = []
    for f in sorted(chats_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            history = json.loads(f.read_text(encoding="utf-8"))
            preview = next((t["content"][:80] for t in history if t.get("role") == "user"), "")
            result.append({
                "chat_id": f.stem,
                "preview": preview,
                "turns": len(history),
                "updated_at": datetime.utcfromtimestamp(f.stat().st_mtime).isoformat() + "Z",
            })
        except Exception:
            continue
    return result
