#!/usr/bin/env bash
set -euo pipefail

# Paths (change if you deploy elsewhere)
APP_DIR="/opt/wakafetch"
SERVICE_NAME="wakafetch"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if ! id -u "$SERVICE_NAME" >/dev/null 2>&1; then
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_NAME"
fi

mkdir -p "$APP_DIR"
chown -R "$SERVICE_NAME:$SERVICE_NAME" "$APP_DIR"

rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' --exclude 'dist' \
  ./ "$APP_DIR"/

cd "$APP_DIR"
npm ci
npm run build
chown -R "$SERVICE_NAME:$SERVICE_NAME" "$APP_DIR"

install -m 0644 deploy/systemd/wakafetch.service "$SERVICE_FILE"

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager
