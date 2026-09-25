# Architecture

## Repository layout

```
academia/
├── apps/
│   ├── api/                  Node.js + Express + Prisma
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/    committed, versioned, applied in order
│   │   └── src/
│   │       ├── config/        environment contract (zod)
│   │       ├── domain/        business rules, framework-free
│   │       │   └── identity/
│   │       ├── http/          Express: routes, middleware, error envelope
│   │       ├── lib/           logger, password, cookies, database
│   │       ├── seed/          idempotent SuperAdmin bootstrap
│   │       └── generated/     Prisma client (gitignored, regenerated)
│   └── web/                  Next.js App Router
│       └── src/
│           ├── app/           routes, metadata, robots, sitemap
│           ├── components/    reusable UI
│           └── lib/           session access, site config
├── packages/
│   └── shared/               contracts shared by web and api
├── docker/                   Dockerfiles and entrypoints
├── scripts/                  dev/prod/backup/health operations
└── .github/workflows/        CI and production deployment
```

Three npm workspaces: `@academia/api`, `@academia/web`, `@academia/shared`.

## Request flow

```
Browser
  │  same-origin request to /api/*
  ▼
Next.js server (apps/web)          ── rewrite ──▶  API (apps/api)
  │  server components call the API directly                │
  │  via API_INTERNAL_URL                                   ▼
  │                                                  PostgreSQL
  ▼
HTML
```

The browser never addresses the API directly. `next.config.ts` rewrites
`/api/:path*` to the API service, so:

- requests are same-origin, and the session cookie needs no cross-site relaxation;
- CORS is unnecessary in the default topology;
- in production the API publishes no host port at all.

`CORS_ALLOWED_ORIGINS` exists for a future deployment that gives the API its own
hostname. It is empty by default.

## Shared contracts

`packages/shared` holds the types and Zod schemas that both sides must agree on:
the role enum, the login request, the session user and the health response. The
API validates incoming requests with the same schema the web app builds requests
against, so a drift becomes a type error rather than a runtime bug.

The Prisma `Role` enum mirrors `ROLES` in the shared package. Both must change
together; the schema says so at the definition site.

## Layering in the API

```
http/       transport: parsing, status codes, cookies, error envelope
  ↓
domain/     rules: authentication, and later the academy domains
  ↓
lib/        infrastructure: database, hashing, logging
```

The domain depends on interfaces, not on Prisma. `UserRepository` is declared in
`domain/identity/user-repository.ts`; the Prisma implementation lives in the same
file, and an in-memory one in `src/test`. That is why the authentication rules
are unit-tested without a database.

`createApp()` takes its dependencies as arguments and binds no port. `server.ts`
owns the process concerns: environment parsing, database construction, listening
and graceful shutdown.

## Authentication

Session tokens are JWTs (HS256, `jose`) delivered in an `HttpOnly`, `SameSite=Lax`
cookie — `Secure` in production. Client JavaScript never handles the token.

Passwords use scrypt from `node:crypto`. The chosen cost parameters are stored
inside each hash, so they can be raised later without invalidating existing
hashes, and no native build toolchain is needed in the image.

Two rules matter more than the mechanism:

1. **Every authenticated request reloads the user from the database.** The role
   inside the token is only a hint. A deactivated account or a changed role takes
   effect immediately instead of at token expiry.
2. **Failure modes are indistinguishable.** Unknown email, wrong password and
   deactivated account all answer `401 Invalid email or password.` A hash is
   verified even when no user matched, so response time does not reveal whether
   an address is registered.

Login is throttled per IP in-process (fixed window). A shared store is required
before running more than one API replica; that is a Stage 9 task.

## Error and health contracts

Every failure is `{ error: { code, message } }`. `code` is stable for clients;
unexpected exceptions are logged in full and answered with a generic 500 so no
stack trace or driver message escapes.

`GET /health` answers 200/`ok` or 503/`degraded` and separates `configuration`
from `database` so an operator can tell a misconfiguration from an outage. It
exposes no hostnames, connection strings or reasons. Container and deployment
probes use it directly.

## What is deliberately absent

Stage 0 models identity only. There is no Student, Teacher, Course,
ClassSession, Material, Payment or Settlement model, and no payment provider
integration. Those arrive with the stages that own them.

When payments do arrive, the boundary is already decided:

```
Student → Payment domain → Payment provider adapter → Mercado Pago | Stripe
                                     ↓
                            Finance (academyPercentage ∈ {20,30,40,50};
                                     default 40; teacher = 100 − academy)
```

Providers are never called from the frontend. The split is academy-level
current config (SUPER_ADMIN/DIRECTOR mutate only); historical financial
operations use Freeze (frozen share on the record; later config changes do not
rewrite them). Money math lives in the backend Finance domain with tests. See
`docs/DECISIONS.md` (41).