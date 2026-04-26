#!/usr/bin/env bash
# Convenience launcher — starts backend + frontend, kills both on Ctrl-C.
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install -r backend/requirements.txt
fi

if [ ! -d frontend/node_modules ]; then
  (cd frontend && npm install --no-audit --no-fund)
fi

PYTHONPATH=backend .venv/bin/uvicorn app.main:app --port 8000 --reload &
BACK_PID=$!
(cd frontend && npm run dev -- --port 5173) &
FRONT_PID=$!

trap "kill $BACK_PID $FRONT_PID 2>/dev/null || true" EXIT
wait
