#!/bin/sh
# Keep anonymous-volume node_modules aligned with the bind-mounted lockfile.
#
# Dev compose mounts package-lock.json from the host but shadows /app/node_modules
# with an anonymous volume that is only seeded when the volume is first created.
# Without a sync, adding a dependency on the host leaves the container on a
# stale install even after `docker compose build`.
#
# Idempotent: runs `npm ci` only when the lockfile hash changes (or the marker
# is missing). Safe to call from every API/web dev entrypoint.
set -eu

LOCK_FILE="/app/package-lock.json"
MARKER="/app/node_modules/.academia-package-lock.sha256"

if [ ! -f "$LOCK_FILE" ]; then
  echo "[sync-node-modules] no package-lock.json; skipping" >&2
  return 0 2>/dev/null || exit 0
fi

# coreutils sha256sum is present on node:*-slim images.
current="$(sha256sum "$LOCK_FILE" | awk '{ print $1 }')"
previous=""
if [ -f "$MARKER" ]; then
  previous="$(cat "$MARKER")"
fi

if [ "$current" = "$previous" ] && [ -d /app/node_modules ]; then
  return 0 2>/dev/null || exit 0
fi

echo "[sync-node-modules] package-lock changed; refreshing /app/node_modules"
cd /app
npm ci
mkdir -p /app/node_modules
echo "$current" > "$MARKER"
