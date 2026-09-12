#!/usr/bin/env bash
# Stops the development stack.
#
# Volumes are preserved. Pass --volumes to discard the development database.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/compose.sh" dev

if [[ "${1:-}" == "--volumes" ]]; then
  echo "==> Stopping the development stack and deleting its database volume"
  compose down --volumes
else
  echo "==> Stopping the development stack (database volume kept)"
  compose down
fi
