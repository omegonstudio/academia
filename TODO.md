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

### Done in Stage 1 (partial)
- [x] Provision DIRECTOR via `POST /users/directors` (SUPER_ADMIN only). Role assigned server-side; conflicts if the email already holds another role; password never overwritten on reassert. `requireRole` mounted on this route.
- [x] Provision ADMINISTRATIVE via `POST /users/administratives` (SUPER_ADMIN or DIRECTOR). Same shared provisioning domain/store pattern as DIRECTOR.
- [x] Provision TEACHER via `POST /users/teachers` (SUPER_ADMIN or DIRECTOR). Same shared provisioning domain/store pattern.

### TODO
- [ ] Provision STUDENT.
- [ ] Granular permission model (module/action) beyond the role enum.
- [ ] Director can assign Administrative permissions.
- [ ] Enforce permissions server-side on every route (mount `requireRole` and permission checks beyond director provision).
- [ ] Role-aware dashboard content.
- [ ] Authorization matrix tests, including negative cases per role.
- [ ] Permission-change audit trail.

### Acceptance criteria
- Unauthorized API requests fail.
- UI does not expose inaccessible actions.
- Administrative users can only perform granted actions.
- Director controls Administrative permissions.
- SuperAdmin has technical access.

## Stage 2 — Students & Teachers

### Objective
Create the academy's people registry.

### TODO
- [ ] Student CRUD.
- [ ] Teacher CRUD.
- [ ] Level field.
- [ ] Active/inactive state.
- [ ] Basic profile.
- [ ] Teacher status/availability foundation.
- [ ] Access-control tests.

### Acceptance criteria
- Director/Admin with permission can manage records.
- Teachers cannot see unrelated private data.
- Students can only see their own private data.

## Stage 3 — Assignments & Academic Structure

### Objective
Model who teaches whom and which educational offering they belong to.

### TODO
- [ ] Student-teacher assignment.
- [ ] Assignment history.
- [ ] Prevent teacher self-assignment.
- [ ] 1:1 service: 60/90 minutes.
- [ ] Group service: max 15.
- [ ] Weekly group schedule foundation.
- [ ] Teacher-training course/group.
- [ ] Enrollment model.

### Acceptance criteria
- Director can assign a student to a teacher.
- Assignment is persisted and auditable.
- Teacher cannot create an assignment for themselves.
- Group cannot exceed 15 students.

## Stage 4 — Classes & Calendar

### Objective
Operate real live classes.

### TODO
- [ ] Class session CRUD.
- [ ] 60/90-minute 1:1 validation.
- [ ] 120-minute group validation.
- [ ] Recurrence.
- [ ] Meeting URL.
- [ ] Calendar.
- [ ] Conflict detection.
- [ ] Timezones.
- [ ] Attendance.
- [ ] Class notes.

### Acceptance criteria
- Teacher and student see the same scheduled class.
- Meeting link opens the configured external classroom.
- Attendance and notes persist.
- Invalid durations are rejected.

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
Track the academy's 15% and teacher's 85%.

### TODO
- [ ] Student pricing.
- [ ] Payment record.
- [ ] Payment status.
- [ ] Academy share.
- [ ] Teacher share.
- [ ] Monthly/period settlement.
- [ ] Settlement status.
- [ ] Financial dashboard.
- [ ] Calculation tests.

### Acceptance criteria
For a $100 input:
- academy = $15
- teacher = $85

No floating-point/rounding bug may alter the intended settlement.

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
