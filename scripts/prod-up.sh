#!/usr/bin/env bash
# Brings up the production stack on the current host.
#
# Ordering matches the deployment pipeline: the database becomes healthy, then
# the API starts and applies migrations through its entrypoint, then the web
# service comes up once the API reports healthy.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/compose.sh" prod

if [[ "${NODE_ENV:-}" == "development" ]]; then
  echo "NODE_ENV is 'development' while starting the production stack. Aborting." >&2
  exit 1
fi

echo "==> Validating the composed configuration"
compose config -q

echo "==> Building images"
compose build

echo "==> Starting the database"
compose up -d db

echo "==> Starting the API (applies migrations on boot)"
compose up -d api

echo "==> Starting the web service"
compose up -d web

echo "==> Verifying health"
"$(dirname "${BASH_SOURCE[0]}")/health-check.sh" prod
