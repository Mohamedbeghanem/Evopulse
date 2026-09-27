#!/bin/sh
# Make the mounted SQLite volume writable, then run `next start` as the unprivileged `node` user.
# Fly volumes and Render disks mount root-owned, so the chown has to happen at runtime.
set -e
DATA_DIR="$(dirname "${DB_PATH:-/data/evopulse.db}")"
mkdir -p "$DATA_DIR" "${WORKSPACE_DB_DIR:-$DATA_DIR/workspaces}"
if [ "$(id -u)" = "0" ]; then
  chown -R node:node "$DATA_DIR" "${WORKSPACE_DB_DIR:-$DATA_DIR/workspaces}" 2>/dev/null || true
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
