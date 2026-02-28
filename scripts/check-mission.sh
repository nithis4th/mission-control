#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/mission-control}"
PORT="${PORT:-4000}"

cd "$APP_DIR"

echo "[check] commit: $(git log --oneline -1)"
echo "[check] processes:"
ps aux | grep -E "next-server|next start -p ${PORT}|npm start|node .*mission-control" | grep -v grep || true

echo "[check] http head:"
curl -I -sS "http://127.0.0.1:${PORT}" | head -n 8 || true

echo "[check] api health quick:"
TOKEN="$(grep '^MC_API_TOKEN=' .env.local 2>/dev/null | cut -d= -f2- || true)"
if [[ -n "$TOKEN" ]]; then
  curl -sS -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:${PORT}/api/agents" | head -c 160 && echo
  curl -sS -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:${PORT}/api/cost" | head -c 200 && echo
else
  echo "MC_API_TOKEN not found in .env.local"
fi


echo "[check] known-good tags on current commit:"
git tag --points-at HEAD | grep '^kg-' || echo "(none)"

echo "[check] latest known-good tags:"
git tag -l 'kg-*' --sort=-creatordate | head -n 5
