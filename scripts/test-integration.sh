#!/usr/bin/env bash
# Runs the API integration suite against the development database.
#
# The suite needs migrations applied and a reachable PostgreSQL. It connects
# from the host, so DATABASE_URL points at the published dev port rather than
# the compose service name.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/compose.sh" dev

POSTGRES_DB_VALUE="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)"
POSTGRES_USER_VALUE="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2-)"
POSTGRES_PASSWORD_VALUE="$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)"
POSTGRES_PORT_VALUE="$(grep -E '^POSTGRES_PORT=' .env | cut -d= -f2- || echo 5433)"

if [[ -z "${POSTGRES_DB_VALUE}" || -z "${POSTGRES_USER_VALUE}" ]]; then
  echo "POSTGRES_DB and POSTGRES_USER must be set in .env" >&2
  exit 1
fi

echo "==> Ensuring the development database is up"
compose up -d db

echo "==> Waiting for PostgreSQL"
for ((i = 1; i <= 30; i++)); do
  if compose exec -T db pg_isready -U "$POSTGRES_USER_VALUE" -d "$POSTGRES_DB_VALUE" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

export DATABASE_URL="postgresql://${POSTGRES_USER_VALUE}:${POSTGRES_PASSWORD_VALUE}@localhost:${POSTGRES_PORT_VALUE:-5433}/${POSTGRES_DB_VALUE}?schema=public"

echo "==> Applying migrations"
npm run db:deploy -w @academia/api

echo "==> Running the integration suite"
npm run test:integration -w @academia/api
