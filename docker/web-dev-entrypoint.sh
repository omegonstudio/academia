#!/bin/sh
# The shared contracts package is consumed from its compiled dist/, which is
# gitignored, so it is built before the dev server starts.
set -eu

cd /app

# Keep anonymous-volume node_modules in sync with the bind-mounted lockfile.
# shellcheck source=/dev/null
. /usr/local/lib/academia/sync-node-modules.sh

echo "[entrypoint] building shared contracts"
npm run build -w @academia/shared

echo "[entrypoint] starting: $*"
exec "$@"
