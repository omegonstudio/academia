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
| `[x]`  | `/dashboard/students` | Authenticated. Lista/crea estudiantes vía API real (loading/error/vacío). |
| `[x]`  | `/dashboard/students/[id]` | Authenticated. Detalle + edición/desactivación según permiso. |
| `[x]`  | `/dashboard/teachers` | Authenticated. Lista/crea profesores vía API real (loading/error/vacío). |
| `[x]`  | `/dashboard/teachers/[id]` | Authenticated. Detalle + edición/desactivación según permiso. |
| `[x]`  | `/dashboard/calendar` | Authenticated. Calendario mensual de clases vía `GET /classes/calendar` (SSR; loading implícito; error/vacío; ownership en API). |

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

- [x] `/dashboard/students`
- [x] `/dashboard/students/[id]`
- [x] `/dashboard/teachers`
- [x] `/dashboard/teachers/[id]`

TODO:
- Student CRUD (API + UI done; soft delete; ownership read for STUDENT).
- Teacher CRUD (API + UI done; soft delete; availability; ownership read for TEACHER).
- Levels (Student/Teacher CEFR done).
- Status (Student/Teacher active/inactive done).
- Basic profiles (Student/Teacher done).
- Ownership/access rules (own-read for STUDENT and TEACHER done).

## Stage 3 — Assignments & Academic Structure

- [ ] `/dashboard/assignments`
- [ ] `/dashboard/courses`
- [ ] `/dashboard/courses/[id]`
- [ ] `/dashboard/groups`
- [ ] `/dashboard/groups/[id]`

TODO:
- Student → teacher assignment (API done: `GET|POST|DELETE /students/:id/teacher`; current link only; no history UI).
- Prevent teacher self-assignment (done: actor TEACHER blocked server-side).
- Course + Group foundation (API done: `/courses` + `/groups` CRUD; soft delete; no UI; no schedule/enrollment yet).
- Group → Teacher (API done: `GET|POST|DELETE /groups/:id/teacher`).
- ScheduleOption foundation (API done: `/schedule-options` CRUD; Group.scheduleOptionId via PATCH).
- Enrollment model (API done: `GET|POST /groups/:id/students`, `DELETE .../:studentId`; soft deactivate).
- Group max 15 (done: domain + FOR UPDATE; 15th ok / 16th rejected).
- 1:1 / Group service configuration (done: `Course.serviceType` + derived `durationMinutes`).
- Teacher-training course/group model (done: `Course.courseType` REGULAR | TEACHER_TRAINING).
- Weekly group schedule foundation (catalog done; ClassSession/calendar still Stage 4).

## Stage 4 — Classes & Calendar

- [ ] `/dashboard/classes`
- [ ] `/dashboard/classes/[id]`
- [x] `/dashboard/calendar`

TODO:
- Class session CRUD (API done: `/classes`; duration from Course.serviceType; optional https `meetingUrl`; Group must have ScheduleOption).
- 60/90-minute 1:1 + 120-minute group validation (done via serviceType derivation).
- Weekly generation `POST /groups/:id/classes/generate` — done (ScheduleOption weekday + local HH:mm → timestamptz via academy timezone; idempotent; conflictCount; meetingUrl null).
- Broader recurrence / RRULE — still open.
- Calendar API `GET /classes/calendar` — done (civil range → absolute window; nested Group/Course/Teacher; meetingUrl; Teacher/Student ownership).
- Calendar UI `/dashboard/calendar` — done (month list via API; no create/edit from UI).
- Teacher/student membership ownership for class reads — done (Group.teacherId / active Enrollment).
- ClassSession write ownership — done (`POST`/`PATCH`/`DELETE`; Teacher of Group; generate stays `classes.create`).
- Zoom/Google Meet link — manual URL done; automated provisioning still future.
- Attendance — done (`/classes/:id/attendance`; PRESENT|ABSENT; active Enrollment; Teacher write ownership; Student self-read).
- Class notes — done (`/classes/:id/notes`; content; Teacher write ownership; Student read-only).
- Conflict detection — done (same Teacher overlap; create/PATCH 409; generate skips conflicts).
- Timezone handling beyond single academy business zone.

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
