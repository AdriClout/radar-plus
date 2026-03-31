#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

PORT="${1:-8877}"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT deja utilise, selection d'un port libre..."
  PORT="$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("", 0))
print(s.getsockname()[1])
s.close()
PY
)"
fi

echo "Serveur local: http://localhost:$PORT/index.html"
python3 -m http.server "$PORT" >/tmp/constellation-server.log 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

sleep 1
URL="http://localhost:$PORT/index.html?v=$(date +%s)"
open -a "Google Chrome" "$URL"

echo "Chrome ouvert. Appuyez sur Ctrl+C pour arreter le serveur."
wait "$SERVER_PID"
