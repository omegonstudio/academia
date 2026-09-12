# Backup and restore

The database is the only irreplaceable part of the system. Everything else —
images, containers, generated code — can be rebuilt from the repository.

## Scope

| Data                    | Covered by                                   |
| ----------------------- | -------------------------------------------- |
| PostgreSQL              | `scripts/db-backup.sh` (logical dump)        |
| Application code        | Git                                          |
| Secrets (`.env`)        | **Not** in backups. Store in a password manager. |
| Uploaded materials      | Not applicable yet — Stage 5 introduces file storage and must extend this document. |

## Taking a backup

```bash
./scripts/db-backup.sh prod      # or dev
```

Writes `backups/academia-<env>-<UTC timestamp>.dump` and fails if the dump is
empty. `backups/` is gitignored.

`pg_dump` runs **inside** the database container, so the client version always
matches the server and no PostgreSQL client is needed on the host. The format is
`-Fc` (custom): compressed, and restorable selectively with `pg_restore`.

Take one before every risky deployment, and before any restore.

## Scheduling and retention

The MVP may rely on the infrastructure provider's snapshots if they are
verified — but the strategy is documented here either way, and the provider's
snapshots do not remove the need for a tested logical dump.

Recommended baseline:

| Frequency | Retention | Where                                   |
| --------- | --------- | --------------------------------------- |
| Daily     | 7 days    | On the server                           |
| Weekly    | 4 weeks   | Off the server (object storage)         |
| Monthly   | 6 months  | Off the server, separate credentials    |

A cron entry on the production host, running as the deploy user:

```cron
# Daily at 03:15 server time, then prune dumps older than 7 days.
15 3 * * * cd /srv/academia && ./scripts/db-backup.sh prod >> /var/log/academia-backup.log 2>&1 && find backups -name '*.dump' -mtime +7 -delete
```

Two requirements that are easy to skip and expensive to skip:

- **Copy backups off the host.** A backup on the same disk as the database does
  not survive losing the host.
- **Restrict access.** A dump contains every user record. `chmod 600`, and
  treat the storage bucket as production-sensitive.

## Restoring

```bash
./scripts/db-restore.sh dev  backups/academia-prod-20260912T031500Z.dump
./scripts/db-restore.sh prod backups/academia-prod-20260912T031500Z.dump
```

Restoring is destructive: `pg_restore --clean --if-exists` drops and recreates
the objects in the dump. Restoring into production therefore requires typing
`RESTORE-PRODUCTION`; there is no flag to bypass the prompt.

`--exit-on-error` is set, so a partial restore fails loudly instead of leaving a
half-populated database.

After restoring, apply any migrations authored after the dump was taken:

```bash
npm run db:deploy
```

## Restore drill

An untested backup is a hope, not a backup. Verify quarterly, and after any
change to the schema tooling:

```bash
# 1. Take a production backup.
./scripts/db-backup.sh prod

# 2. Restore it into development — never test a restore in production.
./scripts/dev-down.sh --volumes
npm run dev
./scripts/db-restore.sh dev backups/academia-prod-<timestamp>.dump

# 3. Apply migrations and confirm the stack is healthy.
npm run db:deploy
curl -fsS http://localhost:4000/health

# 4. Confirm the data is actually there.
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'select count(*) from users;'
```

Record the date and outcome of each drill in the pull request or ops log.

## Recovery targets

Set explicitly, so a decision is not improvised during an incident:

| Target                          | Value                                       |
| ------------------------------- | ------------------------------------------- |
| RPO (acceptable data loss)      | 24 h with daily backups                     |
| RTO (acceptable downtime)       | ~1 h: provision, restore, redeploy, verify  |

Tightening the RPO below 24 h requires continuous archiving (WAL shipping or a
managed provider feature). That is a deliberate later decision, not a gap to
paper over.

## Losing the host entirely

1. Provision a new host with Docker and Docker Compose.
2. Clone the repository to `DEPLOY_PATH`.
3. Restore `.env` from the password manager. It is not in any backup.
4. `./scripts/prod-up.sh` to build and start the stack, creating an empty database.
5. `./scripts/db-restore.sh prod <latest offsite dump>`.
6. `npm run db:deploy`, then `./scripts/health-check.sh prod`.
7. Repoint DNS and re-issue TLS certificates.
