#!/usr/bin/env bash
# RAGBook Studio — start backend + frontend dev servers together.
# Run ./setup.sh first if you haven't already.

set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "No .venv found — run ./setup.sh first."
    exit 1
fi

cleanup() {
    echo ""
    echo "Shutting down..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Starting backend on http://localhost:8000"
source .venv/bin/activate
PYTHONPATH="$(pwd)" uvicorn Backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
deactivate

echo "==> Starting frontend on http://localhost:5173"
cd Frontend
npm run dev -- --host &
FRONTEND_PID=$!
cd ..

echo ""
echo "RAGBook Studio is running:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000  (docs at /docs)"
echo "Press Ctrl+C to stop both."

wait "$BACKEND_PID" "$FRONTEND_PID"
