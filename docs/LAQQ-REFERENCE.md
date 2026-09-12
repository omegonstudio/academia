# LaQQ as an architectural reference

LaQQ is another Omegon project, used here as a source of **proven operational
patterns**. It is not a dependency, and none of its business logic was copied.
Academia builds, runs, tests and deploys without LaQQ present.

## What LaQQ actually is

Worth stating plainly, because it constrains what can transfer:

| Layer    | LaQQ                              | Academia                    |
| -------- | --------------------------------- | --------------------------- |
| Backend  | Django 4.2 + DRF (Python)         | Node.js 22 + Express 5 (TS) |
| Frontend | Vite + React SPA                  | Next.js 16 App Router       |
| ORM      | Django ORM                        | Prisma 7                    |
| Database | PostgreSQL 15                     | PostgreSQL 17               |
| Host     | DigitalOcean droplet + Nginx      | Docker Compose + TLS terminator |

So LaQQ's *application* layer is not transferable at all. Its **operational**
layer is, and that is what was mirrored.

## Patterns adopted

| Pattern                                                          | Where it lives in Academia                     |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| Compose at the repository root, services `db` / `api` / `web`     | `docker-compose.yml`                           |
| Separate dev and prod compose definitions                         | `docker-compose.{dev,prod}.yml`                |
| Wrapper scripts (`dev-up`, `dev-down`, `dev-logs`, `prod-up`)      | `scripts/`                                     |
| Health-gated startup ordering (`depends_on: service_healthy`)      | `docker-compose.yml`                           |
| `pg_isready` healthcheck on PostgreSQL                            | `docker-compose.yml`                           |
| Entrypoint waits for the database, then applies migrations         | `docker/api-entrypoint.sh`                     |
| Migrations applied on container start (right fit for VPS + Compose) | `docker/api-entrypoint.sh`                     |
| Named volumes, distinct per environment                            | `docker-compose.{dev,prod}.yml`                |
| Multi-stage production images running as a non-root user           | `docker/api.Dockerfile`, `docker/web.Dockerfile` |
| Database not exposed to the host in production                     | `docker-compose.prod.yml`                      |
| Same-origin browser topology — one public port, `/api` proxied      | `apps/web/next.config.ts` rewrite              |
| CI validates before deploy; deploy over SSH, rebuild on the server  | `.github/workflows/`                           |
| Post-deploy verification of container health                        | `scripts/health-check.sh`                      |
| Idempotent reference-data provisioning                              | `apps/api/src/seed/bootstrap.ts`               |
| A flag separating rich dev data from clean production               | `LOAD_SEED_DATA`                               |
| Central `.env.example` plus an aggressive `.gitignore`              | `.env.example`, `.gitignore`                   |

Note on the same-origin pattern: LaQQ achieves it with Nginx proxying `/api` to
Gunicorn. Academia achieves the same shape with a Next.js rewrite, because the
frontend is a server, not a static bundle. The *pattern* transferred; the
mechanism differs by necessity.

## Patterns deliberately not adopted

Each of these is a real weakness found in LaQQ's current state. Academia does the
opposite on purpose.

| LaQQ practice                                                       | What Academia does instead                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| No real health endpoint; Docker probes `/admin/login/`               | `GET /health` runs `SELECT 1` and separates `configuration` from `database`                 |
| SuperAdmin hardcoded in the entrypoint with a fixed address           | Bootstrap reads `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`; never hardcoded, never overwrites an existing password |
| `makemigrations` runs automatically in the dev entrypoint            | Containers only ever run `migrate deploy`; authoring a migration is an explicit developer action |
| Real-looking credentials committed in `Backend/.env.example`          | `.env.example` holds placeholders only, and CI fails the build if that changes              |
| JWTs encrypted in `localStorage` with a key shipped to the browser    | `HttpOnly` `SameSite=Lax` cookie; client JavaScript never touches the token                 |
| `strict: false` in the frontend `tsconfig`                            | `strict: true` everywhere, plus `noUncheckedIndexedAccess` and `noUnusedLocals`             |
| CI runs a subset of backend tests and never runs the frontend suite   | CI runs lint, typecheck, unit, integration, build and image builds                          |
| No log redaction, no request correlation                              | `pino` with a central redaction list; `no-console` enforced by ESLint                        |
| Two competing Docker stacks (root, plus a legacy one with PgBouncer)  | One stack: base plus exactly two overrides                                                  |
| Python version differs between Docker (3.11), CI (3.13) and the README | Node 22 pinned in `.nvmrc`, `engines`, every Dockerfile and CI                              |
| Lockfiles ignored in git                                              | `package-lock.json` committed; CI uses `npm ci`                                             |
| Domains and CORS defaults hardcoded in settings                        | Every environment-specific value comes from a validated environment variable                 |
| Connection via discrete `DB_*` variables, no `DATABASE_URL`            | One `DATABASE_URL`, derived in Compose from `POSTGRES_*`                                     |

## Standing rule

> LaQQ is an architectural reference, not a dependency of Academia.

When a LaQQ pattern is considered in the future, evaluate it on merit. Adopt what
is proven; do not inherit what is merely historical. Record the outcome in
[DECISIONS.md](DECISIONS.md).
