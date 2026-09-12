#!/usr/bin/env bash
# Tails the development logs. Accepts an optional service name.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/compose.sh" dev

compose logs -f --tail 100 "$@"
