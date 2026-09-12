#!/usr/bin/env bash
# Brings up the development stack and waits until it is genuinely usable.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/compose.sh" dev

echo "==> Building and starting the development stack"
compose up --build -d

echo "==> Waiting for services to report healthy"

wait_for_health() {
  local service="$1"
  local attempts="${2:-60}"

  for ((i = 1; i <= attempts; i++)); do
    local container status
    container="$(compose ps -q "$service")"

    if [[ -n "$container" ]]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container")"
      case "$status" in
        healthy)
          echo "    $service: healthy"
          return 0
          ;;
        unhealthy)
          echo "    $service: unhealthy" >&2
          compose logs --tail 60 "$service" >&2
          return 1
          ;;
      esac
    fi
    sleep 2
  done

  echo "    $service did not become healthy in time" >&2
  compose logs --tail 60 "$service" >&2
  return 1
}

wait_for_health db
wait_for_health api
wait_for_health web

WEB_PORT_VALUE="$(grep -E '^WEB_PORT=' .env | cut -d= -f2 || true)"
API_PORT_VALUE="$(grep -E '^API_PORT=' .env | cut -d= -f2 || true)"

echo
echo "Development stack is up:"
echo "  web    http://localhost:${WEB_PORT_VALUE:-3000}"
echo "  api    http://localhost:${API_PORT_VALUE:-4000}/health"
echo
echo "Logs:  npm run dev:logs      Stop:  npm run dev:down"
