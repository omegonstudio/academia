#!/usr/bin/env bash
# Runs the API integration suite against the development database.
#
# The suite needs migrations applied and a reachable PostgreSQL. It connects
# from the host, so DATABASE_URL targets localhost on the published dev port
# rather than the compose service name.
#
# Prisma CLI (prisma7.config.ts) prefers DATABASE_URL_UNPOOLED / DIRECT_URL over
# DATABASE_URL, and loadDotenv will fill those from root .env when unset. Export
# all three to the same local URL so migrate deploy cannot target Neon/hosted DB.
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
LOCAL_DATABASE_URL="$(
  POSTGRES_HOST=127.0.0.1 \
  POSTGRES_PORT="${POSTGRES_PORT_VALUE:-5433}" \
  POSTGRES_USER="${POSTGRES_USER_VALUE}" \
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD_VALUE}" \
  POSTGRES_DB="${POSTGRES_DB_VALUE}" \
  node "${REPO_ROOT}/docker/database-url.mjs"
)"

# Force every Prisma/datasource path onto the same local Compose DB. Setting
# these before any Prisma command prevents loadDotenv from injecting Neon URLs
# (dotenv never overwrites existing variables).
export DATABASE_URL="${LOCAL_DATABASE_URL}"
export DATABASE_URL_UNPOOLED="${LOCAL_DATABASE_URL}"
export DIRECT_URL="${LOCAL_DATABASE_URL}"

# Destination gate: refuse migrate/tests if the URL is not clearly local.
assert_local_database_url() {
  local url="$1"
  local label="$2"
  local host
  host="$(
    node -e '
      const raw = process.argv[1] || "";
      let host = "";
      try { host = new URL(raw).hostname; } catch { process.exit(2); }
      process.stdout.write(host);
    ' "$url"
  )" || {
    echo "ERROR: ${label} is not a valid URL; aborting before migrate." >&2
    exit 1
  }

  case "${host}" in
    localhost|127.0.0.1|::1) ;;
    *)
      echo "ERROR: ${label} host is '${host}', expected localhost/127.0.0.1. Aborting to avoid remote migrate." >&2
      exit 1
      ;;
  esac

  if [[ "${host}" == *neon* || "${url}" == *neon.tech* ]]; then
    echo "ERROR: ${label} looks like Neon; aborting." >&2
    exit 1
  fi

  echo "==> ${label} host=${host} (local OK)"
}

assert_local_database_url "${DATABASE_URL}" "DATABASE_URL"
assert_local_database_url "${DATABASE_URL_UNPOOLED}" "DATABASE_URL_UNPOOLED"
assert_local_database_url "${DIRECT_URL}" "DIRECT_URL"

# Confirm host port and Compose container see the same cluster before migrate.
HOST_SYSTEM_ID="$(
  PGPASSWORD="${POSTGRES_PASSWORD_VALUE}" psql -h 127.0.0.1 -p "${POSTGRES_PORT_VALUE:-5433}" \
    -U "${POSTGRES_USER_VALUE}" -d "${POSTGRES_DB_VALUE}" -Atc \
    "SELECT system_identifier FROM pg_control_system();"
)"
CTR_SYSTEM_ID="$(
  compose exec -T db psql -U "${POSTGRES_USER_VALUE}" -d "${POSTGRES_DB_VALUE}" -Atc \
    "SELECT system_identifier FROM pg_control_system();"
)"
if [[ -z "${HOST_SYSTEM_ID}" || "${HOST_SYSTEM_ID}" != "${CTR_SYSTEM_ID}" ]]; then
  echo "ERROR: 127.0.0.1:${POSTGRES_PORT_VALUE:-5433} system_identifier (${HOST_SYSTEM_ID:-empty}) != compose db (${CTR_SYSTEM_ID:-empty}). Aborting." >&2
  exit 1
fi
echo "==> system_identifier match (${HOST_SYSTEM_ID})"

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

echo "==> Applying migrations (local only)"
npm run db:deploy -w @academia/api

echo "==> Running the integration suite"
npm run test:integration -w @academia/api
