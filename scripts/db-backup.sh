#!/usr/bin/env bash
# Creates a compressed logical backup of the PostgreSQL database.
#
#   scripts/db-backup.sh [dev|prod]
#
# pg_dump runs inside the container, so the client version always matches the
# server and no PostgreSQL client is needed on the host.
#
# Output: backups/academia-<env>-<UTC timestamp>.dump  (gitignored)
#
# This covers on-demand and scripted backups. Scheduling and offsite retention
# are described in docs/BACKUP-RESTORE.md.
set -euo pipefail

ENVIRONMENT="${1:-prod}"
source "$(dirname "${BASH_SOURCE[0]}")/compose.sh" "$ENVIRONMENT"

BACKUP_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="${BACKUP_DIR}/academia-${ENVIRONMENT}-${TIMESTAMP}.dump"

echo "==> Dumping the ${ENVIRONMENT} database"

# -Fc is the custom format: compressed and restorable selectively by pg_restore.
compose exec -T db sh -c \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-privileges' \
  > "$TARGET"

if [[ ! -s "$TARGET" ]]; then
  echo "Backup is empty; removing ${TARGET}" >&2
  rm -f "$TARGET"
  exit 1
fi

echo "==> Wrote ${TARGET} ($(du -h "$TARGET" | cut -f1))"
echo
echo "Verify a backup periodically by restoring it into a scratch database:"
echo "  scripts/db-restore.sh ${ENVIRONMENT} ${TARGET}"
