#!/bin/sh
set -eu

# Allow `docker compose run api sh` or other one-off commands without running the server.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "[api] Starting server..."
exec node apps/api/dist/index.js
