# Infrastructure

## Environments

Two environments, isolated by construction.

|                    | Development                    | Production                        |
| ------------------ | ------------------------------ | --------------------------------- |
| Compose project    | `academia-dev`                 | `academia-prod`                   |
| Database volume    | `academia-dev_db_data_dev`     | `academia-prod_db_data`           |
| Database host port | published (`5433` by default)  | **not published** (internal only) |
| API host port      | published (`4000`)             | **not published** (internal only) |
| Web host port      | `3000`                         | `3000`, behind a TLS terminator   |
| Images             | `*.dev.Dockerfile`, bind mounts | multi-stage, immutable, non-root |
| Payment mode       | sandbox / test (later stages)  | live (later stages)               |
| Seed data          | optional (`LOAD_SEED_DATA`)    | forbidden — refuses to start      |

Isolation rests on `COMPOSE_PROJECT_NAME`, which namespaces volumes and networks.
`scripts/compose.sh` derives it from the environment you name, so a development
command cannot attach to production data, and every script prints the project it
is about to act on.

To run an extra stack alongside these two — a staging check, or a rehearsal of a
production change — export `ACADEMIA_PROJECT` for that one command:

```bash
ACADEMIA_PROJECT=academia-staging ./scripts/prod-up.sh
```

The override is deliberately *not* `COMPOSE_PROJECT_NAME`: that variable is
widely used and may already be exported in a shell for something else, and
inheriting it would silently aim a destructive command such as
`dev-down.sh --volumes` at the wrong stack.

Nothing is shared between environments: not the database, credentials, secrets,
API keys, session secrets, internal URLs or user data.

## Compose files

```
docker-compose.yml         base topology, never used alone
docker-compose.dev.yml     development override
docker-compose.prod.yml    production override
```

Always combined, which the scripts do for you:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml  up
docker compose -f docker-compose.yml -f docker-compose.prod.yml up
```

The base file defines the topology, environment wiring and healthchecks once; the
overrides carry only what genuinely differs. Each service receives only the
variables it needs — the web container is never given `DATABASE_URL` or
`AUTH_SECRET`.

Startup is ordered by health, not by luck: `db` healthy → `api` healthy → `web`.

### How the browser reaches the API

The browser only ever talks to the web service. Next.js rewrites `/api/:path*` to
`API_INTERNAL_URL`, so requests are same-origin: the session cookie needs no
`SameSite=None`, CORS is unnecessary, and in production the API publishes no host
port at all.

`API_INTERNAL_URL` is a **build argument**, not just a runtime variable. Next.js
serializes rewrite destinations into the build output, so a value supplied only at
runtime leaves the standalone server proxying `/api` to its own localhost — which
fails in production while working in development, because `next dev` re-evaluates
the config at startup. `docker-compose.prod.yml` therefore passes it through
`build.args`, defaulting to the Compose service name `http://api:4000`.

Consequence: pointing the API at a different address means rebuilding the web
image, or putting a reverse proxy in front of it.

## Configuration and secrets

All configuration comes from environment variables. `apps/api/src/config/env.ts`
is the single contract: a Zod schema parsed once at boot, which refuses to start
on an invalid environment and never echoes a value into an error message.

Cross-field invariants live in `evaluateConfiguration()` and are used twice: at
boot (fatal in production) and by `/health` (reported as
`configuration: fail`). In production the process refuses to start if
`AUTH_SECRET` still holds the `.env.example` sample value, or if
`LOAD_SEED_DATA` is true.

Rules:

- `.env.example` is committed and contains no real value. CI enforces this.
- `.env`, `.env.local`, `.env.*` are gitignored. CI fails if one is tracked.
- Production values live in the server's `.env` (managed out of band) or in
  GitHub Secrets. They never pass through a workflow log.
- Generate secrets with `openssl rand -base64 48`.

### `DATABASE_URL` has two forms

This is the one piece of configuration that differs by caller:

- **Containers** — Compose passes the discrete `POSTGRES_*` variables, and each
  entrypoint assembles the URL with `docker/database-url.mjs`, targeting
  `db:5432`. The `POSTGRES_*` variables are the single source of truth for
  credentials.
- **Host tooling** (`npm run db:migrate` from your shell) — uses the
  `DATABASE_URL` in `.env`, which targets `localhost:${POSTGRES_PORT}`.

Containers assemble the URL rather than receive it assembled because a password
cannot be safely interpolated into one. `openssl rand -base64` emits `/`, which
makes the URL unparseable; `database-url.mjs` percent-encodes every component and
validates the port. The assembled URL is captured into a variable and never
echoed, so it stays out of logs and process listings.

For a managed database whose provider issues a ready-made connection string, set
`DATABASE_URL_OVERRIDE`. It is passed through verbatim, so it must already be
correctly encoded.

Two guards back this up: `describeDatabaseUrlProblem()` in
`apps/api/src/config/env.ts` rejects a malformed URL, and
`apps/api/src/config/preflight.js` runs in the entrypoint *before* migrations, so
a misconfiguration fails immediately with a named reason instead of exhausting 30
connection retries. Neither ever prints a value.

### GitHub Secrets

Only what is needed to reach the host:

| Secret           | Purpose                                     |
| ---------------- | ------------------------------------------- |
| `DEPLOY_SSH_KEY` | Private key for the deployment user         |
| `DEPLOY_HOST`    | Production hostname or IP                   |
| `DEPLOY_USER`    | SSH user (unprivileged, may run Docker)     |
| `DEPLOY_PATH`    | Absolute path to the checkout on the server |

Plus the repository variable `PRODUCTION_URL`, used for the post-deploy check.

Application secrets are intentionally **not** GitHub Secrets: keeping them in the
server's `.env` means a compromised workflow cannot leak a database or payment
credential.

## Database and migrations

PostgreSQL 17. Prisma 7 with the `pg` driver adapter; the connection URL is
supplied at runtime through `prisma7.config.ts`.

Naming convention: tables, columns and enum types are snake_case in the database
(via `@map` / `@@map`), while the generated TypeScript client stays camelCase.
PostgreSQL folds unquoted identifiers to lowercase, so a camelCase column has to
be double-quoted in every hand-written query — in `psql`, during a restore, or
from a reporting tool. Models added in later stages must follow this.

Migrations are committed SQL under `apps/api/prisma/migrations/`, applied in
order with `prisma migrate deploy`:

- **Authoring** is an explicit developer action: `npm run db:migrate`.
- **Applying** happens in the API container entrypoint, retried while the
  database settles, and fails the container if it cannot complete.
- A container never generates a migration. `migrate deploy` only applies what is
  committed, so it cannot invent or reorder a change.
- CI applies every migration to an empty PostgreSQL on each run, which is what
  proves they are reproducible.

Destructive statements (`DROP DATABASE`, `DROP TABLE`, `TRUNCATE`) never appear
in an automated path. The only destructive tool is
`scripts/db-restore.sh`, which requires typing `RESTORE-PRODUCTION` to touch
production.

Development seed data is gated behind `LOAD_SEED_DATA` and is rejected in
production.

## Healthchecks

| Service    | Check                                                      |
| ---------- | ---------------------------------------------------------- |
| PostgreSQL | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`              |
| API        | `GET /health` — 200 only when the database answers `SELECT 1` |
| Web        | `GET /` returns 200                                        |

The API healthcheck uses the real contract rather than a page that happens to
return 200, so a database outage marks the container unhealthy. With a 15 s
interval and 5 retries, a sustained outage flips the container after roughly
75 s — long enough not to flap on a transient blip.

The web image sets `HOSTNAME=0.0.0.0`. Next.js' standalone server otherwise binds
to `$HOSTNAME`, which Docker sets to the container ID; that resolves to a single
interface, so the loopback probe cannot connect and the container never reports
healthy even while serving traffic normally.

`scripts/health-check.sh` verifies all three container states plus the `/health`
body, and exits non-zero. The production deploy runs it.

## Logging

`pino`, structured JSON to stdout, collected by Docker.

Redaction is configured centrally in `apps/api/src/lib/logger.ts`:
`authorization` and `cookie` headers, `set-cookie`, and any `password`,
`passwordHash`, `token`, `secret`, `AUTH_SECRET`, `DATABASE_URL` or
`SUPERADMIN_PASSWORD` field. `no-console` is an ESLint error, so nothing bypasses
the logger.

Health probes are excluded from request logging to keep the signal readable.
Error tracking, metrics, tracing and alerting are Stage 9; the logger is the seam
they attach to.

## CI

`.github/workflows/ci.yml` runs on every pull request and push to `main`:

| Job                | What it proves                                                     |
| ------------------ | ------------------------------------------------------------------ |
| `verify`           | install → build shared → generate client → lint → typecheck → unit tests → build |
| `integration`      | migrations apply to an empty PostgreSQL, then the integration suite |
| `docker`           | both production images build from a clean context                  |
| `secrets-hygiene`  | no tracked `.env`, no filled-in secret in `.env.example`, no key material |

Action versions are pinned by major tag, npm downloads are cached, and every job
fails the run on error.

## Production deployment

```
feature/*  →  Pull Request  →  CI  →  review  →  main  →  Production workflow
```

`.github/workflows/production.yml` triggers only on push to `main` or a manual
dispatch. It calls `ci.yml` as a reusable workflow, so deployment cannot happen
unless the identical checks pass — no duplicated pipeline definition.

The deploy job:

1. binds to the `production` GitHub Environment (reviewers, wait timers and
   environment secrets apply);
2. connects over SSH with a pinned host key;
3. resets the server checkout to the exact deployed commit;
4. asserts the server `.env` exists;
5. runs `scripts/prod-up.sh` — build → db → api (migrations in the entrypoint) →
   web → `health-check.sh`;
6. verifies the public URL responds.

Deployments never run concurrently and are never cancelled midway: an interrupted
migration is worse than a queued deploy.

### Server prerequisites

- Docker and Docker Compose.
- A git checkout at `DEPLOY_PATH` whose `origin` is this repository.
- A `.env` in that directory with production values, readable only by the deploy
  user (`chmod 600`).
- A TLS terminator (nginx, Traefik or Caddy) in front of the published web port.
  The compose stack does not terminate TLS.

### Rollback

```bash
cd "$DEPLOY_PATH"
git log --oneline -10          # find the last good commit
git reset --hard <good-sha>
./scripts/prod-up.sh           # rebuild, restart, re-verify health
```

Rolling back application code is safe. Rolling *back* a migration is not
automatic: forward-only migrations are the default, and a schema change that must
be undone needs a new migration that reverses it. If a deployment fails, the
previous containers keep serving until the new ones are healthy.

Before any risky deployment, take a backup: `./scripts/db-backup.sh prod`.
