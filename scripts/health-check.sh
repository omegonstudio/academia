#!/usr/bin/env bash
# Post-deployment verification.
#
# Asserts that every container reports healthy and that /health answers `ok`
# from inside the network. Exits non-zero so a pipeline fails loudly.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/compose.sh" "${1:-prod}"

failed=0

for service in db api web; do
  container="$(compose ps -q "$service" || true)"

  if [[ -z "$container" ]]; then
    echo "FAIL  $service is not running"
    failed=1
    continue
  fi

  for ((i = 1; i <= 60; i++)); do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container")"
    [[ "$status" == "starting" ]] || break
    sleep 2
  done

  if [[ "$status" == "healthy" ]]; then
    echo "PASS  $service is healthy"
  else
    echo "FAIL  $service reports '$status'"
    compose logs --tail 40 "$service" >&2
    failed=1
  fi
done

echo "==> Checking the API health contract"
if compose exec -T api node -e "
  fetch('http://127.0.0.1:4000/health')
    .then(async (response) => {
      const body = await response.json();
      console.log(JSON.stringify(body));
      process.exit(response.ok && body.status === 'ok' ? 0 : 1);
    })
    .catch((error) => { console.error(String(error)); process.exit(1); });
"; then
  echo "PASS  /health reports ok"
else
  echo "FAIL  /health did not report ok"
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  echo
  echo "Health verification failed." >&2
  exit 1
fi

echo
echo "All services healthy."
