# TODO — Academia

This is the executable project backlog. Keep it synchronized with `ROUTE-MAP.md` in every PR.

## Stage 0 — Foundation + Infrastructure — COMPLETE

### Objective
Establish a reproducible, environment-isolated, production-ready infrastructure
base before building academy product features. LaQQ was used as an architectural
reference only; Academia is independent.

### Audit outcome
The repository was **empty** — 7 tracked files, all markdown/Cursor rules, zero
code. `MASTER-PROMPT.md` claimed a pre-existing connected stack; that was not the
case, so Stage 0 was greenfield. LaQQ turned out to be Django + Vite, so only its
operational patterns were transferable.
See `docs/DECISIONS.md` (1) and `docs/LAQQ-REFERENCE.md`.

### Done
- [x] Audit repository structure — empty; nothing to reuse.
- [x] Audit architecture / roles / DB / ORM / routes — none existed.
- [x] Audit LaQQ patterns; record what was adopted and what was rejected (`docs/LAQQ-REFERENCE.md`).
- [x] Monorepo with npm workspaces: `apps/api`, `apps/web`, `packages/shared`.
- [x] Dockerize development (`docker-compose.dev.yml`, dev Dockerfiles, bind mounts).
- [x] Production Docker strategy (multi-stage, non-root, `output: standalone`, no exposed DB/API).
- [x] Strict DEV/PRODUCTION separation via `COMPOSE_PROJECT_NAME`, separate volumes and overrides; the override variable is `ACADEMIA_PROJECT` so a stray shell variable cannot redirect a destructive command.
- [x] Least-privilege env per service — web never receives `DATABASE_URL` or `AUTH_SECRET`.
- [x] `.env.example` with no real values; `.gitignore` covers `.env*`, dumps, keys.
- [x] PostgreSQL 17 for development, published on host port 5433 only in dev.
- [x] Versioned migration `20260912215052_init_identity`; applied by `migrate deploy`, never generated in a container.
- [x] snake_case database naming convention (`@map`/`@@map`) established before any model exists.
- [x] Container-side `DATABASE_URL` assembled with percent-encoding, plus a preflight config check that fails fast without printing values.
- [x] Idempotent SuperAdmin bootstrap for `omegon.info@gmail.com` (never overwrites a password).
- [x] CI: lint, typecheck, unit, integration against real PostgreSQL, build, image builds, secrets hygiene.
- [x] Production CD from `main` only, gated by CI via `workflow_call`, migrations then health check.
- [x] GitHub Secrets documented (`docs/INFRASTRUCTURE.md`); app secrets stay on the server.
- [x] `GET /health` separating `configuration` from `database`; healthchecks on all three services.
- [x] Structured logging (`pino`) with central redaction; `no-console` enforced.
- [x] Backup/restore documented and scripted, with a restore drill (`docs/BACKUP-RESTORE.md`).
- [x] Centralised design tokens, every pair contrast-verified (`docs/ACCESSIBILITY.md`).
- [x] Public/private route boundary: `/dashboard` redirects server-side; `noindex` on private routes.
- [x] SEO baseline: per-page metadata, canonicals, Open Graph, `robots.txt`, `sitemap.xml`.
- [x] WCAG 2.2 AA baseline: skip link, landmarks, focus ring, labels, `role="alert"`, reduced motion.
- [x] 88 tests (77 unit + 11 integration).
- [x] `ROUTE-MAP.md` and `TODO.md` updated to the real state.
- [x] OpenAPI 3 (`GET /openapi.json`) + Swagger UI (`GET /docs`) via `/api/*`; cookie session; `API_DOCS_ENABLED`; smoke `docs/API-SMOKE.md`.

### Acceptance criteria — all verified
- [x] Development comes up reproducibly from empty volumes; all three services report healthy.
- [x] Next.js → Node.js → PostgreSQL verified end to end (`/api/health` through the proxy returns `ok`).
- [x] DEV and PRODUCTION configurations strictly separated.
- [x] The **production** stack was smoke-tested too, not only development: built and run from empty volumes with a deliberately hostile password containing `+ / = : @`, then verified for `/api/health`, login, `Secure` cookie, security headers, `scripts/health-check.sh`, and that neither the API nor the database publishes a host port. This found four defects that development could not expose (`docs/DECISIONS.md` 16–17).
- [x] No real secrets in Git — verified, and enforced by the `secrets-hygiene` CI job.
- [x] CI validates a PR; production deployment flow defined from `main`.
- [x] Healthcheck exists and was verified degrading to 503/`database: fail` and recovering.
- [x] Migrations reproducible: applied from an empty database in the container and in CI.
- [x] `omegon.info@gmail.com` provisioned as SUPER_ADMIN; real login verified, wrong password rejected.
- [x] `ROUTE-MAP.md` and `TODO.md` match reality.
- [x] SEO and accessibility applied in the first implementation.
- [x] Architecture does not depend on LaQQ.
- [x] No duplicate infrastructure introduced (there was none to duplicate).

### Known limits carried forward
- **The production *deploy* job has not been executed.** The production Compose stack itself was built and verified locally, but the SSH deployment path in `.github/workflows/production.yml` cannot be validated without a provisioned server, GitHub Secrets and a DNS name. First real deploy must be treated as a rehearsal: confirm the server prerequisites in `docs/INFRASTRUCTURE.md`, then watch the health gate.
- Login throttle is per-process; needs a shared store before multiple API replicas (Stage 9).
- Design tokens are provisional pending official Omegon brand assets.
- TLS termination is expected from a reverse proxy in front of the stack; not in the Compose file.
- Migrations are forward-only; reversing a schema change requires a new migration.

## Stage 1 — Identity, Roles & Permissions — API + UI DONE

### Objective
Make access control real and manageable.

### Already in place from Stage 0
- `Role` enum with all five roles, in the database and in `@academia/shared`.
- Real login/logout/session with an HttpOnly cookie; the user is reloaded per request.
- `authenticate` and `requireRole` middleware.
- SUPER_ADMIN provisioned and verified end to end.

### Done
- [x] Provision DIRECTOR via `POST /users/directors` (SUPER_ADMIN only + `requirePermission(users, create)`).
- [x] Provision ADMINISTRATIVE via `POST /users/administratives` (`requirePermission(users, create)`; SUPER_ADMIN/DIRECTOR bypass).
- [x] Provision TEACHER via `POST /users/teachers` (`requirePermission(users, create)`; SUPER_ADMIN/DIRECTOR bypass).
- [x] Provision STUDENT via `POST /users/students` (`requirePermission(users, create)`; SUPER_ADMIN/DIRECTOR bypass; TEACHER denied without grant).
- [x] Granular permission model (module/action): `Permission` + `RolePermission` in Prisma, catalog in `@academia/shared`, `hasPermission` domain query (SUPER_ADMIN/DIRECTOR bypass catalog; others need grants).
- [x] HTTP surface for permissions: `GET /permissions/catalog` + `GET|POST|DELETE /roles/administrative/permissions`.
- [x] Director (and SUPER_ADMIN) can grant/revoke ADMINISTRATIVE RolePermission. Gate: `permissions.read` / `permissions.update` via `requirePermission` (SUPER_ADMIN/DIRECTOR bypass).
- [x] `requirePermission(module, action)` on permission-management and user-provisioning routes.
- [x] Academy feature routes (Stages 2–4) enforce authz server-side via `requirePermission` and/or ownership scopes (not UI-only).
- [x] Role-aware `/dashboard` from server session role; hub links to existing modules (students, teachers, calendar).
- [x] Authorization matrix tests for **Stage 1** protected API routes (`authorization-matrix.test.ts`; positive/negative across five roles; client claims ignored).
- [x] Permission-change audit trail: append-only `permission_change_audits` on GRANT/REVOKE of ADMINISTRATIVE permissions (no audit UI).
- [x] UI `/dashboard/permissions` — Director/SuperAdmin grant/revoke ADMINISTRATIVE from real catalog.
- [x] UI `/dashboard/administratives` — provision ADMINISTRATIVE (create-only; no list endpoint in API).
- [x] UI `/dashboard/settings` — session/identity surface (no finance/config APIs in Stage 1).

### TODO (remaining Stage 1)
- [ ] Expand authorization-matrix coverage beyond Stage 1 routes → tracked under Stage 9.
- [ ] List endpoint for ADMINISTRATIVE users (if product needs a directory; not in current API).

### Acceptance criteria
- Unauthorized API requests fail. *(met for implemented routes)*
- UI does not expose inaccessible actions. *(met: Stage 1 admin nav gated to SUPER_ADMIN/DIRECTOR; API remains authority)*
- Administrative users can only perform granted actions. *(met via grants + bypass rules)*
- Director controls Administrative permissions. *(API + UI met)*
- SuperAdmin has technical access. *(met)*

## Stage 2 — Students & Teachers — API + UI DONE

### Objective
Create the academy's people registry.

### Done
- [x] Student CRUD (API `/students` + UI `/dashboard/students` + `[id]`; perfil 1:1 con User; baja lógica).
- [x] Teacher CRUD (API `/teachers` + UI `/dashboard/teachers` + `[id]`; perfil 1:1 con User; availability; baja lógica).
- [x] Level field (CEFR A1–C2 on Student and Teacher).
- [x] Active/inactive state (Student/Teacher + User soft deactivate).
- [x] Basic profile (firstName, lastName, level, email via User; Teacher availability).
- [x] Teacher status/availability foundation (`AVAILABLE` | `UNAVAILABLE` | `LIMITED`).
- [x] Access-control tests (registry suites + ownership for STUDENT and TEACHER).

### TODO
- *(none for Stage 2 MVP registry — later UX polish lives in Stages 7–8)*

### Acceptance criteria — met
- Director/Admin with permission can manage records.
- Teachers cannot see unrelated private data (own-read ownership).
- Students can only see their own private data (own-read ownership).

## Stage 3 — Assignments & Academic Structure — API + UI DONE (history deferred)

### Objective
Model who teaches whom and which educational offering they belong to.

### Done
- [x] Student-teacher assignment (API `GET|POST|DELETE /students/:id/teacher`; UI `/dashboard/assignments`; 1 estudiante → 1 profesor **actual**; sin historial).
- [x] Prevent teacher self-assignment (actor TEACHER blocked server-side; identidad desde sesión).
- [x] Course + Group foundation (API `/courses` + `/groups` CRUD; UI `/dashboard/courses` + `/dashboard/groups` (+ `[id]`); soft delete).
- [x] Group → Teacher assignment (API + UI on Group detail; un teacher actual; sin historial; self-assign TEACHER permitido con `groups.update`).
- [x] ScheduleOption catalog + Group.scheduleOptionId (API `/schedule-options`; selección en Group detail; label derivado).
- [x] 1:1 / Group service configuration (`Course.serviceType`; `durationMinutes` derivado en UI, no editable).
- [x] Group capacity max 15 (Enrollment UI + API; rechazo del 16.º; display `n / 15`).
- [x] Teacher-training course/group (`Course.courseType`: REGULAR | TEACHER_TRAINING).
- [x] Enrollment model (API + UI on Group detail; soft deactivate; sin historial).
- [x] Weekly schedule **catalog** foundation (ScheduleOption; ClassSession generate/calendar → Stage 4).

### TODO
- [ ] Assignment history (reemplazos no conservan filas históricas).

### Acceptance criteria
- Director can assign a student to a teacher. *(met via API + UI)*
- Assignment is persisted as the **current** link (not a historical audit trail). *(met; history deferred)*
- Teacher cannot create an assignment for themselves. *(met)*
- Group cannot exceed 15 active students. *(met)*

## Stage 4 — Classes & Calendar — CORE API + CALENDAR UI DONE (partial stage)

### Objective
Operate real live classes.

### Done
- [x] Class session CRUD (API `/classes`; instancia concreta; soft delete; UI `/dashboard/classes` + `[id]`).
- [x] 60/90-minute 1:1 + 120-minute group validation (`Course.serviceType` → duración derivada).
- [x] Weekly ClassSession generation (`POST /groups/:id/classes/generate`; ScheduleOption + `getAcademyBusinessConfig`; máx. 90 días; UI en `/dashboard/classes`; `classes.create` only).
- [x] Meeting URL (`ClassSession.meetingUrl` https opcional; manual; sin provisioning Zoom/Meet).
- [x] Calendar API (`GET /classes/calendar?from&to`; rango civil en timezone de academia; lectura enriched).
- [x] Calendar UI (`/dashboard/calendar`; mes civil; lista real vía API; ownership del backend; links a detalle).
- [x] Class Sessions UI (`/dashboard/classes` + `[id]`; create/edit/soft-delete; datos reales; authz en API).
- [x] Conflict detection (mismo Teacher; overlap half-open; create/PATCH 409; generate `conflictCount`; lock `teachers FOR UPDATE`).
- [x] Academy business timezone (`ACADEMY_TIMEZONE` IANA; default `America/Argentina/Buenos_Aires`; vía `getAcademyBusinessConfig`).
- [x] Attendance (`GET|POST /classes/:id/attendance`, `PATCH .../:studentId`; PRESENT|ABSENT; enrollment activo; Teacher write ownership; Student self-read).
- [x] Class notes (`GET|POST /classes/:id/notes`, `PATCH|DELETE .../:noteId`; content trim 1–4000; Teacher write ownership; Student read-only).
- [x] ClassSession read ownership (`Group.teacherId` / active Enrollment; GET list/id/calendar).
- [x] ClassSession write ownership (`POST`/`PATCH`/`DELETE`; admin vía `classes.*`; TEACHER del Group; STUDENT denegado; generate sigue `classes.create`).
- [x] Unique/idempotencia `(groupId, startAt)` para generación (`@@unique` + `skipDuplicates`).
- [x] Attendance + Notes UI on `/dashboard/classes/[id]` (roster via enrollments when `groups.read`; STUDENT read-only; API authz authoritative).
- [x] Automated coverage for smoke gaps: enrollment 16th → 400 (HTTP asserts); teacher overlap create/PATCH 409 + generate `conflictCount` (HTTP); ADMINISTRATIVE positive grants on students/teachers/courses/groups/classes (+ attendance/notes via `classes.update`).

### TODO (remaining Stage 4 / deferred)
- [ ] Timezones avanzados (por usuario/group; UI de configuración).
- [ ] Broader recurrence / RRULE (beyond weekly generate).
- [ ] GiST/EXCLUDE constraint on teacher ranges (requires denormalized `teacherId` on ClassSession — deferred; see #33).
- [ ] Automated meeting provisioning (Zoom/Meet/Teams APIs) — also listed under Future backlog; manual `meetingUrl` only for MVP.
- [ ] UI for weekly generate (API done; no UI yet).
- [ ] Browser E2E (Playwright/Cypress) — out of unit/API smoke scope.
### Acceptance criteria — core met; stage not complete
- Teacher and student can see scheduled classes within ownership scope. *(met via API + calendar + classes UI)*
- Meeting link opens the configured external classroom when `meetingUrl` is set. *(met)*
- Attendance and notes persist. *(met via API + ClassSession detail UI)*
- Invalid durations are rejected. *(met)*

## Stage 5 — Materials

### Objective
Make class material available in context.

### Status
- **Stage 5A — Design:** DONE
- **Stage 5B — API + Storage:** DONE
- **Stage 5C — UI (contextual):** DONE

### TODO — API + Storage (5B) — DONE
- [x] File upload (presigned PUT + complete).
- [x] PDF/audio/image/link support (no video).
- [x] Attach to class XOR course.
- [x] Access control (permissions + Teacher ownership + Student entitlement).
- [x] Teacher upload via Group.teacherId ownership.
- [x] Student download/view (READY + entitlement; signed GET).
- [x] Validation (MIME allowlist, size limits, filename, HTTPS links).
- [x] MinIO (dev) / DigitalOcean Spaces (prod) via S3-compatible adapter.
- [x] Soft delete (`isActive=false` via `materials.update`; no `materials.delete`).

### TODO — UI (5C) — DONE
- [x] Course detail — sección Materiales del curso.
- [x] ClassSession detail — sección Materiales de la clase.
- [x] Crear LINK, subir FILE (intent → PUT → complete), descargar/abrir, editar metadata, soft-delete.
- [x] STUDENT read-only en UX; mutaciones gated por rol; authz real en API.

### Explicitly out of scope (not Stage 5C)
- Student Hub / Teacher Hub materials dashboards.
- `/dashboard/materials` hub route.
- Finance, antivirus, orphan cleanup, queues, advanced storage lifecycle.
- Browser E2E completo.

### Acceptance criteria
- Student sees only materials they are entitled to access. *(API + contextual UI)*
- Teachers can manage permitted materials. *(API + contextual UI)*
- Invalid uploads are rejected safely. *(API + early UX validation)*
- Stage 5 UI contextual — DONE.

## Stage 6 — Finance

### Objective
Track payments and settlements using the academy's **configurable** revenue split
(not a hardcoded 40/60 forever).

### Status
- **Stage 6A — Design / decisions:** DONE (`docs/DECISIONS.md` #41 + #44)
- **Stage 6B-1 — Finance Foundation + Domain:** DONE
  (Prisma models/migration, shared finance types, domain services, unit +
  PostgreSQL integration tests). No HTTP / OpenAPI / UI / provider SDKs.
- **Stage 6B-2 — Finance API:** PENDING
- **Stage 6C — Finance UI:** PENDING

### Business rule — revenue split (academy config) — #41
- Single **current** academy setting: `academyPercentage` ∈ `{20, 30, 40, 50}`.
- Default: **40** (Teacher **60**).
- Teacher share is always derived: `teacherPercentage = 100 - academyPercentage`.
  Do not allow two independent writable percentages.
- Allowed pairs only: 20/80, 30/70, 40/60, 50/50.
- Who may **change** the config: **SUPER_ADMIN** and **DIRECTOR** only.
  ADMINISTRATIVE, TEACHER and STUDENT cannot modify it.
- **Freeze (#41 + #44):** on `Payment.status → SUCCEEDED`, create immutable
  `RevenueAllocation` with frozen `academyPercentage` and amounts; later config
  / price / teacher changes do not rewrite frozen rows.

### MVP model closed in 6A (#44)
- Charge / Payment / RevenueAllocation / TeacherSettlement.
- ONE_TO_ONE_60|90 → Charge per ClassSession; GROUP_120 → Charge per Enrollment
  + monthly period (no auto Charge generation in 6B yet — rule only).
- Course list price: `amountMinor` + `currency` ∈ {ARS, USD}; snapshot on Charge.
- ARS → Mercado Pago; USD → Stripe; MANUAL for authorized admin ops.
- 1 Payment → 1 Charge; integer `floor` rounding; total refund + reversal only.
- No automated payout; no FX; no partial refunds; no chargebacks; no ledger /
  invoices / taxes; no FinanceAuditLog in MVP.

### TODO — Stage 6B-1 (Foundation + Domain) — DONE
- [x] Persist `academyPercentage` settings (domain validation; HTTP authz in 6B-2).
- [x] Course price (`amountMinor` + `currency`).
- [x] Charge / Payment / RevenueAllocation / TeacherSettlement / Refund /
      WebhookEvent (Prisma + domain).
- [x] Payment lifecycle + Freeze on SUCCEEDED (#41/#44).
- [x] Rounding tests (allowed pairs + remainder; freeze immutability).
- [x] Total refund + REVERSAL allocation (negative minors).
- [x] TeacherSettlement owed / MARKED_PAID.
- [x] Idempotency constraints (payment key, provider ref, allocation kind).

### TODO — Stage 6B-2 (Finance API)
- [ ] HTTP routes + OpenAPI for finance settings / charges / payments /
      refunds / settlements.
- [ ] Authorization via `finance.*` + ownership (SUPER_ADMIN/DIRECTOR mutate %).
- [ ] Provider boundary (MP / Stripe / MANUAL) — adapters may be stubbed/manual
      first; no full live integration required to land the domain contract.
- [ ] Webhook HTTP endpoints + idempotency when providers are wired.

### TODO — Stage 6C (Finance UI)
- [ ] Director/admin finance dashboard and revenue-split settings UI.
- [ ] Student charges / payments surfaces.
- [ ] Teacher earnings / settlement visibility (own allocations only).

### Explicitly out of MVP (future)
- Automated teacher payouts.
- Partial refunds; chargebacks.
- FX / multi-currency list prices.
- Invoices; taxes; full accounting ledger; advanced reconciliation.

### Acceptance criteria (product — met by design in 6A; implemented in 6B/6C)
- Director (and SuperAdmin) can select exactly one of the four allowed splits;
  default is academy 40% / teacher 60%.
- Teacher percentage is never an independent writable value.
- ADMINISTRATIVE / TEACHER / STUDENT cannot change the split.
- For a given `amountMinor` under the **active** config, shares match that config
  via integer `floor` (#44).
- Already-frozen Allocations keep their frozen split after a config change
  (Freeze — #41/#44).
- Payments remain decoupled from Finance domain logic (Payment Domain → Provider).

## Integration — New Frontend (`academia-front`) — READY TO EXECUTE

### Objective
Replace `apps/web` with the UI from `omegonstudio/academia-front`, wired to the
existing Express API (`/api` proxy, HttpOnly session, `@academia/shared`).

### Source (cloned 2026-09-24)
- Clone path: `/home/titin/Documentos/omegon/00-OMEGON/academia-front`
- Remote: `https://github.com/omegonstudio/academia-front.git` (SSH keys still fail;
  HTTPS with stored credentials works)
- HEAD: `cc45a9e` — v0.app project (`prj_2tuDpDGnvafvlirlbzP0XO2L0cCa`)
- ~46 source files; UI shell + demo data; **not production-wired**

### Stack inventory (front nuevo)
| Item | academia-front | monorepo `apps/web` hoy |
| ---- | -------------- | ----------------------- |
| Next | 16.3.3 | 16.3.5 |
| React | 19 | 19.3 |
| Package manager | **pnpm** (+ lock) | **npm** workspaces |
| UI | shadcn / `@base-ui/react` / lucide | tokens propios + Tailwind |
| Tailwind | 4.3 + `tw-animate-css` | 4.3 |
| Shared types | **none** (`lib/academy-data.ts` mocks) | `@academia/shared` |
| API proxy | **none** (`next.config.mjs` mínimo) | rewrite `/api` → `API_INTERNAL_URL` |
| `output: standalone` | **no** | sí (Docker prod) |
| Lint / tests | **no** | eslint + vitest |
| `ignoreBuildErrors` | **true** (quitar) | false |
| Env | solo `NODE_ENV`; **no** `NEXT_PUBLIC_*` | `API_INTERNAL_URL`, `NEXT_PUBLIC_APP_URL` |
| Analytics | `@vercel/analytics` (prod) | no |

### Auth / data reality
- Login form **sí** llama `POST /api/auth/login` (credentials include) → OK shape.
- **DEV bypass** peligroso: `localStorage` `academy-dev-session` + password hardcode
  `academia` para `omegon.info@gmail.com` — **eliminar** en integración.
- **No** hay `GET /auth/me`, **no** hay `POST /auth/logout` real (settings logout UI
  no cableada).
- Dashboard shell lee `localStorage` para “DEV MODE”, no sesión servidor.
- **Todos** los módulos operativos leen/escriben `lib/academy-data.ts` (arrays demo)
  o `setTimeout` fake success (permisos, administrativos). **Cero** CRUD real.

### Route diff vs `ROUTE-MAP.md`

| Ruta monorepo | academia-front | Notas |
| ------------- | -------------- | ----- |
| `/` | `[~]` landing one-page (anchors) | Buena base visual; copy marketing |
| `/about` `/courses` `/teachers` `/contact` | **faltan** | Hoy son `#academia` `#cursos` `#contacto` |
| `/login` | `[x]` UI | Cablear cookie; quitar DEV localStorage |
| `/dashboard` | `[x]` hub | Role copy mock; sin `/auth/me` |
| `/dashboard/students` + `[id]` | `[x]` UI + mock | Shapes casi OK (level CEFR) |
| `/dashboard/teachers` + `[id]` | `[x]` UI + mock | availability OK; falta `level` teacher |
| `/dashboard/assignments` | `[x]` UI + mock | Modelo inventado (`Assignment.status`); API = link actual |
| `/dashboard/courses` + `[id]` | `[x]` UI + mock | **Shape wrong**: `level`/`studentCount` vs `courseType`/`serviceType`/`durationMinutes` |
| `/dashboard/groups` + `[id]` | `[x]` UI + mock | Falta enrollment API, scheduleOptionId, capacity 15 |
| `/dashboard/classes` + `[id]` | `[x]` UI + mock | Status inventados; asistencia/notas/materials = strings |
| `/dashboard/calendar` | `[x]` UI + mock | No usa `GET /classes/calendar?from&to` |
| `/dashboard/permissions` | `[x]` UI fake save | Catálogo modules OK; falta grant/revoke HTTP |
| `/dashboard/administratives` | `[x]` create UI fake | Sin list (OK); falta `POST /users/administratives` |
| `/dashboard/settings` | `[x]` hardcode Omegon | Falta sesión real + logout API |
| Materials contextual | **faltan** | Solo títulos string en demo class |
| Attendance/Notes panels | **faltan** como API | UI resumen texto |
| Generate semanal | dialog mock | Debe → `POST /groups/:id/classes/generate` |
| Finance / student hub / teacher hub | ausentes | OK — Fase 5 |

### Shape mismatches críticos (UI → API)
1. **Course:** drop `level`/`studentCount`; add `courseType`, `serviceType`, derived
   `durationMinutes`; optional `amountMinor`+`currency`.
2. **ClassSession:** drop `SCHEDULED|IN_PROGRESS|COMPLETED|CANCELLED` and free-form
   duration; use `startAt` + group→course duration; soft `isActive`.
3. **Assignment:** no `Assignment` entity UI-model; use
   `GET|POST|DELETE /students/:id/teacher` + `{ teacherId }`.
4. **Attendance/Notes/Materials:** replace string fields with real list/mutate APIs.
5. **Group:** wire `teacherId`, `scheduleOptionId`, enrollments `n/15`.
6. **IDs:** demo `stu-1` → UUID from API.

### Strategy — **A confirmada**
Reemplazar **contenido** de `apps/web` con UI de `academia-front`, **conservando**
del monorepo: `package.json` name `@academia/web`, Dockerfiles, `output: standalone`,
rewrites `/api`, security headers, eslint/vitest scripts, dependencia
`@academia/shared`. Migrar a **npm** (no introducir pnpm en el monorepo).
Sibling clone queda como referencia hasta merge completo; no es workspace.

---

### Fase 0 — Ingesta — DONE
- [x] Clonar `academia-front` (HTTPS) a path sibling.
- [x] Documentar stack / rutas / auth / mocks / env.
- [x] Diff vs `ROUTE-MAP.md`.
- [x] Decidir estrategia **A**.

### Fase 1 — Cableado monorepo
- [x] Copiar UI (`app/`, `components/`, `lib/`, `public/`, tokens CSS) dentro de
      `apps/web/src` (o estructura acordada) sin romper workspaces.
- [x] Portar deps UI: `class-variance-authority`, `clsx`, `tailwind-merge`,
      `lucide-react`, `@base-ui/react`, `shadcn`/anim — vía **npm** en `apps/web`.
- [x] Fusionar `next.config`: keep rewrites + standalone + headers; drop
      `ignoreBuildErrors`.
- [x] Theme CSS: adoptar tokens v0 **o** mapear a tokens AA actuales; documentar
      contraste (purple primary puede fallar AA — re-check).
- [x] Quitar `@vercel/analytics` o dejarlo detrás de flag (no requerido MVP).
- [x] Smoke: typecheck/lint/test/build web + `GET /api/health` vía rewrite
      (compose full blocked por pull MinIO quay.io 401; API host + `next start`).

### Fase 2 — Auth & shell
- [ ] Eliminar DEV localStorage + password hardcode del login.
- [ ] Login → cookie HttpOnly; error genérico / 429; `router.refresh`.
- [ ] Server `getSession()` via `GET /auth/me` (portar `apps/web/src/lib/api.ts`).
- [ ] Guard dashboard: redirect `/login` si no hay sesión.
- [ ] Logout real `POST /auth/logout` en shell + settings.
- [ ] Nav por rol: ocultar Permisos/Administrativos si no SUPER_ADMIN/DIRECTOR;
      no inventar grants en cliente.
- [ ] `robots: { index: false }` en `/login` y `/dashboard/**`.
- [ ] Skip link + landmarks (layout actual v0 no tiene skip link).

### Fase 3 — Módulos operativos (orden de ejecución)
Cada ítem = sustituir `demo*` + fake save por fetch `/api/...` + schemas shared +
estados loading/vacío/error.

- [ ] **3.1** Estudiantes list/create/detail/patch/soft-delete ↔ `/students`
- [ ] **3.2** Profesores idem ↔ `/teachers` (+ `level`, `availability`)
- [ ] **3.3** Asignaciones ↔ `/students/:id/teacher` (sin entity Assignment)
- [ ] **3.4** Cursos ↔ `/courses` (rehacer formularios a `courseType`/`serviceType`)
- [ ] **3.5** Grupos detail: teacher + `schedule-options` + enrollment máx. 15
- [ ] **3.6** Clases CRUD + generate ↔ `/classes` + `POST .../classes/generate`
- [ ] **3.7** Calendar ↔ `GET /classes/calendar?from&to` (civil dates)
- [ ] **3.8** Class detail: attendance + notes panels (API real)
- [ ] **3.9** Materials section en course + class (LINK + upload 3-step)
- [ ] **3.10** Permisos: catalog + grant/revoke ADMINISTRATIVE (no fake timeout)
- [ ] **3.11** Administrativos: solo `POST /users/administratives`
- [ ] **3.12** Settings: datos de `/auth/me` + logout; theme local OK

### Fase 4 — Calidad
- [ ] Borrar `lib/academy-data.ts` (o dejar fixtures solo en tests).
- [ ] Validar requests/responses con `@academia/shared`.
- [ ] Restaurar rutas públicas SEO (`/about`, `/courses`, `/teachers`, `/contact`)
      **o** actualizar `ROUTE-MAP.md` + `sitemap` si se adopta landing one-page
      (decisión de producto en este paso).
- [ ] Contraste AA + `prefers-reduced-motion`; focus visible.
- [ ] Typecheck/lint/test/build CI verdes; quitar ignoreBuildErrors.
- [ ] Actualizar `ROUTE-MAP.md` estados UI post-swap.

### Fase 5 — Fuera de esta integración (no bloquear)
- [ ] Finance UI (Stage 6B-2/6C).
- [ ] Hubs `/dashboard/student/*`, `/dashboard/teacher/*` (Stages 7–8).
- [ ] Hub `/dashboard/materials`.
- [ ] Dark mode como requisito de producto (hoy es preferencia UI v0).

### Acceptance
- [ ] `apps/web` sirve UI nueva en compose.
- [ ] Login SuperAdmin seed end-to-end (sin DEV bypass).
- [ ] Mutación real verificada en students, teachers, classes, materials, permissions.
- [ ] Ningún `setTimeout` success ni mutación solo-local en módulos MVP.
- [ ] `ROUTE-MAP.md` + esta sección sincronizados.

## Stage 7 — Student UX

### TODO
- [ ] Student dashboard.
- [ ] Next class.
- [ ] Calendar.
- [ ] Materials.
- [ ] Basic progress.
- [ ] Attendance history.
- [ ] Future features marked `Próximamente`.

## Stage 8 — Teacher UX

### TODO
- [ ] Teacher dashboard.
- [ ] Assigned students.
- [ ] Upcoming classes.
- [ ] Attendance.
- [ ] Notes.
- [ ] Materials.
- [ ] Earnings/settlement view.
- [ ] Future features marked `Próximamente`.

## Stage 9 — Production Hardening

### Baseline established in Stage 0
Backups, recovery procedure, healthchecks, structured logging, CI/CD and the
SEO/accessibility baselines already exist. This stage deepens them.

### TODO
- [ ] Full SEO audit once real content and public pages are final.
- [ ] Full WCAG 2.2 AA audit, including screen-reader passes (NVDA/VoiceOver).
- [ ] Automated accessibility checks (axe) in CI.
- [ ] Core Web Vitals measurement and budget.
- [ ] Security review of the complete authorization surface.
- [ ] Authorization matrix test across all roles and modules.
- [ ] Error tracking (Sentry or equivalent) wired to the existing logger.
- [ ] Metrics, tracing and alerting.
- [ ] Replace the in-process login throttle with a shared store, enabling >1 API replica.
- [ ] Schedule backups on the production host and verify the offsite copy.
- [ ] Run and record the restore drill in production conditions.
- [ ] TLS termination and the reverse proxy in front of the stack.
- [ ] Production deployment checklist.
- [ ] Privacy/security documentation (personal data inventory, retention).

## Future backlog

These must remain visible in the roadmap but are not MVP:
- [ ] Native video.
- [ ] AI tutor.
- [ ] Gamification.
- [ ] Chat.
- [ ] Mobile app.
- [ ] Public teacher marketplace.
- [ ] Automated payouts.
- [ ] Advanced CRM.
- [ ] Advanced certification.
- [ ] Automated meeting provisioning.
- [ ] Advanced analytics.
