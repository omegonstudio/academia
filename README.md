# Academia — Omegon

Operational platform for a Spanish-language academy: teacher training, teacher
network, student assignment, classes, tracking and settlements.

**Current stage: Stage 7B — Student Finance Portal DONE** (read-only
`/dashboard/student/finance`). Stages 0–8 remain operable. See
[`TODO.md`](TODO.md) and [`ROUTE-MAP.md`](ROUTE-MAP.md).
Branching: [`docs/BRANCHING.md`](docs/BRANCHING.md) (`feature/*` → `dev` → `main`).

## Stack

| Layer    | Choice                                              |
| -------- | --------------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript       |
| Backend  | Node.js 22, Express 5, TypeScript                   |
| Database | PostgreSQL 17, Prisma 7 (versioned migrations)       |
| Objects  | S3-compatible (MinIO development / Spaces production)|
| Runtime  | Docker + Docker Compose, separate dev and prod       |
| CI/CD    | GitHub Actions                                      |

## Quick start

Requires Docker, Docker Compose and Node.js 22.

```bash
cp .env.example .env      # then edit: set POSTGRES_PASSWORD, AUTH_SECRET, SUPERADMIN_PASSWORD
npm install
npm run dev               # preferred: builds, starts db + api + web, waits for health
```

Generate local secrets with `openssl rand -base64 48`.

`.env.example` sets `COMPOSE_FILE` + `COMPOSE_PROJECT_NAME=academia-dev`, so bare
Compose matches the development pair:

```bash
docker compose up --build -d    # same files as npm run dev (waits less; prefer npm run dev)
docker compose down             # or: npm run dev:down
```

Compose files are **always paired** (base + one override). Using either file alone
fails with “neither an image nor a build context”. Equivalent explicit form:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

Default development stack is **db + api + web**. MinIO (Materials) is optional:

```bash
docker compose --profile materials up --build -d
```

Once up:

| URL                             | What                                    |
| ------------------------------- | --------------------------------------- |
| http://localhost:3000           | Web (public site)                       |
| http://localhost:3000/login     | Login                                   |
| http://localhost:3000/dashboard/membership | Membership plans UI (session required) |
| http://localhost:3000/api/health | API health via Next rewrite            |
| http://localhost:3000/api/docs  | Swagger UI (dev; gated in production)   |
| http://localhost:3000/api/openapi.json | OpenAPI 3 document                |
| http://localhost:4000/health    | API health (direct, development only)   |
| localhost:5433                  | PostgreSQL (host port, development only) |
| http://localhost:9000           | MinIO S3 API (`--profile materials`)    |
| http://localhost:9001           | MinIO console (`--profile materials`)   |

Development MinIO defaults (also in `.env.example`): bucket `academia-materials`,
access key `academia-dev-access-key`, secret `academia-dev-secret-key`.

```bash
npm run dev:logs          # tail logs
npm run dev:down          # stop, keeping the database volume
./scripts/dev-down.sh --volumes   # stop and discard the database
npm run smoke             # login → dashboard → membership → logout (needs SUPERADMIN_*)
```

The `SUPERADMIN_EMAIL` account (default `omegon.info@gmail.com`) is provisioned
on startup when `SUPERADMIN_PASSWORD` is set. It is never created with a
hardcoded password, and an existing password is never overwritten.

## Everyday commands

```bash
npm run lint              # ESLint across all workspaces
npm run typecheck         # tsc --noEmit across all workspaces
npm run test              # unit suites (no database needed)
npm run build             # shared -> api -> web
./scripts/test-integration.sh     # integration suite against the dev database
```

Database:

```bash
npm run db:migrate        # author a migration after changing schema.prisma
npm run db:deploy         # apply pending migrations (what production runs)
npm run db:seed           # run the SuperAdmin bootstrap
```

## Documentation

| Document                                             | Contents                                       |
| ---------------------------------------------------- | ---------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)         | Layout, request flow, domain boundaries        |
| [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md)     | Docker, environments, secrets, CI/CD, rollback |
| [docs/BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md)     | Backup strategy, retention, restore drill      |
| [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md)        | WCAG 2.2 AA baseline and token contrast        |
| [docs/DECISIONS.md](docs/DECISIONS.md)               | Architecture decisions and their rationale     |
| [docs/API-SMOKE.md](docs/API-SMOKE.md)               | Manual API smoke + Insomnia/Swagger cookie flow |
| [docs/LAQQ-REFERENCE.md](docs/LAQQ-REFERENCE.md)     | Which LaQQ patterns were adopted, and which not |
| [MASTER-PROMPT.md](MASTER-PROMPT.md)                 | Product brief and infrastructure requirements  |

## Non-negotiables

- Business rules and authorization are enforced server-side, never in the UI.
- No real secret is ever committed. `.env*` is gitignored except `.env.example`.
- Development and production never share a database, a secret or a credential.
- Migrations are authored by a developer and committed; containers only apply them.
- No feature is shipped that pretends to work. Future actions are labelled
  `Próximamente` or are absent.
