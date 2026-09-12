# Quick Start – RAGBook Studio v1.1 (AI Study Platform)

## Prerequisites
- Python 3.10+
- Node.js 18+
- (Optional) CUDA / ROCm / Apple Silicon

## Backend
```bash
cd Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd .. && export PYTHONPATH=$(pwd)
uvicorn Backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend
```bash
cd Frontend && npm install && npm run dev
```

## First Study Session
1. Open http://localhost:5173
2. Create a Workspace (e.g. "Physics 101")
3. Go to Library → drag-and-drop PDFs (batch supported)
4. Watch indexing progress on Dashboard / Workspace
5. Open a book → split-pane Reader with RAG chat
6. Ask questions → citations jump to source pages
7. Toggle Retrieval Debug (bug icon) for scores & timings

## OCR for Scanned PDFs
Settings → OCR Provider → Tesseract / EasyOCR / PaddleOCR  
Install the corresponding package (see requirements.txt comments).

## Local LLM
Place a GGUF under `Models/LLMs/my-model/weights/` + metadata.json, enable in Model Manager.

## Architecture Preserved
All AI components remain interface-based and registry-driven.
Custom models require only implementing the existing interfaces.
