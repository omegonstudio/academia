#!/usr/bin/env bash
# Restores a dump produced by scripts/db-backup.sh.
#
#   scripts/db-restore.sh <dev|prod> <path-to-dump>
#
# Restoring is destructive: pg_restore --clean drops and recreates the objects
# it finds in the dump. Restoring into production therefore requires an explicit
# typed confirmation, satisfying the rule that destructive operations must be
# deliberate, protected and documented.
set -euo pipefail

ENVIRONMENT="${1:?usage: db-restore.sh <dev|prod> <dump-file>}"
DUMP_FILE="${2:?usage: db-restore.sh <dev|prod> <dump-file>}"

source "$(dirname "${BASH_SOURCE[0]}")/compose.sh" "$ENVIRONMENT"

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Dump file not found: $DUMP_FILE" >&2
  exit 1
fi

if [[ "$ENVIRONMENT" == "prod" ]]; then
  cat >&2 <<'WARNING'
================================================================
 WARNING: this will OVERWRITE the PRODUCTION database.
 Take a fresh backup first (scripts/db-backup.sh prod).
================================================================
WARNING
  read -r -p 'Type RESTORE-PRODUCTION to continue: ' confirmation
  if [[ "$confirmation" != "RESTORE-PRODUCTION" ]]; then
    echo "Aborted." >&2
    exit 1
  fi
fi

echo "==> Restoring ${DUMP_FILE} into the ${ENVIRONMENT} database"

# --clean --if-exists makes the restore repeatable; --exit-on-error surfaces a
# partial restore as a failure rather than leaving a half-populated database.
compose exec -T db sh -c \
  'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --exit-on-error' \
  < "$DUMP_FILE"

echo "==> Restore complete"
echo
echo "Re-apply any migrations added after the dump was taken:"
echo "  npm run db:deploy"
