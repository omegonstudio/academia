#!/bin/sh
# Startup sequence for the API container.
#
#   1. apply pending migrations (retried while the database settles)
#   2. provision the SuperAdmin idempotently
#   3. hand over to the server process
#
# Deliberately absent: any schema generation step. Migrations are authored by a
# developer and committed; a container never invents one.
set -eu

PRISMA_BIN="/app/node_modules/.bin/prisma"
MAX_ATTEMPTS="${MIGRATION_MAX_ATTEMPTS:-30}"
RETRY_DELAY_SECONDS=2

cd /app/apps/api

# Build the connection URL from discrete parameters unless one was supplied.
# Captured, never echoed: it contains the password.
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(node /usr/local/lib/academia/database-url.mjs)"
  export DATABASE_URL
fi

# Fail fast and legibly on a bad environment, rather than retrying a
# configuration error thirty times as if the database were merely slow.
echo "[entrypoint] validating configuration"
node dist/config/preflight.js

echo "[entrypoint] applying database migrations"

attempt=1
while :; do
  if "$PRISMA_BIN" migrate deploy; then
    echo "[entrypoint] migrations applied"
    break
  fi

  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "[entrypoint] migrations failed after ${attempt} attempts" >&2
    exit 1
  fi

  echo "[entrypoint] database not ready, retrying (${attempt}/${MAX_ATTEMPTS})"
  attempt=$((attempt + 1))
  sleep "$RETRY_DELAY_SECONDS"
done

# Skipped without failing when SUPERADMIN_PASSWORD is unset.
echo "[entrypoint] running SuperAdmin bootstrap"
node dist/seed/cli.js

echo "[entrypoint] starting: $*"
exec "$@"
