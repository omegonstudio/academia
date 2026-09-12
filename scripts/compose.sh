#!/usr/bin/env bash
# Shared helper: resolves the compose invocation for one environment.
#
# Sourced by the other scripts so the file combination and the project name are
# defined once. Guards against pointing a dev command at production.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# $1: dev | prod
ACADEMIA_ENV="${1:?usage: compose.sh <dev|prod>}"

case "$ACADEMIA_ENV" in
  dev | prod) ;;
  *)
    echo "Unknown environment '$ACADEMIA_ENV' (expected dev or prod)" >&2
    exit 1
    ;;
esac

if [[ ! -f .env ]]; then
  echo "Missing .env. Create it with:  cp .env.example .env" >&2
  exit 1
fi

# Distinct project names namespace volumes and networks per environment, so a dev
# command cannot reach production data.
#
# The override is ACADEMIA_PROJECT rather than COMPOSE_PROJECT_NAME: the latter
# is a well-known variable that may already be exported for an unrelated project,
# and inheriting it would silently point a destructive command (dev-down
# --volumes) at the wrong stack. Opting in has to be deliberate.
export COMPOSE_PROJECT_NAME="${ACADEMIA_PROJECT:-academia-${ACADEMIA_ENV}}"

# Destructive commands must state their target.
echo "==> Environment '${ACADEMIA_ENV}' (compose project: ${COMPOSE_PROJECT_NAME})"

compose() {
  docker compose \
    -f docker-compose.yml \
    -f "docker-compose.${ACADEMIA_ENV}.yml" \
    "$@"
}
