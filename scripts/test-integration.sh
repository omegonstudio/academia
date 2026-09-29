#!/usr/bin/env bash
# Runs the API integration suite against the development database.
#
# The suite needs migrations applied and a reachable PostgreSQL. It connects
# from the host, so DATABASE_URL targets localhost on the published dev port
# rather than the compose service name.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/compose.sh" dev

POSTGRES_DB_VALUE="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)"
POSTGRES_USER_VALUE="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2-)"
POSTGRES_PASSWORD_VALUE="$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)"
POSTGRES_PORT_VALUE="$(grep -E '^POSTGRES_PORT=' .env | cut -d= -f2- || echo 5433)"
SUPERADMIN_PASSWORD_VALUE="$(grep -E '^SUPERADMIN_PASSWORD=' .env | cut -d= -f2- || true)"
DIRECTOR_EMAIL_VALUE="$(grep -E '^DIRECTOR_EMAIL=' .env | cut -d= -f2- || true)"
DIRECTOR_PASSWORD_VALUE="$(grep -E '^DIRECTOR_PASSWORD=' .env | cut -d= -f2- || true)"

if [[ -z "${POSTGRES_DB_VALUE}" || -z "${POSTGRES_USER_VALUE}" || -z "${POSTGRES_PASSWORD_VALUE}" ]]; then
  echo "POSTGRES_DB, POSTGRES_USER and POSTGRES_PASSWORD must be set in .env" >&2
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

# Same percent-encoding path the container entrypoints use. Captured, never
# echoed: the URL contains the password.
export DATABASE_URL="$(
  POSTGRES_HOST=localhost \
  POSTGRES_PORT="${POSTGRES_PORT_VALUE:-5433}" \
  POSTGRES_USER="${POSTGRES_USER_VALUE}" \
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD_VALUE}" \
  POSTGRES_DB="${POSTGRES_DB_VALUE}" \
  node "${REPO_ROOT}/docker/database-url.mjs"
)"
# Identity suite deletes bootstrap accounts; restore with live passwords.
if [[ -n "${SUPERADMIN_PASSWORD_VALUE}" ]]; then
  export SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD_VALUE}"
fi
if [[ -n "${DIRECTOR_EMAIL_VALUE}" ]]; then
  export DIRECTOR_EMAIL="${DIRECTOR_EMAIL_VALUE}"
fi
if [[ -n "${DIRECTOR_PASSWORD_VALUE}" ]]; then
  export DIRECTOR_PASSWORD="${DIRECTOR_PASSWORD_VALUE}"
fi

echo "==> Applying migrations"
npm run db:deploy -w @academia/api

echo "==> Running the integration suite"
npm run test:integration -w @academia/api
