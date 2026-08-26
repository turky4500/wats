#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/wats}"
BRANCH="${BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/turky4500/wats.git}"
PORT="${PORT:-3000}"
LOG_FILE="$APP_DIR/app.log"

say() {
  echo
  echo "==== $* ===="
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "[ERROR] Missing command: $1"; exit 1; }
}

say "Checking tools"
require_cmd git
require_cmd npm
require_cmd node
require_cmd curl

say "Preparing app directory"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -d .git ]; then
  echo "Cloning repository into $APP_DIR"
  git clone "$REPO_URL" .
else
  echo "Repository already exists, pulling latest changes"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

if [ -n "${WATS_ENV_FILE:-}" ]; then
  say "Writing .env from GitHub secret WATS_ENV_FILE"
  printf '%s\n' "$WATS_ENV_FILE" > "$APP_DIR/.env"
fi

if [ ! -f "$APP_DIR/.env" ]; then
  echo "[ERROR] Missing $APP_DIR/.env"
  echo "Create it on the server once, or add GitHub secret WATS_ENV_FILE with full .env content."
  exit 1
fi

say "Checking required env keys"
required_keys=(MONGODB_URI ADMIN_USERNAME ADMIN_PASSWORD SESSION_SECRET)
for key in "${required_keys[@]}"; do
  if ! grep -Eq "^${key}=" "$APP_DIR/.env"; then
    echo "[ERROR] Missing env key in .env: $key"
    exit 1
  fi
  echo "OK: $key"
done

say "Installing dependencies"
npm install --omit=dev

say "Stopping old app on port $PORT if found"
fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
pkill -f "node server.js" >/dev/null 2>&1 || true
sleep 2

say "Starting app"
nohup npm start >> "$LOG_FILE" 2>&1 &

say "Waiting for health check"
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${PORT}/ping" >/dev/null 2>&1; then
    echo "Health check passed"
    break
  fi
  sleep 2
done

if ! curl -fsS "http://127.0.0.1:${PORT}/ping" >/dev/null 2>&1; then
  echo "[ERROR] App did not become healthy on port $PORT"
  tail -n 120 "$LOG_FILE" || true
  exit 1
fi

say "Done"
echo "App is healthy on http://127.0.0.1:${PORT}/ping"
echo "Public URL: https://wats-saas.duckdns.org/"
