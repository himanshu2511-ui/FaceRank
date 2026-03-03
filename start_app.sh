#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         🔥 FaceRank — Starting Up         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Kill existing servers
echo "→ Cleaning up old processes..."
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :5173 | xargs kill -9 2>/dev/null || true
sleep 1

# Backend
echo "→ Starting FastAPI backend (port 8000)..."
cd "$BACKEND"
source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/facerank_backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend
sleep 3
if lsof -ti :8000 > /dev/null 2>&1; then
  echo "  ✅ Backend ready → http://localhost:8000"
else
  echo "  ❌ Backend failed to start! Check /tmp/facerank_backend.log"
  exit 1
fi

# Frontend
echo "→ Starting Vite frontend (port 5173)..."
cd "$FRONTEND"
npm run dev > /tmp/facerank_frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 3
if lsof -ti :5173 > /dev/null 2>&1; then
  echo "  ✅ Frontend ready → http://localhost:5173"
else
  echo "  ❌ Frontend failed! Check /tmp/facerank_frontend.log"
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  🚀 FaceRank is LIVE!                    ║"
echo "║                                          ║"
echo "║  Frontend → http://localhost:5173        ║"
echo "║  Backend  → http://localhost:8000        ║"
echo "║  API Docs → http://localhost:8000/docs   ║"
echo "║                                          ║"
echo "║  Press Ctrl+C to stop                    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Keep alive
trap "echo ''; echo 'Shutting down…'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
