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
| `[x]`  | `/dashboard` | Authenticated only. `noindex, nofollow`. Server-side redirect to `/login`. Session identity + role-aware hub; nav to students, teachers, classes, calendar. |
| `[x]`  | `/dashboard/students` | Authenticated. Lista/crea estudiantes vía API real (loading/error/vacío). |
| `[x]`  | `/dashboard/students/[id]` | Authenticated. Detalle + edición/desactivación según permiso. |
| `[x]`  | `/dashboard/teachers` | Authenticated. Lista/crea profesores vía API real (loading/error/vacío). |
| `[x]`  | `/dashboard/teachers/[id]` | Authenticated. Detalle + edición/desactivación según permiso. |
| `[x]`  | `/dashboard/calendar` | Authenticated. Calendario mensual de clases vía `GET /classes/calendar` (SSR; loading implícito; error/vacío; ownership en API). |
| `[x]`  | `/dashboard/classes` | Authenticated. Lista clases vía `GET /classes`; create (no STUDENT) vía `POST /classes`; nombres de grupo vía `GET /groups` cuando hay permiso. |
| `[x]`  | `/dashboard/classes/[id]` | Authenticated. Detalle + edit/deactivate según ownership/permiso API; Student read-only. |

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
| `[x]`  | `GET /students` | `requirePermission(students, read)`. Lista perfiles académicos. |
| `[x]`  | `POST /students` | `requirePermission(students, create)`. Crea User+Student o perfil sobre STUDENT existente. |
| `[x]`  | `GET /students/:id` | `students.read` o el propio STUDENT (ownership). Sin secretos de User. |
| `[x]`  | `PATCH /students/:id` | `requirePermission(students, update)`. |
| `[x]`  | `DELETE /students/:id` | `requirePermission(students, delete)`. Baja lógica (`isActive=false`). |
| `[x]`  | `GET /teachers` | `requirePermission(teachers, read)`. Lista perfiles académicos. |
| `[x]`  | `POST /teachers` | `requirePermission(teachers, create)`. Crea User+Teacher o perfil sobre TEACHER existente. |
| `[x]`  | `GET /teachers/:id` | `teachers.read` o el propio TEACHER (ownership). Sin secretos de User. |
| `[x]`  | `PATCH /teachers/:id` | `requirePermission(teachers, update)`. |
| `[x]`  | `DELETE /teachers/:id` | `requirePermission(teachers, delete)`. Baja lógica (`isActive=false`). |
| `[x]`  | `GET /students/:id/teacher` | `assignments.read` o el propio STUDENT. Asignación actual. |
| `[x]`  | `POST /students/:id/teacher` | `requirePermission(assignments, create)`. Asigna/reemplaza profesor. TEACHER no puede autoasignarse (actor = sesión). |
| `[x]`  | `DELETE /students/:id/teacher` | `requirePermission(assignments, update)`. Quita la asignación actual. |
| `[x]`  | `GET /courses` | `requirePermission(courses, read)`. |
| `[x]`  | `POST /courses` | `requirePermission(courses, create)`. Requiere `courseType` + `serviceType`. |
| `[x]`  | `GET /courses/:id` | `requirePermission(courses, read)`. Incluye `courseType` y `durationMinutes` derivado. |
| `[x]`  | `PATCH /courses/:id` | `requirePermission(courses, update)`. Puede cambiar `courseType` / `serviceType`. |
| `[x]`  | `DELETE /courses/:id` | `requirePermission(courses, delete)`. Baja lógica (`isActive=false`). |
| `[x]`  | `GET /groups` | `requirePermission(groups, read)`. |
| `[x]`  | `POST /groups` | `requirePermission(groups, create)`. Requiere Course existente y activo. |
| `[x]`  | `GET /groups/:id` | `requirePermission(groups, read)`. |
| `[x]`  | `PATCH /groups/:id` | `requirePermission(groups, update)`. Incluye `scheduleOptionId` opcional (opción activa). |
| `[x]`  | `DELETE /groups/:id` | `requirePermission(groups, delete)`. Baja lógica (`isActive=false`). |
| `[x]`  | `GET /groups/:id/teacher` | `requirePermission(groups, read)`. Teacher actual del grupo. |
| `[x]`  | `POST /groups/:id/teacher` | `requirePermission(groups, update)`. Asigna/reemplaza teacher (activo). Self-assign TEACHER permitido con permiso. |
| `[x]`  | `DELETE /groups/:id/teacher` | `requirePermission(groups, update)`. Quita teacher del grupo. |
| `[x]`  | `GET /schedule-options` | `requirePermission(schedules, read)`. Catálogo de franjas semanales (dropdown-ready). |
| `[x]`  | `POST /schedule-options` | `requirePermission(schedules, create)`. day + start/end HH:mm; label derivado. |
| `[x]`  | `GET /schedule-options/:id` | `requirePermission(schedules, read)`. |
| `[x]`  | `PATCH /schedule-options/:id` | `requirePermission(schedules, update)`. |
| `[x]`  | `DELETE /schedule-options/:id` | `requirePermission(schedules, delete)`. Baja lógica. |
| `[x]`  | `GET /groups/:id/students` | `requirePermission(groups, read)`. Enrollments activos (ids; sin perfil privado extra). |
| `[x]`  | `POST /groups/:id/students` | `requirePermission(groups, update)`. Enroll Student activo; máx. 15; sin auto-assignment Teacher. |
| `[x]`  | `DELETE /groups/:id/students/:studentId` | `requirePermission(groups, update)`. Baja lógica del enrollment. |
| `[x]`  | `GET /classes` | Auth. `classes.read` → todas; TEACHER → Groups propios; STUDENT → Groups con Enrollment activo. `?groupId=` opcional. |
| `[x]`  | `POST /classes` | Auth. `classes.create` (admin) o TEACHER del Group. `groupId` + `startAt` + `meetingUrl?`; duración de Course.serviceType. Overlap → 409. |
| `[x]`  | `GET /classes/:id` | Auth. Misma regla ownership que list; IDOR → 403. Incluye meetingUrl. |
| `[x]`  | `PATCH /classes/:id` | Auth. `classes.update` (admin) o TEACHER del Group. `startAt` / `isActive` / `meetingUrl`. Overlap → 409 al reschedule. |
| `[x]`  | `DELETE /classes/:id` | Auth. `classes.delete` (admin) o TEACHER del Group. Baja lógica (`isActive=false`). |
| `[x]`  | `POST /groups/:id/classes/generate` | `requirePermission(classes, create)` solamente (sin bypass por ownership de Teacher). `{ from, to }`; ScheduleOption + academy timezone; `generatedCount` / `skippedCount` / `conflictCount`; `meetingUrl=null`; `UNIQUE(groupId, startAt)`. |
| `[x]`  | `GET /classes/calendar` | Auth. Mismo ownership que list; `?from&to` civil (academy timezone); active by `startAt`; nested group/course/teacher + meetingUrl; máx. 93 días. |
| `[x]`  | `GET /classes/:id/attendance` | Auth. Misma ownership de ClassSession; admin/Teacher → todos; STUDENT → solo su fila. Student: `{id,firstName,lastName}`. |
| `[x]`  | `POST /classes/:id/attendance` | `classes.update` o TEACHER del Group. `{studentId,status}`; enrollment activo; `UNIQUE(classSessionId,studentId)` → 409. |
| `[x]`  | `PATCH /classes/:id/attendance/:studentId` | Misma escritura que POST. Solo `status` PRESENT↔ABSENT. Sin DELETE. |
| `[x]`  | `GET /classes/:id/notes` | Auth. Misma ownership de ClassSession; lista `createdAt ASC, id ASC`. |
| `[x]`  | `POST /classes/:id/notes` | `classes.update` o TEACHER del Group. `{content}` trim 1–4000. |
| `[x]`  | `PATCH /classes/:id/notes/:noteId` | Misma escritura. Solo `content`; note debe pertenecer a `:id`. |
| `[x]`  | `DELETE /classes/:id/notes/:noteId` | Misma escritura. Hard delete 204. |

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
- [x] Permission model (DB + domain + HTTP) — `permissions` / `role_permissions`; catalog; `hasPermission`; admin grant/revoke API
- [x] `GET /permissions/catalog` — `requirePermission(permissions, read)`
- [x] `GET|POST|DELETE /roles/administrative/permissions` — read / update via `requirePermission`
- [x] `requirePermission(module, action)` — mounted on permission-management and user-provisioning; academy routes use `requirePermission` and/or ownership
- [x] `/dashboard` — role-aware hub + links to existing modules
- [x] Permission-change audit trail — DB append on GRANT/REVOKE (no list UI yet)
- [x] Authorization matrix for **Stage 1** API routes (`authorization-matrix.test.ts`) — not a full multi-module matrix
- [ ] `/dashboard/settings`
- [ ] `/dashboard/administratives`
- [ ] `/dashboard/permissions`

TODO:
- Director-managed Administrative permissions UI (`/dashboard/permissions`).
- Expand authorization matrix across all academy modules (Stage 9).

## Stage 2 — Students & Teachers — DONE (API + UI)

- [x] `/dashboard/students`
- [x] `/dashboard/students/[id]`
- [x] `/dashboard/teachers`
- [x] `/dashboard/teachers/[id]`

Done:
- Student CRUD (API + UI; soft delete; ownership read for STUDENT).
- Teacher CRUD (API + UI; soft delete; availability; ownership read for TEACHER).
- Levels (CEFR), active/inactive, basic profiles, own-read ownership tests.

## Stage 3 — Assignments & Academic Structure — API DONE (UI pending)

- [ ] `/dashboard/assignments`
- [ ] `/dashboard/courses`
- [ ] `/dashboard/courses/[id]`
- [ ] `/dashboard/groups`
- [ ] `/dashboard/groups/[id]`

Done (API only unless noted):
- Student → teacher assignment (`GET|POST|DELETE /students/:id/teacher`; current link only; no history).
- Prevent teacher self-assignment (actor TEACHER blocked server-side).
- Course + Group CRUD (soft delete; **sin UI**).
- Group → Teacher (`GET|POST|DELETE /groups/:id/teacher`).
- ScheduleOption CRUD + Group.scheduleOptionId.
- Enrollment (`GET|POST /groups/:id/students`, `DELETE .../:studentId`; soft deactivate; max 15).
- `Course.serviceType` + derived `durationMinutes`; `Course.courseType` REGULAR | TEACHER_TRAINING.
- Weekly schedule **catalog** (ScheduleOption). ClassSession generate/calendar → Stage 4.

TODO:
- Assignment history.
- UI for assignments / courses / groups.

## Stage 4 — Classes & Calendar — CORE DONE (partial)

- [x] `/dashboard/classes`
- [x] `/dashboard/classes/[id]`
- [x] `/dashboard/calendar`

Done:
- ClassSession CRUD API (`/classes`; duration from serviceType; optional https `meetingUrl`; ScheduleOption required on Group).
- Weekly generation `POST /groups/:id/classes/generate` (idempotent; conflictCount; `classes.create` only).
- Calendar API `GET /classes/calendar` + Calendar UI `/dashboard/calendar`.
- Class Sessions UI: list + detail create/edit/soft-delete (API ownership; no generate UI; no attendance/notes UI).
- Read + write ownership (Teacher of Group / active Enrollment; generate stays permission-gated).
- Attendance + Class notes APIs.
- Conflict detection; academy business timezone; `UNIQUE(groupId, startAt)`.

TODO / deferred:
- Broader RRULE / advanced recurrence.
- Advanced timezones (per user/group).
- GiST/EXCLUDE (see #33).
- Automated meeting provisioning (Future backlog; manual URL only for MVP).
- Generate / attendance / notes UI (API done; dedicated UX later / Stages 7–8).

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
- [ ] Academy revenue-split settings surface (exact route TBD; Director/SuperAdmin write only)

TODO:
- Persist current academy `academyPercentage` ∈ {20, 30, 40, 50}; default 40.
- Derive teacher share as `100 - academyPercentage` (pairs 20/80, 30/70, 40/60, 50/50 only).
- Mutation: SUPER_ADMIN + DIRECTOR only (not ADMINISTRATIVE / TEACHER / STUDENT).
- Freeze: historical financial operations keep frozen share; later config changes do not rewrite them (#41). Exact freeze trigger TBD at implementation.
- Student price.
- Payment status.
- Period-based settlement.
- Settlement status.
- Basic reporting.
- Tests for financial calculations under each allowed pair (+ freeze immutability).
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
- Earnings visibility driven by academy revenue-split config (derived teacher %).
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
