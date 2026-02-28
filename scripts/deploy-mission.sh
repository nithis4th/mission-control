#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/mission-control}"
PORT="${PORT:-4000}"
LOG_FILE="${LOG_FILE:-/tmp/mission-control.log}"

cd "$APP_DIR"

echo "[deploy] app_dir=$APP_DIR port=$PORT"

echo "[1/7] Kill old processes on port pattern..."
pkill -9 -f "next-server|next start -p ${PORT}|npm start|node .*mission-control" >/dev/null 2>&1 || true

# Optional hard kill by port if lsof exists
if command -v lsof >/dev/null 2>&1; then
  PIDS_BY_PORT="$(lsof -ti tcp:${PORT} 2>/dev/null || true)"
  if [[ -n "$PIDS_BY_PORT" ]]; then
    echo "$PIDS_BY_PORT" | xargs kill -9 >/dev/null 2>&1 || true
  fi
fi

echo "[2/7] Sync code (main)..."
git checkout main >/dev/null 2>&1 || true
git pull --ff-only origin main

echo "[3/7] Clean build cache..."
rm -rf .next node_modules/.cache

echo "[4/7] Build..."
npm run build

echo "[5/7] Start server (background)..."
: > "$LOG_FILE"
nohup npm start >> "$LOG_FILE" 2>&1 &
PID=$!
echo "[deploy] started pid=$PID"

echo "[6/7] Wait for health..."
OK=0
for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}" >/dev/null 2>&1; then
    OK=1
    break
  fi
  sleep 1
done

if [[ "$OK" -ne 1 ]]; then
  echo "[deploy] FAILED: app did not become healthy in time"
  echo "--- tail $LOG_FILE ---"
  tail -n 80 "$LOG_FILE" || true
  exit 1
fi

echo "[7/7] Verify quick endpoints..."
curl -fsS "http://127.0.0.1:${PORT}" >/dev/null

echo "[deploy] SUCCESS"
echo "url: http://localhost:${PORT}"
echo "log: $LOG_FILE"
