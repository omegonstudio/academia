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
| `[x]`  | `/`         | Landing one-page. Anchors `#cursos`, `#metodo`, `#academia`, `#contacto`. Única ruta pública indexable (Fase 4). |
| `[x]`  | —           | **Decisión producto (Fase 4):** no se restauran `/about`, `/courses`, `/teachers`, `/contact` como páginas; contenido en anchors de `/`. Sitemap solo lista `/`. |

Auth & shell: HttpOnly session (`GET /auth/me`). Módulos operativos del dashboard
cableados a API real (Fase 3). Sin DEV bypass. `lib/academy-data.ts` eliminado (Fase 4).

### Private web routes (never indexed)

| Status | Route        | Access                                                                 |
| ------ | ------------ | ---------------------------------------------------------------------- |
| `[x]`  | `/login`     | Real `POST /api/auth/login` (credentials include). No DEV bypass. `noindex`. Redirects to `/dashboard` if session exists. |
| `[x]`  | `/dashboard` | Gated by server `getSession()` → `/login`. Shell identity from `/auth/me`. Hub operativo vía módulos Fase 3. |
| `[x]`  | `/dashboard/membership` | UI planes Nivel Plata (mensual/trimestral/anual). Selección local; sin pagos ni API de suscripción. |
| `[x]`  | `/dashboard/students` | API real `GET/POST /students`. Session gate via layout. |
| `[x]`  | `/dashboard/students/[id]` | API real `GET/PATCH/DELETE`; teacher via `/students/:id/teacher`. |
| `[x]`  | `/dashboard/teachers` | API real `GET/POST /teachers` (+ level, availability). |
| `[x]`  | `/dashboard/teachers/[id]` | API real `GET/PATCH/DELETE`. |
| `[x]`  | `/dashboard/assignments` | API real assign via `POST /students/:id/teacher`. |
| `[x]`  | `/dashboard/courses` | API real `GET/POST /courses` (`courseType`/`serviceType`). Session gate via layout. |
| `[x]`  | `/dashboard/courses/[id]` | API real `GET/PATCH/DELETE` (soft-delete) + sección Materiales (LINK + FILE 3-step). Session gate via layout. |
| `[x]`  | `/dashboard/groups` | API real `GET/POST /groups` (+ teacher/schedule opcionales al crear). Session gate via layout. |
| `[x]`  | `/dashboard/groups/[id]` | API real detail: PATCH/DELETE; teacher; scheduleOptionId; enrollment máx. 15. Session gate via layout. |
| `[x]`  | `/dashboard/calendar` | API real `GET /classes/calendar?from&to` (mes civil). Session gate via layout. |
| `[x]`  | `/dashboard/classes` | API real `GET/POST /classes` + generate `POST /groups/:id/classes/generate`. Session gate via layout. |
| `[x]`  | `/dashboard/classes/[id]` | API real detail: PATCH/DELETE; attendance + notes + materials panels. Session gate via layout. |
| `[x]`  | `/dashboard/administratives` | API real `POST /users/administratives` (create-only; no list). Nav: SUPER_ADMIN/DIRECTOR only. |
| `[x]`  | `/dashboard/permissions` | API real catalog + grant/revoke ADMINISTRATIVE. Nav: SUPER_ADMIN/DIRECTOR only. |
| `[x]`  | `/dashboard/settings` | Session from `/auth/me`; logout `POST /api/auth/logout`. Theme still local. |
| `[x]`  | `/design-system` | Internal UI kit page from academia-front (`noindex` via robots disallow). |

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
| `[x]`  | `GET /openapi.json` | OpenAPI 3 document (schemas from Zod). Gated by `API_DOCS_ENABLED` (off by default in production). |
| `[x]`  | `GET /docs` | Swagger UI; consumes the in-process OpenAPI doc; cookie session via same-origin `/api`. |

The browser reaches these as `/api/*`, proxied at request time by the Next.js
route `app/api/[...path]` using `API_INTERNAL_URL`. In production Compose the
API publishes no host port. On hosted DEV, Vercel runs only `apps/web` and
`API_INTERNAL_URL` points at the separate API DEV host.

### Infrastructure surfaces

| Status | Item                                     | Notes                                                       |
| ------ | ---------------------------------------- | ----------------------------------------------------------- |
| `[x]`  | `docker-compose.yml` + `dev`/`prod` overrides | Isolated by `COMPOSE_PROJECT_NAME`; separate volumes.   |
| `[x]`  | `.github/workflows/ci.yml`               | Lint, typecheck, unit, integration (real PostgreSQL), build, images, secrets hygiene. |
| `[x]`  | `.github/workflows/production.yml`       | `main` only; gated by CI; migrations then health verification. |
| `[x]`  | `robots.txt`                             | Disallows `/dashboard/`, `/login/`, `/api/`.                |
| `[x]`  | `sitemap.xml`                            | Public routes only.                                         |
| `[x]`  | Migration `20260912215052_init_identity` | `users` table + `user_role` enum, snake_case. No destructive statements. |
| `[x]`  | OpenAPI + Swagger (`/openapi.json`, `/docs`) | Cookie-session Try it out; `API_DOCS_ENABLED`; smoke: `docs/API-SMOKE.md`. |

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
- [x] `/dashboard/settings` — session/identity; no editable academy config in Stage 1
- [x] `/dashboard/administratives` — create ADMINISTRATIVE (no list API)
- [x] `/dashboard/permissions` — catalog + grant/revoke ADMINISTRATIVE

TODO:
- Expand authorization matrix across all academy modules (Stage 9).
- Optional: GET list of ADMINISTRATIVE users if a directory is required later.

## Stage 2 — Students & Teachers — DONE (API + UI)

- [x] `/dashboard/students`
- [x] `/dashboard/students/[id]`
- [x] `/dashboard/teachers`
- [x] `/dashboard/teachers/[id]`

Done:
- Student CRUD (API + UI; soft delete; ownership read for STUDENT).
- Teacher CRUD (API + UI; soft delete; availability; ownership read for TEACHER).
- Levels (CEFR), active/inactive, basic profiles, own-read ownership tests.

## Stage 3 — Assignments & Academic Structure — API + UI DONE (history deferred)

- [x] `/dashboard/assignments`
- [x] `/dashboard/courses`
- [x] `/dashboard/courses/[id]`
- [x] `/dashboard/groups`
- [x] `/dashboard/groups/[id]`

Done:
- Student → teacher assignment UI + API (current link only; no history).
- Prevent teacher self-assignment (actor TEACHER blocked server-side).
- Course + Group CRUD UI + API (soft delete; courseType + serviceType; duration derived).
- Group → Teacher UI + API.
- ScheduleOption selection on Group (`scheduleOptionId`; catalog labels).
- Enrollment UI + API (soft deactivate; max 15; capacity display).
- `Course.serviceType` + derived `durationMinutes`; `Course.courseType` REGULAR | TEACHER_TRAINING.

TODO:
- Assignment history.

## Stage 4 — Classes & Calendar — CORE DONE (partial)

- [x] `/dashboard/classes`
- [x] `/dashboard/classes/[id]`
- [x] `/dashboard/calendar`

Done:
- ClassSession CRUD API (`/classes`; duration from serviceType; optional https `meetingUrl`; ScheduleOption required on Group).
- Weekly generation `POST /groups/:id/classes/generate` (idempotent; conflictCount; `classes.create` only; UI deferred).
- Calendar API `GET /classes/calendar` + Calendar UI `/dashboard/calendar`.
- Class Sessions UI: list + detail create/edit/soft-delete; Attendance + Notes panels on detail (API ownership).
- Read + write ownership (Teacher of Group / active Enrollment; generate stays permission-gated).
- Attendance + Class notes APIs + UI on `/dashboard/classes/[id]`.
- Conflict detection; academy business timezone; `UNIQUE(groupId, startAt)`.

TODO / deferred:
- Broader RRULE / advanced recurrence.
- Advanced timezones (per user/group).
- GiST/EXCLUDE (see #33).
- Automated meeting provisioning (Future backlog; manual URL only for MVP).

## Stage 5 — Materials

**Stage 5B API + Storage: DONE.** **Stage 5C UI (contextual): DONE.**

API (cookie session; ownership / entitlement as documented in OpenAPI):

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/materials` | Create LINK (HTTPS only) |
| POST | `/materials/uploads` | FILE intent → PENDING + presigned PUT |
| POST | `/materials/:id/complete` | Verify object → READY |
| GET | `/materials?courseId=` / `?classSessionId=` | Scoped list (XOR required) |
| GET | `/materials/:id` | Metadata (no `storageKey`) |
| GET | `/materials/:id/download` | Signed GET (FILE) or `externalUrl` (LINK) |
| PATCH | `/materials/:id` | title / description |
| DELETE | `/materials/:id` | Soft delete (`isActive=false`; authz = `materials.update`) |

UI (contextual — no materials hub):

- [x] `/dashboard/courses/[id]` — sección **Materiales del curso**
- [x] `/dashboard/classes/[id]` — sección **Materiales de la clase**

Out of scope for Stage 5:

- `/dashboard/materials` / `/dashboard/materials/[id]` (hub)
- `/dashboard/student/materials`, `/dashboard/teacher/materials` (hubs)

Storage: private S3-compatible bucket (MinIO dev / Spaces prod); short-lived signed URLs; no public permanent file URLs.

## Stage 6 — Finance & Settlements

**Stage 6A design: DONE** (`docs/DECISIONS.md` #41 + #44).  
**Stage 6B-1 domain: DONE.**  
**Stage 6B-2 Finance API: DONE** (HTTP + OpenAPI + webhooks stub + MANUAL).  
**Stage 6C Finance UI: DONE** (integrated with API; no mocks).  
**Stage 6D Auto-charge: DONE** (ONE_TO_ONE on ClassSession create/generate;
GROUP_120 on enroll for current academy-timezone month; unique DB constraints;
Payment MANUAL still explicit).

### UI surfaces

- [x] `/dashboard/finance` — settings + charges + payments + allocations + settlements
- [x] `/dashboard/finance/students/[id]` — student charges/payments (API ownership)
- [x] `/dashboard/finance/teachers/[id]` — teacher allocations/settlements
- [x] Academy revenue-split settings on `/dashboard/finance` (SUPER_ADMIN/DIRECTOR PATCH)
- [x] Auto-generated Charges appear on refresh (no frontend create button)
- [ ] Student-facing finance hub (Stage 7)
- [x] Teacher-facing earnings hub (Stage 8) — `/dashboard/teacher/earnings`

### API (mounted)

| Status | Route | Notes |
| ------ | ----- | ----- |
| `[x]` | `GET/PATCH /finance/settings` | PATCH: SUPER_ADMIN/DIRECTOR only |
| `[x]` | `GET/POST /finance/charges`, `GET /finance/charges/:id` | ownership + finance.*; POST admin backfill (idempotent) |
| `[x]` | `GET/POST /finance/payments`, succeed MANUAL, refunds | Freeze on SUCCEEDED |
| `[x]` | `GET /finance/allocations` (+ `:id`) | read-only immutable |
| `[x]` | `GET/POST /finance/settlements`, mark-paid | OPEN → MARKED_PAID |
| `[x]` | `POST /finance/webhooks/mercado-pago\|stripe` | idempotent WebhookEvent; signature TODO |
| `[x]` | `POST /classes` + generate | side-effect: auto Charge ONE_TO_ONE when priced + enrolled |
| `[x]` | `POST /groups/:id/students` | side-effect: auto monthly Charge GROUP_120 |

### Product rules (reference)

- Freeze on Payment SUCCEEDED → RevenueAllocation (#44).
- ONE_TO_ONE → Charge per ClassSession; GROUP_120 → Charge per Enrollment + month.
- ARS → MP; USD → Stripe; MANUAL admin; 1 Payment → 1 Charge.
- Automated payouts, FX, partial refunds, chargebacks, ledger/invoices/taxes = future.

## Stage 7 — Student Experience

**Stage 7A Student Hub MVP: DONE** (self-scoped session APIs + UI).

### UI

- [x] `/dashboard/student` — próxima clase (calendar scoped)
- [x] `/dashboard/student/classes` — próximas / pasadas
- [x] `/dashboard/student/materials` — materiales entitled (READY)
- [x] `/dashboard/student/attendance` — historial read-only
- [x] `/dashboard/student/finance` — charges/payments + Pagar (OPEN)
- [ ] `/dashboard/student/progress` — futuro

### API (mounted)

| Status | Route | Notes |
| ------ | ----- | ----- |
| `[x]` | `GET /students/me` | Session STUDENT → own profile |
| `[x]` | `GET /students/me/materials` | Entitlement via enrollment |
| `[x]` | `GET /students/me/attendance?from&to` | Own rows + class context |
| `[x]` | `GET /students/me/finance` | Curated charges/payments/refunds + summary; no split |
| `[x]` | `POST /students/me/finance/charges/:chargeId/pay` | Owned OPEN → Payment PENDING (currency→provider stub) |
| `[x]` | `GET /classes/calendar` | Reused; student scope by session |

### Product rules

- Never trust client `studentId` for hub reads or checkout.
- STUDENT cannot write attendance / materials / classes.
- Student Finance omits academy/teacher split + settlements.
- Checkout creates PENDING only; SUCCEEDED via webhook stub (no student “mark paid”).

## Stage 8 — Teacher Experience

**Stage 8 Teacher Hub MVP: DONE** (self-scoped session APIs + UI).

### UI

- [x] `/dashboard/teacher` — próxima clase + resumen del día
- [x] `/dashboard/teacher/classes` — próximas / pasadas
- [x] `/dashboard/teacher/students` — Assignment ∪ grupos propios
- [x] `/dashboard/teacher/attendance` — historial read-only
- [x] `/dashboard/teacher/materials` — materiales owned
- [x] `/dashboard/teacher/earnings` — allocations + settlements RO

### API (mounted)

| Status | Route | Notes |
| ------ | ----- | ----- |
| `[x]` | `GET /teachers/me` | Session TEACHER → own profile |
| `[x]` | `GET /teachers/me/students` | Assignment ∪ Enrollment |
| `[x]` | `GET /teachers/me/materials` | Group.teacherId ownership |
| `[x]` | `GET /teachers/me/attendance?from&to` | Own ClassSessions |
| `[x]` | `GET /classes/calendar` | Reused; teacher scope by session |
| `[x]` | `GET /finance/allocations` / `settlements` | Forced teacherId from session |
| `[x]` | Group read / roster | Teacher ownership bypass for own groups |

### Product rules

- Never trust client `teacherId` for hub reads.
- TEACHER cannot read other teachers' classes/students/earnings.
- Earnings are read-only (no mark-paid / settings).

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
