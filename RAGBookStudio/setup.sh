#!/usr/bin/env bash
# RAGBook Studio — one-time setup.
# Creates a Python venv + installs backend deps, and installs frontend deps.
# Run this once (and again whenever requirements.txt / package.json change).

set -euo pipefail
cd "$(dirname "$0")"

echo "==> Setting up backend (Python venv + deps)"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip -q
pip install -r Backend/requirements.txt

# Optional local LLM support (llama.cpp). Comment out if you don't need it,
# or if you're wiring in a hosted API model instead.
pip install llama-cpp-python -q || echo "  (skipped llama-cpp-python — install manually if you want a local GGUF LLM)"

deactivate

echo "==> Pre-warming embedding model (avoids a slow/racy first index)"
source .venv/bin/activate
PYTHONPATH="$(pwd)" python3 - <<'PYEOF'
try:
    from Core.registry.model_registry import ModelRegistry
    from sentence_transformers import SentenceTransformer
    r = ModelRegistry()
    r.discover()
    for m in r.list_models(model_type="embedding", enabled_only=True):
        name = m.extra.get("model_name") or m.name
        print(f"  Downloading/caching embedding model: {name}")
        SentenceTransformer(name)
except Exception as e:
    print(f"  (pre-warm skipped: {e})")
PYEOF
deactivate

echo "==> Setting up frontend (npm deps)"
cd Frontend
npm install
cd ..

echo ""
echo "Setup complete."
echo "  - Drop your trained BGE checkpoint into: Models/Embeddings/bge-small-en-v1.5/weights/"
echo "  - Drop a .gguf LLM into:                 Models/LLMs/placeholder-llm/weights/"
echo "Run ./start.sh to launch the app."
