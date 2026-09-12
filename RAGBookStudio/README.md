# RAGBook Studio

**Production-ready, cross-platform Retrieval-Augmented Generation (RAG) application for PDF books.**

Version 1.1 – AI Study Platform

## Overview

RAGBook Studio is a desktop-first, offline-capable RAG platform that allows users to:

- Upload and parse PDF books (text, scanned, multi-column, password-protected)
- Index content with modular chunking strategies
- Generate vector embeddings using pluggable models
- Perform semantic, keyword, and hybrid retrieval with optional reranking
- Chat with books using local or cloud LLMs with precise citations
- Jump directly to cited pages with paragraph highlighting
- Manage multiple workspaces, notes, bookmarks, and models

### Key Design Principles

- **Modular & Replaceable AI**: Every AI component (Embedding, LLM, OCR, Reranker, Vision, Speech) is defined by interfaces. Custom models are added by implementing the interface + placing them in the Models/ or Plugins/ directories.
- **Device Agnostic**: Automatic detection of CUDA, ROCm, Apple Metal, or CPU. Switch via Settings without code changes.
- **Offline-First**: Fully functional without internet. Optional cloud providers supported through adapters.
- **Plugin Architecture**: Automatic discovery of plugins for models, chunkers, exporters, etc.
- **Clean Architecture**: SOLID, dependency injection, repository pattern, fully typed.
- **Cross-Platform**: Windows, Linux, macOS. Portable builds + Docker.

## Architecture

```
Frontend/          React + TypeScript + Vite + Tailwind (Glassmorphism UI)
Backend/           FastAPI application
Core/              Business logic modules (device, pdf, ocr, chunking, embedding, ...)
Interfaces/        Abstract base classes / Protocols for all AI components
Adapters/          Concrete implementations (FAISS, Chroma, BGE, local LLM, etc.)
Models/            Installed model packages (metadata.json + weights/)
Plugins/           Dynamically discovered extensions
Services/          High-level orchestration services
Workers/           Background task workers (indexing, embedding)
Storage/           File storage (workspaces, models, cache)
Database/          SQLite (default) with repository abstraction (PostgreSQL ready)
API/               OpenAPI / external API surface
Tests/             Unit, integration, performance
```

## Quick Start

### Backend

```bash
cd Backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

### Full Stack (Docker)

```bash
docker-compose up --build
```

## Device Manager

The application auto-detects the best available accelerator:

| Priority | Backend     | Example          |
|----------|-------------|------------------|
| 1        | CUDA        | RTX 4060         |
| 2        | ROCm        | AMD GPUs         |
| 3        | Metal       | Apple Silicon    |
| 4        | CPU         | Fallback         |

Users can force `Auto` / `CPU` / `GPU` in Settings.

## Adding a Custom Model

1. Create a folder under `Models/Embeddings/MyCustomEmbedder/`
2. Add `metadata.json`:

```json
{
  "name": "MyCustomEmbedder",
  "type": "embedding",
  "version": "1.0.0",
  "provider": "custom",
  "device_support": ["cpu", "cuda", "metal"],
  "dimension": 768,
  "max_seq_length": 512
}
```

3. Implement the `EmbeddingProvider` interface in `model.py` (or place a plugin that registers it).
4. Restart / refresh Model Manager — the model appears automatically.

No other application code needs to change.

## Supported Providers (Adapters)

| Category   | Built-in Adapters                          |
|------------|--------------------------------------------|
| Embedding  | SentenceTransformers (BGE, E5, Nomic, Jina), Custom |
| LLM        | llama.cpp, HuggingFace, Ollama, OpenAI, Anthropic, Custom |
| OCR        | Tesseract, PaddleOCR, EasyOCR, Custom      |
| Vector DB  | FAISS, Chroma, Qdrant, SQLite-VSS, Milvus  |
| Reranker   | CrossEncoder, Custom                       |

## License

MIT (or as specified by the project owner)

## Contributing

See `docs/CONTRIBUTING.md` and the plugin development guide.
