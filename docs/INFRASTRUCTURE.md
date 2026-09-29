# Infrastructure

## Environments

Two environments, isolated by construction.

|                    | Development                    | Production                        |
| ------------------ | ------------------------------ | --------------------------------- |
| Compose project    | `academia-dev`                 | `academia-prod`                   |
| Database volume    | `academia-dev_db_data_dev`     | `academia-prod_db_data`           |
| Object storage     | MinIO service + `minio_data_dev` | DigitalOcean Spaces (external)  |
| Database host port | published (`5433` by default)  | **not published** (internal only) |
| API host port      | published (`4000`)             | **not published** (internal only) |
| Web host port      | `3000`                         | `3000`, behind a TLS terminator   |
| MinIO ports        | `9000` (API) / `9001` (console)| **not present**                   |
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
# Preferred (sets COMPOSE_PROJECT_NAME=academia-dev, waits for healthy):
npm run dev

# Bare compose (when .env has COMPOSE_FILE from .env.example):
docker compose up --build -d

# Equivalent raw compose (never use either file alone):
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Running `docker compose -f docker-compose.dev.yml …` **alone** fails with
`has neither an image nor a build context` — that is expected: the base file owns
health/env wiring; the override owns `build`/`ports`/`volumes`.

### Dev `node_modules` anonymous volumes

`docker-compose.dev.yml` bind-mounts sources and `package-lock.json`, and keeps
`/app/node_modules` in anonymous volumes so the host install cannot fight the
container. Those volumes are seeded once from the image. After dependency
changes, the API/web **dev entrypoints** compare a hash of `package-lock.json`
and re-run `npm ci` when it drifts (`docker/sync-node-modules.sh`). Rebuild +
recreate the service after adding packages (`npm run dev`, or recreate `api`/`web`);
do **not** delete the named PostgreSQL volume.

The API also mounts an anonymous volume at `/app/apps/api/src/generated` so
`prisma generate` is not blocked by root-owned gitignored files left on the host
from an earlier container run. If host `npm run build` / `prisma generate` hits
`EACCES` on that tree, clear it with the **native** Docker socket (not Desktop's
VM root mapping) and regenerate:

```bash
DOCKER_HOST=unix:///var/run/docker.sock docker run --rm \
  -v "$PWD/apps/api/src/generated:/out" \
  -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  alpine:3.20 sh -c 'rm -rf /out/*; chown "$HOST_UID:$HOST_GID" /out'
npm run prisma:generate -w @academia/api
```

Startup is ordered by health, not by luck: `db` healthy → `api` healthy → `web`.
MinIO is **development-only** and lives under Compose profile `materials`
(`docker compose --profile materials up`). Auth, membership UI, and most routes
do not need MinIO. Production API talks to DigitalOcean Spaces via the same
`S3_*` environment variables.

Web smoke (session + membership, no payments):

```bash
npm run smoke    # scripts/smoke-web.sh — requires SUPERADMIN_* in .env
```

If host ports `3000` / `4000` / `5433` are already taken (stale `docker-proxy`
from an old stack), free them or override for one run:

```bash
POSTGRES_PORT=15433 API_PORT=14000 WEB_PORT=13000 npm run dev
WEB_PORT=13000 npm run smoke
```

### Object storage (Materials — Stage 5B)

|                    | Development                         | Production                |
| ------------------ | ----------------------------------- | ------------------------- |
| Provider           | MinIO (`minio` Compose service; image from `quay.io/minio/*`) | DigitalOcean Spaces |
| Endpoint (typical) | `http://minio:9000` (ops) + `S3_PUBLIC_ENDPOINT` for signed URLs | Spaces regional endpoint |
| Bucket             | `academia-materials` (created by `minio-init`) | private Spaces bucket |
| Credentials        | Compose defaults (`academia-dev-*`)    | Spaces keys (secrets)     |
| Path style         | `S3_FORCE_PATH_STYLE=true`          | usually `false`           |

Host tooling against MinIO: API `http://127.0.0.1:9000`, console
`http://127.0.0.1:9001`. Compose sets `S3_ENDPOINT=http://minio:9000` for
server-side ops and `S3_PUBLIC_ENDPOINT=http://127.0.0.1:9000` so presigned
URLs work from the host browser. See `.env.example`. Never promote MinIO sample
keys to production (`evaluateConfiguration` rejects them when
`NODE_ENV=production`).

### How the browser reaches the API

The browser only ever talks to the web service. The App Router handler
`apps/web/src/app/api/[...path]/route.ts` proxies `/api/*` to `API_INTERNAL_URL`
at **request time**, so requests stay same-origin: the session cookie needs no
`SameSite=None`, CORS is unnecessary, and in production Compose the API
publishes no host port at all.

`API_INTERNAL_URL` is a **runtime** variable for both the proxy and
`getSession()`. Default in Compose is the service name `http://api:4000`.

`NEXT_PUBLIC_APP_URL` remains a **build** input: Next.js inlines `NEXT_PUBLIC_*`
into the client bundle, so canonicals, Open Graph URLs, `robots.txt` and
`sitemap.xml` would otherwise ship as `http://localhost:3000`.
`docker-compose.prod.yml` passes it through `build.args` (and still passes
`API_INTERNAL_URL` as a build arg for image parity; only the runtime value is
required for the proxy).

### Vercel Services (optional parallel path)

`vercel.json` at the repo root defines two services: `web` (public at `/`) and
`api` (internal). A service binding injects the API base URL into `web` as
`API_INTERNAL_URL` — do not set that variable yourself in the Vercel dashboard.

Set manually on the Vercel project (Production / Preview as needed):

- `DATABASE_URL` (Postgres reachable from Vercel)
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL` (the deployment URL; rebuild after changing)
- S3 / object-storage vars used by the API (`S3_*`)
- any other keys required by `apps/api/src/config/env.ts`

Run migrations out of band (`npm run db:deploy`) before relying on the API.
The primary production path documented below remains Compose on a VPS.

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
- Compose interpolates `$VAR` / `${VAR}` in `.env` values. Write a literal
  `$` as `$$`. The recommended generator never emits `$`; pasting a password
  that contains one without escaping rewrites the secret (silently when the
  name exists in the host environment).

`NEXT_PUBLIC_APP_URL` is a build-time input for the web image (inlined into the
client bundle). `API_INTERNAL_URL` is read at runtime by the `/api` proxy and by
`getSession()`; Compose still passes it as a build arg for convenience and sets
it on the running web container.

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

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`
(and should also cover `dev` once that branch is protected — see
`docs/BRANCHING.md`):

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
feature/stage-N-*  →  PR →  CI  →  review  →  dev
dev                →  PR →  CI  →  review  →  main  →  Production workflow
```

Never commit product work directly to `main`. Stage work integrates on `dev`
first; promote a finished Stage (or explicit slice) with a PR `dev` → `main`.
Full rules: `docs/BRANCHING.md`.

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
