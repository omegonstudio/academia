# Architecture decisions

Decisions taken during Stage 0, with the reasoning that justified them. Revisit a
decision by adding an entry; do not silently reverse one.

---

## 1. Stage 0 is greenfield, contrary to the brief

**Context.** `MASTER-PROMPT.md` stated that the work sat on an existing
repository, that Next.js and Node.js were already connected, and that existing
architecture should be reused rather than replaced. The audit found the
repository contained 7 tracked files: markdown documents and Cursor rules. No
code, no `package.json`, no database, no authentication.

**Decision.** Treat Stage 0 as greenfield and build the infrastructure from
nothing. Correct the brief instead of leaving the contradiction in place.

**Consequence.** The "audit existing X" and "do not duplicate existing
infrastructure" tasks were satisfiable trivially: there was nothing to preserve.
Every technology choice below is therefore an original decision, not an
adaptation.

---

## 2. npm workspaces monorepo, not two repositories

**Decision.** One repository with `apps/api`, `apps/web` and `packages/shared`.

**Why.** The frontend and backend must agree on the role enum, the login payload
and the session shape. A shared workspace package turns a disagreement into a
compile error. npm workspaces need no extra tooling — no pnpm, no Turborepo — and
`package-lock.json` covers the whole tree, so `npm ci` is reproducible.

**Cost.** Docker builds must copy the workspace manifests before installing, and
the shared package must be built before either app. Both are handled in the
Dockerfiles and CI.

---

## 3. Express 5, not Fastify or NestJS

**Decision.** Express 5 with Zod for validation.

**Why.** The requirement is input validation, consistent error handling and
server-side authorization — Express plus Zod covers all three in very little
code. Express 5 propagates async rejections to the error handler natively, which
removed the main historical reason to avoid it. NestJS would impose a large
framework for a Stage 0 with three endpoints. Fastify's schema validation would
duplicate what Zod already does in the shared package.

**Revisit if.** Throughput becomes a constraint, or the route count grows enough
that Nest's module system earns its overhead.

---

## 4. Prisma 7, pinned, with the `pg` driver adapter

**Decision.** Pin `prisma` and `@prisma/client` to exactly `7.10.0`.

**Why.** `npm view prisma version` reports `8.0.0-rc.14` — the `latest` tag
currently points at a release candidate. Shipping infrastructure on an RC is not
acceptable; `7.10.0` is the current stable release (`prev` tag).

**Notes on Prisma 7.** Three changes affect this repository:

- The datasource URL is no longer read from `schema.prisma`; it comes from
  `prisma7.config.ts`. That file loads the root `.env` explicitly, because the
  CLI runs with `apps/api` as its working directory.
- The `prisma-client` generator emits TypeScript into `src/generated/prisma`,
  compiled by our own `tsc`. It is gitignored and regenerated on every build.
  Verified to pass our full strict configuration.
- A driver adapter is required, so `@prisma/adapter-pg` supplies the connection.
  No native query-engine binary is downloaded.

---

## 5. The Prisma CLI is a runtime dependency

**Decision.** `prisma` and `dotenv` are `dependencies`, not `devDependencies`, in
`apps/api`.

**Why.** The container entrypoint runs `prisma migrate deploy` at startup —
LaQQ's proven pattern for a Compose-on-VPS deployment. With `npm ci --omit=dev`
in the runtime stage, a devDependency CLI would be absent.

**Alternative rejected.** A separate migration job or init container is cleaner
in orchestrators that support ordering primitives. It adds moving parts that
Compose does not need, and it can be introduced later without changing the
schema or the migrations.

---

## 6. scrypt from `node:crypto`, not argon2 or bcrypt

**Decision.** Password hashing uses `node:crypto`'s scrypt, storing the cost
parameters inside each hash as `scrypt$N$r$p$salt$key`.

**Why.** argon2 and bcrypt both pull a native module, which means a build
toolchain in the image and a recurring source of platform-specific breakage.
scrypt is a memory-hard KDF in the standard library, needs no dependency, and is
appropriate for password storage. Embedding the parameters allows raising the
cost later without invalidating existing hashes.

**Revisit if.** A compliance requirement names Argon2id specifically.

---

## 7. Session in an HttpOnly cookie, verified against the database each request

**Decision.** A JWT (HS256, `jose`) in an `HttpOnly`, `SameSite=Lax`, `Secure`
in production cookie. Every authenticated request reloads the user.

**Why.** The token being unreachable from JavaScript removes the entire class of
XSS token theft. LaQQ stores JWTs in `localStorage` encrypted with a key shipped
to the browser, which provides no real protection; that pattern was explicitly
not copied.

Reloading the user on each request is the important half: the role inside the
token is only a hint, so deactivating an account or changing a role takes effect
immediately rather than at token expiry. The cost is one indexed primary-key
lookup per request.

---

## 8. Browser reaches the API through a Next.js rewrite

**Decision.** `/api/:path*` is rewritten to `API_INTERNAL_URL`. In production the
API publishes no host port.

**Why.** Requests become same-origin, so the session cookie needs no
`SameSite=None`, no CORS configuration, and the API is not directly addressable
from the internet. This mirrors LaQQ's Nginx-proxies-`/api` topology using the
server we already run.

**Consequence.** `CORS_ALLOWED_ORIGINS` exists and is wired into the Express
app, but is empty by default for the same-origin rewrite topology. Unit coverage
for the CORS middleware itself is deferred until a deployment exposes the API on
its own hostname.

---

## 9. Compose base file plus two overrides

**Decision.** `docker-compose.yml` (base) combined with either
`docker-compose.dev.yml` or `docker-compose.prod.yml`.

**Why.** The requirement was explicit separation *and* no unnecessary
duplication. Healthchecks, environment wiring and service topology are identical
between environments and are defined once; the overrides carry only real
differences. LaQQ duplicates two full compose files, which is how its two stacks
drifted apart.

**Isolation mechanism.** `COMPOSE_PROJECT_NAME` (`academia-dev` /
`academia-prod`) namespaces volumes and networks, so a dev command cannot reach
production data. `scripts/compose.sh` sets it, so it is not left to memory.

---

## 10. Least-privilege environment per service

**Decision.** Each service receives only the variables it needs. The web
container is never given `DATABASE_URL` or `AUTH_SECRET`.

**Why.** A compromised or merely buggy frontend cannot leak a credential it was
never handed. `env_file:` on every service would have been shorter and would have
given all three containers everything.

---

## 11. `/health` distinguishes configuration from database

**Decision.** `GET /health` returns 200/`ok` or 503/`degraded`, with separate
`configuration` and `database` checks, and no detail about either.

**Why.** An operator needs to tell "the database is down" from "this was deployed
misconfigured" without shell access. Both invariants come from
`evaluateConfiguration()`, the same function that makes the process refuse to
start in production — one definition, two consumers.

Configuration normally reports `pass` precisely because boot is strict. The field
is not decoration: it catches a process whose environment became invalid relative
to the production rules, and it makes the distinction visible in the contract.

---

## 12. Production secrets stay on the server, not in GitHub Secrets

**Decision.** GitHub Secrets hold only what is needed to reach the host
(`DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`). Application
secrets live in the server's `.env`.

**Why.** Application secrets never enter a CI runner or a workflow log, so a
compromised workflow cannot leak the database or, later, payment credentials.

**Cost.** The server `.env` is provisioned out of band and is not version
controlled, so it must be in a password manager — stated in
[BACKUP-RESTORE.md](BACKUP-RESTORE.md), since it is not in any backup.

---

## 13. Production deploy reuses the CI workflow as its gate

**Decision.** `production.yml` calls `ci.yml` via `workflow_call` and deploys
only after it passes.

**Why.** The alternatives are worse: duplicating the checks lets the two
definitions drift, and `workflow_run` triggers make the relationship implicit and
harder to reason about. A reusable workflow makes the gate explicit and keeps one
definition.

`concurrency` is set to never cancel a running deployment: interrupting a
migration is worse than queueing.

---

## 14. Provisional design tokens, contrast-verified

**Decision.** Centralised CSS custom properties in `apps/web/src/app/globals.css`
via Tailwind's `@theme`. No component hardcodes a colour.

**Why.** The repository contained no Omegon brand assets to reuse, and the rules
require centralising tokens rather than scattering values. Every pair was
contrast-checked against its intended background before being written down; the
ratios are recorded in [ACCESSIBILITY.md](ACCESSIBILITY.md).

**Explicitly provisional.** When official Omegon brand tokens exist they replace
these values in that one file, and the contrast check is re-run.

---

## 15. In-process login throttle

**Decision.** A fixed-window per-IP limit on `POST /auth/login`, in memory.

**Why.** Login is the only unauthenticated write endpoint, and leaving it
unthrottled invites credential stuffing. An in-memory counter needs no Redis and
no dependency.

**Known limit.** State is per process, so it does not hold across replicas. A
shared store is required before scaling the API beyond one container — recorded
in `TODO.md` under Stage 9, and in a comment at the implementation.

---

## 16. Containers build `DATABASE_URL` from parts instead of receiving it assembled

**Context.** Compose originally interpolated the password directly into a URL:
`postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/...`. That failed in
production against a password generated the way `.env.example` recommends,
because `openssl rand -base64` emits `+`, `/` and `=`, which are all reserved in
a URI. Prisma rejected the result with `P1013: invalid port number`.

Probing `pg-connection-string` — the parser Prisma's driver adapter actually
uses — established which characters matter: `+`, `=`, `@` and `:` round-trip
correctly unencoded, `/` makes the URL unparseable, and a literal `%` is
misread because the parser percent-decodes. So the break is narrow but certain:
`openssl rand -base64` emits `/`, so the recommended way to generate a password
produces a broken URL roughly two times in three.

**Decision.** Compose passes the discrete `POSTGRES_*` variables. Each entrypoint
builds the URL with `docker/database-url.mjs`, which percent-encodes every
component with `encodeURIComponent` and validates the port.

**Why a script and not shell.** Correct percent-encoding in POSIX shell is
awkward, and the URL must never reach a log or a process listing — the entrypoint
captures the script's stdout into a variable and never echoes it.

**Escape hatch.** `DATABASE_URL_OVERRIDE` is passed through when set, for a
managed database whose connection string is issued by the provider. It is
accepted verbatim, so it must already be encoded.

**Related guard.** `describeDatabaseUrlProblem()` in `apps/api/src/config/env.ts`
rejects a malformed URL at boot, and `src/config/preflight.ts` runs before
migrations so a bad value fails immediately instead of after 30 connection
retries. It validates with `new URL` because that is what the driver's parser
does, and it deliberately accepts unencoded `+` and `=`: an over-strict check
would refuse a `DATABASE_URL_OVERRIDE` that works.

---

## 17. The web image bakes its API address and binds all interfaces

**Context.** Two production-only defects, both invisible in development:

- `/api/health` returned 500 in production while working in dev. Next.js
  serializes `rewrites()` destinations into the build output, so the standalone
  image — built without `API_INTERNAL_URL` — proxied `/api` to its own
  `localhost:4000`. `next dev` re-evaluates the config at startup, which is why
  development never showed it.
- The container never reported healthy despite serving traffic. The standalone
  server binds to `$HOSTNAME`, which Docker sets to the container ID; that
  resolves to one interface, so a `127.0.0.1` healthcheck could not connect.

**Decision.** `docker/web.Dockerfile` takes `API_INTERNAL_URL` as a build `ARG`
(defaulting to the Compose service name `http://api:4000`, stable across both
stacks) and sets `ENV HOSTNAME=0.0.0.0` in the runtime stage.
`docker-compose.prod.yml` passes the value through `build.args`.

**Consequence.** Pointing the API at a different address requires rebuilding the
web image, or a reverse proxy in front. Both stacks name the service `api`, so
the default holds for the deployment this repository describes.

**Lesson recorded.** Neither defect was reachable from the development stack or
from the acceptance checklist as written. The production stack is smoke-tested
explicitly — including with a password containing `+ / = : @` — because "dev
works" does not evidence a production claim.

---

## 18. Granular permissions: catalog + RolePermission; SUPER_ADMIN/DIRECTOR bypass

**Context.** Stage 1 needs module/action grants for ADMINISTRATIVE without
embedding a full ACL on every role. MASTER-PROMPT defines SUPER_ADMIN as
technical total access and DIRECTOR as operational total access; ADMINISTRATIVE
only gets what the Director assigns.

**Decision.** Persist a `Permission` catalog (`module` + `action`, unique) and
`RolePermission` links. Seed the catalog in the migration (no default grants).
Share the catalog in `@academia/shared`. Domain `hasPermission`:

- unknown (module, action) → deny;
- `SUPER_ADMIN` / `DIRECTOR` → allow for catalog pairs without reading grants;
- other roles → allow only when a `RolePermission` row exists.

**Why bypass instead of seeding every grant for Director.** Director's total
operational access is a product rule, not a row set that must stay in sync with
catalog growth. Grant rows remain the source of truth for ADMINISTRATIVE.

**Out of scope here.** HTTP `requirePermission`, Director assignment API/UI, and
mounting checks on every route.

---

## 19. ADMINISTRATIVE grants are role-scoped, managed by SUPER_ADMIN/DIRECTOR

**Context.** Product rule: Director controls Administrative permissions. Grants
are modelled as `RolePermission` rows for the `ADMINISTRATIVE` role, not per
user.

**Decision.** Expose configuration endpoints gated with
`requireRole('SUPER_ADMIN', 'DIRECTOR')`:

- `GET /permissions/catalog`
- `GET|POST|DELETE /roles/administrative/permissions`

Domain functions only mutate the ADMINISTRATIVE target. Catalog membership is
validated via shared Zod/`isCatalogPermission` before persistence. Grant and
revoke are idempotent.

**Still out of scope.** UI, permission-change audit trail, and mounting
`requirePermission` on academy feature routes.

---

## 20. `requirePermission` delegates to `hasPermission`

**Context.** Feature routes will need granular checks beyond `requireRole`.
Authorization must stay server-side and must not trust client-supplied
permission claims.

**Decision.** Add `requirePermission(store, module, action)` middleware that:

- requires `authenticate` to have set `req.user` (else 401);
- calls `hasPermission` with the server-resolved role (SUPER_ADMIN/DIRECTOR
  bypass; others need `RolePermission`);
- responds 403 when denied.

**Out of scope here.** Mounting on every academy route — the helper is ready;
wiring is a follow-up Stage 1 task.

---

## 21. Permission-management routes use `requirePermission`

**Context.** Catalog and ADMINISTRATIVE grant endpoints were gated only with
`requireRole('SUPER_ADMIN', 'DIRECTOR')`. Stage 1 now has `requirePermission`
and catalog pairs `permissions.read` / `permissions.update`.

**Decision.** Replace the role-only guard on those four routes:

- GET `/permissions/catalog` and GET `/roles/administrative/permissions` →
  `requirePermission(..., 'permissions', 'read')`
- POST/DELETE `/roles/administrative/permissions` →
  `requirePermission(..., 'permissions', 'update')`

SUPER_ADMIN/DIRECTOR still pass via `hasPermission` bypass. Callers without the
grant receive 403.

**Still out of scope.** Mounting on unrelated academy feature routes.

---

## 22. User provisioning gated by `users.create`

**Context.** Provision routes used `requireRole` only. Catalog includes
`users.create` for creating accounts.

**Decision.** Mount `requirePermission(..., 'users', 'create')` on
`POST /users/{directors,administratives,teachers,students}`. Keep
`requireRole('SUPER_ADMIN')` on directors so DIRECTOR cannot provision
DIRECTOR (bypass would otherwise allow it). Other provision routes rely on
the SUPER_ADMIN/DIRECTOR permission bypass; callers without `users.create`
receive 403.

**Still out of scope.** Non-provision academy feature routes.

---

## 23. Permission changes leave an append-only audit row

**Context.** MASTER-PROMPT asks for audit of important administrative actions.
GRANT/REVOKE of ADMINISTRATIVE permissions is the first mutation surface that
needs a durable trail.

**Decision.** Persist `PermissionChangeAudit` rows on successful POST/DELETE
`/roles/administrative/permissions`: actor from `req.user` (server session),
target role ADMINISTRATIVE, change type GRANT/REVOKE, module/action, and the
domain outcome (`created`/`exists`/`removed`/`missing`). Forbidden callers do
not create rows. No list UI in this increment.

**Still out of scope.** Audit of unrelated domain events; audit query API/UI.

---

## 24. Course → Group foundation without schedule as free text

**Context.** Stage 3 needs academic structure (Course / Group) before enrollments
and class scheduling. Product will later pick class times from a dropdown of
stable options (`ScheduleOption.id`), not free-text strings.

**Decision.** Persist `Course` and `Group` with `Group.courseId` (Restrict). Soft
delete via `isActive`. Do **not** store schedule labels on Course/Group. Leave
room for later nullable FKs (`teacherId`, `scheduleOptionId`) and Enrollment
without reshaping Course/Group. Permissions modules `courses` and `groups`
(read/create/update/delete) mirror the Student/Teacher catalog pattern.

**Still out of scope.** UI dashboards; ClassSession/calendar.
(ScheduleOption + Group→Teacher: #25; Enrollment: #26.)

---

## 25. ScheduleOption is a weekly slot catalog, not a class

**Context.** Groups need a stable schedule reference for a future UI dropdown
without building ClassSession/calendar yet.

**Decision.** Persist `ScheduleOption` with structured `day` (MONDAY…SUNDAY) and
`startTime`/`endTime` (`HH:mm`, no timezone). Public `label` is derived
(`Lunes 18:00–20:00`), not stored as source of truth. `Group.scheduleOptionId`
is an optional FK. Module `schedules` owns CRUD permissions. `Group.teacherId`
is an optional current teacher (assign/unassign via `/groups/:id/teacher` using
`groups.update`); TEACHER self-assign to a Group is allowed when permitted —
unlike Student→Teacher assignment.

**Still out of scope.** Recurrence, timezone, conflict detection, ClassSession,
schedule UI.

---

## 26. Enrollment max 15 uses row lock, not COUNT alone

**Context.** A Group may have at most 15 active students. A plain
`COUNT(*) < 15` then `INSERT` can race under concurrent enroll requests.

**Decision.** Persist `Enrollment` with `@@unique([groupId, studentId])` and
soft deactivate (`isActive`). Capacity is enforced inside a transaction that
`SELECT … FOR UPDATE` the Group row, then counts active enrollments and
creates/reactivates. Permissions reuse `groups.read` / `groups.update` (no
separate enrollments module). Independent of Student→Teacher assignment.

**Still out of scope.** Enrollment history UI; automatic Teacher assignment;
ClassSession.

---

## 27. Course.serviceType is the ClassSession duration source of truth

**Context.** Stage 4 must validate ClassSession lengths (1:1 → 60/90, Group →
120) without duplicating free-form minute rules across endpoints.

**Decision.** Persist `Course.serviceType` as one of `ONE_TO_ONE_60`,
`ONE_TO_ONE_90`, `GROUP_120`. `durationMinutes` is derived in shared/domain
(`COURSE_SERVICE_DURATION_MINUTES`), not stored. Groups inherit the rule via
`Group → Course`. Permissions reuse `courses.create` / `courses.update`. No
separate Service/Offering entity. Teacher-training remains a later Course
concern, not a new duration type here.

**Still out of scope.** ClassSession validation wiring beyond derivation map; UI.
(ClassSession entity: see #29.)

---

## 28. Course.courseType is orthogonal to serviceType

**Context.** The academy needs to mark teacher-training offerings without a
parallel `TeacherTrainingCourse` / `TeacherTrainingGroup` hierarchy.

**Decision.** Persist `Course.courseType` as `REGULAR` | `TEACHER_TRAINING`.
It does not affect duration; `serviceType` remains the only duration source of
truth. Groups inherit the educational purpose via `Group → Course` (no
`group.courseType` / `isTeacherTraining` duplication). No constraint forbids
`TEACHER_TRAINING` + `ONE_TO_ONE_*` until product defines one. Permissions stay
`courses.*` / `groups.*`.

**Still out of scope.** Certification, trainee workflow, mentors, UI filters.

---

## 29. ClassSession is a concrete Group occurrence

**Context.** Stage 4 needs a schedulable class instance without a calendar or
recurrence engine yet.

**Decision.** Persist `ClassSession` with `groupId`, `startAt`, `endAt`
(timestamptz). Duration is **not** stored as source of truth: `endAt` is
computed from `Group → Course.serviceType` via shared
`durationMinutesForServiceType`. Teacher and ScheduleOption are read from the
Group (no duplicated FKs). Creating a session requires an active Group with an
active `scheduleOptionId`; day/clock matching against ScheduleOption is deferred
until timezone policy exists. Module `classes` (incl. `delete`) owns CRUD.
Foundation writes still gate on `classes.*` grants. Read ownership for
Teacher/Student: #36.

**Still out of scope.** Attendance, notes, calendar UI.
(Timezone: #31. Weekly generation: #32. Conflict detection: #33.
Meeting URL: #35. Read ownership: #36.)

---

## 30. Weekly ClassSession generation blocked on academy timezone

**Context.** Generating `ClassSession` rows from `ScheduleOption` (`day` +
`HH:mm`) over a date range requires converting a local weekly slot into an
absolute `timestamptz` (`startAt`/`endAt`).

**Finding (at the time).** The codebase had **no** academy/business timezone
source of truth. ScheduleOption times were explicitly “no timezone” (#25).
ClassSession stores `timestamptz` (#29).

**Resolution.** Superseded by decision #31 (single academy IANA timezone via
configuration). Generation implemented in decision #32.

---

## 31. Single academy business timezone (IANA)

**Context.** Recurrence/generation needs a defined local zone to convert
`ScheduleOption` civil time into `ClassSession` timestamptz without inventing a
zone inside domain logic.

**Decision.** Academia has one business timezone, an IANA id from configuration
(`ACADEMY_TIMEZONE`, default `America/Argentina/Buenos_Aires`). Access via
`getAcademyBusinessConfig().businessTimezone`. Validation uses `Intl` (reject
offsets like `-03:00`; require Area/Location form). ScheduleOption remains
local academy time (no timezone column). ClassSession keeps absolute
`timestamptz`. No per-Group/Teacher/Student timezone in this increment.

**Still out of scope.** Multi-academy; user preference UI; timezone tables.
(Generation: see #32.)

---

## 32. Weekly ClassSession generation from ScheduleOption

**Context.** Stage 4 needs concrete `ClassSession` rows for a Group over a date
range without a calendar UI or RRULE engine.

**Decision.** `POST /groups/:id/classes/generate` accepts inclusive civil dates
`{ from, to }` (max 90 days). Matching weekdays use `ScheduleOption.day`; local
`startTime` converts via `getAcademyBusinessConfig().businessTimezone` to
`startAt`; `endAt` is `startAt` + `durationMinutesForServiceType(Course.serviceType)`
(not client duration; ScheduleOption `endTime` is catalog UX, not ClassSession
source of truth). Permission: existing `classes.create`. Idempotency:
`UNIQUE(groupId, startAt)` plus `createMany({ skipDuplicates: true })`. Soft-
deleted rows with the same key still block re-insert. Client cannot supply
duration, instants, teacher, schedule, or timezone.

**Still out of scope.** Calendar UI; RRULE; overwriting soft-deleted sessions.
(Conflict detection: #33. Read ownership: #36.)

---

## 33. Teacher ClassSession conflict detection without denormalized teacherId

**Context.** Concrete sessions and weekly generation can double-book a Teacher
across Groups. Overlap rule: `existing.startAt < candidate.endAt AND
existing.endAt > candidate.startAt` (adjacent endpoints allowed).

**Decision.** Teacher remains `ClassSession → Group.teacherId` only — no
redundant `teacherId` on `ClassSession`. Overlap queries join through Group.
Only **active** sessions participate. Create and reschedule (`PATCH` startAt)
reject with domain conflict → HTTP 409. Generation **skips** conflicting
candidates (`conflictCount`) without mutating existing rows; duplicates stay
`skippedCount` via `UNIQUE(groupId, startAt)`.

**Concurrency.** PostgreSQL `EXCLUDE USING gist (teacher_id, tstzrange…)` would
need `teacher_id` on `class_sessions`. Instead: transaction +
`SELECT … FROM teachers WHERE id = $1 FOR UPDATE`, then check+write on the same
connection (same pattern as enrollment max-15). Documented limit: no GiST
exclusion without denormalization.

**Still out of scope.** Denormalized teacherId / GiST exclude; calendar UI;
inactive-session resurrection into overlaps.

---

## 34. Calendar read API (civil range → ClassSession startAt)

**Context.** `/dashboard/calendar` needs a stable read API before any UI.

**Decision.** `GET /classes/calendar?from&to` with civil dates interpreted in
`getAcademyBusinessConfig().businessTimezone` as half-open absolute window
`[from 00:00 local, dayAfter(to) 00:00 local)`. Include **active** sessions
whose `startAt` falls in that window. Response is a read model joining
`ClassSession → Group → Course` and `Group → Teacher` (no denormalized FKs, no
`CalendarEvent` table). Permission: existing `classes.read`. Max span: 93
inclusive civil days. Order: `startAt ASC, id ASC`. Index:
`(is_active, start_at)`.

**Still out of scope.** Advanced filters; pagination cursors; week/month grid
widgets; create/edit from calendar UI. (Ownership reads: #36. Calendar UI list:
`/dashboard/calendar`.)

---

## 35. ClassSession.meetingUrl is a manual external https link

**Context.** Teachers/ops need to attach Zoom/Meet/Teams (or similar) room links
without vendor APIs in the MVP.

**Decision.** Optional nullable `meetingUrl` on `ClassSession` (`VARCHAR(2048)`).
Validated as absolute **https** URL via shared `meetingUrlSchema` (rejects
`http`, `javascript:`, `data:`, `file:`). Create/PATCH/list/get/calendar expose
it; generation always inserts `null`. No Meeting entity, no provider adapters,
no inheritance from Group/Course/ScheduleOption.

**Still out of scope.** Automated provisioning; OAuth; link rotation/expiry.

---

## 36. ClassSession read ownership (Teacher / Student)

**Context.** `classes.read` alone is an administrative grant. Teachers and
students must see only their own live classes without a separate permission
module or denormalized ownership table.

**Decision.** Read routes (`GET /classes`, `GET /classes/:id`,
`GET /classes/calendar`) resolve access from the authenticated session:

- Caller with `classes.read` (incl. SUPER_ADMIN/DIRECTOR bypass) → unrestricted.
- `TEACHER` without that grant → sessions where `Group.teacherId` matches the
  Teacher profile for `user.id` (not Student→Teacher assignment).
- `STUDENT` without that grant → sessions where an **active** Enrollment exists
  for the Student profile on the session’s Group.
- Filtering happens in the store query (join / `EXISTS`), not post-fetch.
- Writes (`POST`/`PATCH`/`DELETE`/`generate`) stay permission-gated; ownership
  does not grant mutation.

**Still out of scope.** Teacher/Student write ownership; calendar UI.
(Attendance: #37.)

---

## 37. ClassSession Attendance (PRESENT/ABSENT)

**Context.** Stage 4 needs to record who attended a concrete class without a
notes module, reporting, or a new permission catalog surface.

**Decision.** Persist `Attendance` with `classSessionId`, `studentId`, `status`
(`PRESENT` | `ABSENT` only — no `JUSTIFIED` until product asks). Integrity:
`UNIQUE(classSessionId, studentId)`; races map to HTTP 409. No soft delete —
change `status`. Writes require an **active** Enrollment on
`ClassSession → Group` plus an active Student and active ClassSession. Unenroll
does **not** delete existing rows (historical retain) but blocks further
create/update. Reads reuse ClassSession ownership (#36); STUDENT lists are
filtered to self only. Writes reuse `classes.update` for admin/bypass; TEACHER
may write only when `Group.teacherId` matches the session Teacher (first
attendance-scoped write ownership — not general ClassSession write ownership).
Students never mutate attendance. No nested attendance on ClassSession list/get
payloads.

**Still out of scope.** JUSTIFIED; attendance.* permissions; enrollment history;
Student attendance history UX (Stage 7); write ownership for ClassSession CRUD.
(Class notes: #38.)

---

## 38. ClassSession notes (simple text)

**Context.** Stage 4 needs private class notes without threading, authorship,
or a new permission module.

**Decision.** Persist `ClassNote` with `classSessionId` + `content`
(`VARCHAR(4000)`, trim, min 1). Multiple notes per session; order
`createdAt ASC, id ASC`. Hard delete (no soft delete). FK uses `ON DELETE
RESTRICT` like Attendance and other academic relations — ClassSession itself is
soft-deleted in the API, so Cascade is not the project convention. Auth mirrors
Attendance (#37): reads via ClassSession ownership (#36); writes via
`classes.update` or TEACHER of `Group.teacherId`; STUDENT read-only. URL
`:id` is the session; body never relocates a note. Cross-session `noteId` →
404.

**Still out of scope.** Author; versioning; rich text; UI; notes.* permissions.

---

## 39. Integration branch `dev` (main stays protected)

**Context.** Stage 0–1 landed on `feature/stage-0-foundation-infrastructure`
and were merged to `main` via PR. Later Stage 2–4 work accumulated on that same
feature branch as uncommitted progress, which is the wrong long-term shape:
`main` must stay promotion-only, and Stage work needs an integration surface.

**Decision.** Introduce `dev` as the sole integration branch. Flow:

`feature/stage-N-*` → PR → `dev` → (when Stage ready) PR → `main` → production.

Never commit product work directly to `main`. Archive
`feature/stage-0-foundation-infrastructure` as historical only — no new work.
Document the scheme in `docs/BRANCHING.md` and mirror it in
`docs/INFRASTRUCTURE.md`.
