#!/bin/sh
# The shared contracts package is consumed from its compiled dist/, which is
# gitignored, so it is built before the dev server starts.
set -eu

cd /app

echo "[entrypoint] building shared contracts"
npm run build -w @academia/shared

echo "[entrypoint] starting: $*"
exec "$@"
