# Route Map — Academia

> Source of truth for application navigation and planned routes.
> Update this file in every PR that adds, changes, removes or materially changes a route.

Legend:
- `[x]` Implemented and validated
- `[~]` Partially implemented
- `[ ]` Planned
- `[!]` Blocked / decision required

## Stage 0 — Foundation + Infrastructure — COMPLETE

### Public web routes (indexable)

| Status | Route       | Notes                                                              |
| ------ | ----------- | ------------------------------------------------------------------ |
| `[x]`  | `/`         | Landing. Static. Unique title/description, canonical, Open Graph.  |
| `[x]`  | `/about`    | Academy information. Static.                                       |
| `[x]`  | `/courses`  | 1:1, group and teacher-training offerings. Static.                 |
| `[x]`  | `/teachers` | How the teacher network works. Static. No public directory yet.    |
| `[x]`  | `/contact`  | `mailto` link — deliberately not a form, since no message store exists. |

All public pages: `lang="es"`, one `<h1>`, skip link, landmarks, verified contrast.

### Private web routes (never indexed)

| Status | Route        | Access                                                                 |
| ------ | ------------ | ---------------------------------------------------------------------- |
| `[x]`  | `/login`     | Public. `noindex, nofollow`. Redirects to `/dashboard` if already authenticated. |
| `[x]`  | `/dashboard` | Authenticated only. `noindex, nofollow`. Server-side redirect to `/login`. Session identity + **role-aware** copy from server session role. No academy modules yet. |

### API routes

| Status | Route              | Notes                                                                    |
| ------ | ------------------ | ------------------------------------------------------------------------ |
| `[x]`  | `GET /health`      | 200/`ok` or 503/`degraded`. Separates `configuration` from `database`. No secrets. |
| `[x]`  | `POST /auth/login` | Zod-validated. Sets HttpOnly cookie. Throttled per IP. Identical 401 for every failure. |
| `[x]`  | `POST /auth/logout`| 204, clears the cookie.                                                  |
| `[x]`  | `GET /auth/me`     | Requires a valid session; reloads the user, so revocation is immediate.  |
| `[x]`  | `POST /users/directors` | SUPER_ADMIN + `requirePermission(users, create)`. Provisions DIRECTOR. |
| `[x]`  | `POST /users/administratives` | `requirePermission(users, create)`. SUPER_ADMIN/DIRECTOR bypass. |
| `[x]`  | `POST /users/teachers` | `requirePermission(users, create)`. SUPER_ADMIN/DIRECTOR bypass. |
| `[x]`  | `POST /users/students` | `requirePermission(users, create)`. SUPER_ADMIN/DIRECTOR bypass; TEACHER denied without grant. |
| `[x]`  | `GET /permissions/catalog` | `authenticate` + `requirePermission(permissions, read)`. SUPER_ADMIN/DIRECTOR bypass; others need grant. |
| `[x]`  | `GET /roles/administrative/permissions` | `requirePermission(permissions, read)`. Lists ADMINISTRATIVE grants. |
| `[x]`  | `POST /roles/administrative/permissions` | `requirePermission(permissions, update)`. Grants to ADMINISTRATIVE (idempotent 201/200). |
| `[x]`  | `DELETE /roles/administrative/permissions` | `requirePermission(permissions, update)`. Revokes from ADMINISTRATIVE (idempotent 204). |

The browser reaches these as `/api/*`, rewritten by Next.js. In production the
API publishes no host port.

### Infrastructure surfaces

| Status | Item                                     | Notes                                                       |
| ------ | ---------------------------------------- | ----------------------------------------------------------- |
| `[x]`  | `docker-compose.yml` + `dev`/`prod` overrides | Isolated by `COMPOSE_PROJECT_NAME`; separate volumes.   |
| `[x]`  | `.github/workflows/ci.yml`               | Lint, typecheck, unit, integration (real PostgreSQL), build, images, secrets hygiene. |
| `[x]`  | `.github/workflows/production.yml`       | `main` only; gated by CI; migrations then health verification. |
| `[x]`  | `robots.txt`                             | Disallows `/dashboard/`, `/login/`, `/api/`.                |
| `[x]`  | `sitemap.xml`                            | Public routes only.                                         |
| `[x]`  | Migration `20260912215052_init_identity` | `users` table + `user_role` enum, snake_case. No destructive statements. |

### Carried forward
- Public teacher directory → later stage, once teacher data exists and privacy is decided.
- Contact form with persistence → later stage; a form that discarded messages would be a fake feature.

## Stage 1 — Identity, Roles & Permissions

- [x] `POST /users/directors` — SUPER_ADMIN + `requirePermission(users, create)`
- [x] `POST /users/administratives` — `requirePermission(users, create)`
- [x] `POST /users/teachers` — `requirePermission(users, create)`
- [x] `POST /users/students` — `requirePermission(users, create)`
- [x] Permission model (DB + domain) — `permissions` / `role_permissions` tables; catalog seed; `hasPermission` (no HTTP surface yet)
- [x] `GET /permissions/catalog` — `requirePermission(permissions, read)`
- [x] `GET|POST|DELETE /roles/administrative/permissions` — read / update via `requirePermission`
- [x] `requirePermission(module, action)` — mounted on permission-management and user-provisioning routes
- [x] `/dashboard` — role-aware content from server session (no academy modules yet)
- [x] Permission-change audit trail — DB append on GRANT/REVOKE (no list UI yet)
- [ ] `/dashboard/settings`
- [ ] `/dashboard/administratives`
- [ ] `/dashboard/permissions`

TODO:
- Mount `requirePermission` on remaining academy feature routes.
- Director-managed Administrative permissions UI (`/dashboard/permissions`).
- SuperAdmin bootstrap for `omegon.info@gmail.com` (done in Stage 0).
- Authorization matrix for protected Stage 1 API routes (done in suite `authorization-matrix.test.ts`).
- Audit sensitive permission changes (GRANT/REVOKE trail done; broader audit later).

## Stage 2 — Students & Teachers

- [ ] `/dashboard/students`
- [ ] `/dashboard/students/[id]`
- [ ] `/dashboard/teachers`
- [ ] `/dashboard/teachers/[id]`

TODO:
- Student CRUD.
- Teacher CRUD.
- Levels.
- Status.
- Basic profiles.
- Ownership/access rules.

## Stage 3 — Assignments & Academic Structure

- [ ] `/dashboard/assignments`
- [ ] `/dashboard/courses`
- [ ] `/dashboard/courses/[id]`
- [ ] `/dashboard/groups`
- [ ] `/dashboard/groups/[id]`

TODO:
- Student → teacher assignment.
- Prevent teacher self-assignment.
- 1:1 service configuration.
- Group max 15 validation.
- Teacher-training course/group model.
- Enrollment history.

## Stage 4 — Classes & Calendar

- [ ] `/dashboard/classes`
- [ ] `/dashboard/classes/[id]`
- [ ] `/dashboard/calendar`

TODO:
- 60/90-minute 1:1 classes.
- 120-minute group classes.
- Recurrence support where appropriate.
- Teacher/student membership.
- Zoom/Google Meet link.
- Attendance.
- Class notes.
- Conflict detection.
- Timezone handling.

## Stage 5 — Materials

- [ ] `/dashboard/materials`
- [ ] `/dashboard/materials/[id]`

TODO:
- Upload/manage PDF, audio, image and links.
- Attach material to class/course.
- Student access control.
- Teacher upload permissions.
- File size/type validation.

## Stage 6 — Finance & Settlements

- [ ] `/dashboard/finance`
- [ ] `/dashboard/finance/students/[id]`
- [ ] `/dashboard/finance/teachers/[id]`

TODO:
- Student price.
- Payment status.
- Academy 15%.
- Teacher 85%.
- Period-based settlement.
- Settlement status.
- Basic reporting.
- Tests for financial calculations.
- Keep automated payouts as future scope.

## Stage 7 — Student Experience

- [ ] `/dashboard/student`
- [ ] `/dashboard/student/classes`
- [ ] `/dashboard/student/materials`
- [ ] `/dashboard/student/progress`

TODO:
- Next class.
- Meeting link.
- Materials.
- Attendance history.
- Basic progress.
- Empty/loading/error states.

## Stage 8 — Teacher Experience

- [ ] `/dashboard/teacher`
- [ ] `/dashboard/teacher/students`
- [ ] `/dashboard/teacher/classes`
- [ ] `/dashboard/teacher/materials`
- [ ] `/dashboard/teacher/earnings`

TODO:
- Assigned students.
- Upcoming classes.
- Class notes.
- Attendance.
- Material management.
- 85% earnings visibility.
- Prevent access to other teachers' students.

## Stage 9 — Production Hardening

- [ ] Public SEO pages finalized
- [ ] Sitemap
- [ ] Robots
- [ ] Structured data where justified
- [ ] Accessibility audit
- [ ] Security audit
- [ ] Error monitoring
- [ ] Backup/recovery
- [ ] Observability
- [ ] Production deployment

TODO:
- Core Web Vitals.
- WCAG 2.2 AA review.
- Auth/session security review.
- Authorization matrix review.
- Privacy review.
- Production environment checklist.

## Future — Explicitly Not MVP

- [ ] Native video classroom
- [ ] AI language tutor
- [ ] Gamification
- [ ] Internal messaging/chat
- [ ] Mobile app
- [ ] Public teacher marketplace
- [ ] Automated teacher payouts
- [ ] Advanced CRM
- [ ] Advanced certification
- [ ] Automated Zoom/Google Meet provisioning
- [ ] Advanced analytics
