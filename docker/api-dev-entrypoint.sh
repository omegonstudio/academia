#!/bin/sh
# Development startup for the API container.
#
# Differs from production in one way only: the Prisma client is generated here,
# because the generated sources are gitignored and therefore absent from a fresh
# clone. Migrations are still applied with `deploy`, never authored automatically
# — creating a migration stays an explicit developer action (`npm run db:migrate`).
set -eu

PRISMA_BIN="/app/node_modules/.bin/prisma"
MAX_ATTEMPTS="${MIGRATION_MAX_ATTEMPTS:-30}"
RETRY_DELAY_SECONDS=2

# Anonymous node_modules volumes outlive image rebuilds; resync when lockfile
# on the bind mount has changed (e.g. new dependency like swagger-ui-express).
# shellcheck source=/dev/null
. /usr/local/lib/academia/sync-node-modules.sh

cd /app/apps/api

# Build the connection URL from discrete parameters unless one was supplied.
# Captured, never echoed: it contains the password.
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(node /usr/local/lib/academia/database-url.mjs)"
  export DATABASE_URL
fi

echo "[entrypoint] building shared contracts"
npm run build -w @academia/shared

echo "[entrypoint] generating Prisma client"
"$PRISMA_BIN" generate

if [ -d prisma/migrations ]; then
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

  echo "[entrypoint] running SuperAdmin bootstrap"
  node --import tsx src/seed/cli.ts
else
  echo "[entrypoint] no migrations yet; create one with 'npm run db:migrate'"
fi

echo "[entrypoint] starting: $*"
exec "$@"
