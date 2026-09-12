# RAGBook Studio – Architecture

## Design Principles

1. **SOLID** – Single responsibility, open/closed, Liskov, interface segregation, dependency inversion.
2. **Dependency Injection** – Providers are resolved via the Model Registry; services receive interfaces, not concrete classes.
3. **Plugin-first** – New embedding models, LLMs, OCR engines, vector DBs, chunkers can be added without touching core code.
4. **Offline-first** – All critical paths work without network. Cloud adapters are optional.
5. **Device-agnostic** – DeviceManager detects CUDA / ROCm / Metal / CPU and exposes a uniform API.

## Layer Overview

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React + TS + Vite + Tailwind Glassmorphism)  │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP / SSE
┌──────────────────────────▼──────────────────────────────┐
│  API Layer (FastAPI routers)                            │
│  /api/device  /api/models  /api/workspaces  /api/pdf    │
│  /api/chat    /api/search  /api/settings                │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Services / Workers (orchestration, background jobs)    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Core Modules                                           │
│  device │ pdf │ ocr │ chunking │ embedding │ vectordb   │
│  retrieval │ reranking │ chat │ llm │ workspaces        │
│  settings │ plugins │ registry                          │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Interfaces (Protocols + ABCs)                          │
│  EmbeddingProvider │ LLMProvider │ OCRProvider │ …      │
│  VectorDBProvider  │ ChunkerProvider                    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Adapters (concrete implementations)                    │
│  SentenceTransformers │ llama.cpp │ FAISS │ Chroma │ …  │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Models/ + Plugins/  (discovered at runtime)            │
└─────────────────────────────────────────────────────────┘
```

## Adding a Custom Embedding Model

1. Create `Models/Embeddings/MyModel/metadata.json`
2. Create `Models/Embeddings/MyModel/model.py` implementing `BaseEmbeddingProvider`
3. Restart / call `/api/models/discover`
4. Enable the model in the UI or via API

No other files need to change.

## Vector DB Swap

Change `default_vector_db` in Settings (or workspace settings). The retrieval layer uses the `VectorDBProvider` interface; only the adapter factory needs to know about concrete backends.

## Device Switching

Settings → Device Preference → `auto` | `cpu` | `gpu`.  
The DeviceManager refreshes and all subsequently loaded models use the new device string (`cuda:0`, `mps`, `cpu`).
