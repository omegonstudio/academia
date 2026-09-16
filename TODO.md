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

## Stage 1 — Identity, Roles & Permissions

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

### TODO (remaining Stage 1)
- [ ] UI for Director → Administrative permissions (`/dashboard/permissions`).
- [ ] `/dashboard/administratives` / `/dashboard/settings` (planned; not built).
- [ ] Expand authorization-matrix coverage beyond Stage 1 routes → tracked under Stage 9.

### Acceptance criteria
- Unauthorized API requests fail. *(met for implemented routes)*
- UI does not expose inaccessible actions. *(partial: registry forms gated by API; dedicated permissions UI still missing)*
- Administrative users can only perform granted actions. *(met via grants + bypass rules)*
- Director controls Administrative permissions. *(API met; UI pending)*
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
- [x] Weekly ClassSession generation (`POST /groups/:id/classes/generate`; ScheduleOption + `getAcademyBusinessConfig`; máx. 90 días; sin UI; `classes.create` only).
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

### TODO (remaining Stage 4 / deferred)
- [ ] Timezones avanzados (por usuario/group; UI de configuración).
- [ ] Broader recurrence / RRULE (beyond weekly generate).
- [ ] GiST/EXCLUDE constraint on teacher ranges (requires denormalized `teacherId` on ClassSession — deferred; see #33).
- [ ] Automated meeting provisioning (Zoom/Meet/Teams APIs) — also listed under Future backlog; manual `meetingUrl` only for MVP.
- [ ] UI for weekly generate (API done; no UI yet).

### Acceptance criteria — core met; stage not complete
- Teacher and student can see scheduled classes within ownership scope. *(met via API + calendar + classes UI)*
- Meeting link opens the configured external classroom when `meetingUrl` is set. *(met)*
- Attendance and notes persist. *(met via API + ClassSession detail UI)*
- Invalid durations are rejected. *(met)*

## Stage 5 — Materials

### Objective
Make class material available in context.

### TODO
- [ ] File upload.
- [ ] PDF/audio/image/link support.
- [ ] Attach to class/course.
- [ ] Access control.
- [ ] Teacher upload.
- [ ] Student download/view.
- [ ] Validation.

### Acceptance criteria
- Student sees only materials they are entitled to access.
- Teachers can manage permitted materials.
- Invalid uploads are rejected safely.

## Stage 6 — Finance

### Objective
Track payments and settlements using the academy's **configurable** revenue split
(not a hardcoded 40/60 forever).

### Business rule — revenue split (academy config)
- Single **current** academy setting: `academyPercentage` ∈ `{20, 30, 40, 50}`.
- Default: **40** (Teacher **60**).
- Teacher share is always derived: `teacherPercentage = 100 - academyPercentage`.
  Do not allow two independent writable percentages.
- Allowed pairs only: 20/80, 30/70, 40/60, 50/50.
- Who may **change** the config: **SUPER_ADMIN** and **DIRECTOR** only.
  ADMINISTRATIVE, TEACHER and STUDENT cannot modify it.
- This is academy-wide current configuration prepared for Finance (same family as
  other academy business config). Payments, settlements, money math and finance
  UI are **not** started until this stage is actively implemented.
- **Freeze (decided, #41):** financial operations that must keep a historical
  split freeze the applicable percentage on that record; later academy-config
  changes do not rewrite frozen rows. Exact freeze trigger timing is left to
  Stage 6 implementation design (not invented here).

### TODO
- [ ] Academy revenue-split configuration (persist current `academyPercentage`;
      validate allowed set; derive teacher %; mutate only SUPER_ADMIN/DIRECTOR).
- [ ] Student pricing.
- [ ] Payment record (apply Freeze principle for historical share — #41).
- [ ] Payment status.
- [ ] Academy share (from configured / frozen `academyPercentage` as applicable).
- [ ] Teacher share (derived `100 - academyPercentage`).
- [ ] Monthly/period settlement (respect Freeze on historical operations).
- [ ] Settlement status.
- [ ] Financial dashboard / Director UI to select among the four pairs.
- [ ] Calculation tests (each allowed pair + default 40/60; reject illegal %;
      frozen rows unaffected by later config changes).

### Acceptance criteria
- Director (and SuperAdmin) can select exactly one of the four allowed splits;
  default is academy 40% / teacher 60%.
- Teacher percentage is never an independent writable value.
- ADMINISTRATIVE / TEACHER / STUDENT cannot change the split.
- For a $100 input under the **active** config, shares match that config
  (e.g. default → academy $40, teacher $60).
- Already-frozen financial operations keep their frozen split after a config
  change (Freeze — #41).
- No floating-point/rounding bug may alter the intended settlement.
- Payments remain decoupled from Finance domain logic.

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
