# Frontend ↔ Backend Integration Contract

> **Auditoría / documentación solamente.** Generado desde el código real del
> monorepo `academia` y del clone sibling `academia-front` (UI v0 con datos demo).
> No inventa endpoints. Donde el código no alcanza: **UNKNOWN**.
>
> Convención de paths:
> - Express monta rutas **sin** prefijo `/api` (ej. `POST /auth/login`).
> - El browser Next llama **`/api/...`** (rewrite → `API_INTERNAL_URL`).
> - SSR en `apps/web` llama al API interno **sin** `/api`.
>
> Fuentes primarias: `apps/api/src/http/**`, `packages/shared/src/**`,
> `apps/web/next.config.ts`. Referencia histórica UI demo: sibling `academia-front`
> (el monorepo ya no usa `lib/academy-data.ts` — eliminado en Fase 4).
>
> Nota git (2026-09-24): `git pull` en `featured/stage-5` no tenía upstream;
> se ejecutó `git fetch` + `git pull origin main` (merge). El working tree
> también contiene dominio Finance **sin HTTP** (WIP local).

---

## Architecture

| Capa | Ubicación | Rol |
| ---- | --------- | --- |
| Frontend (nuevo, demo) | `/home/titin/Documentos/omegon/00-OMEGON/academia-front` | Next 16 App Router, shadcn, datos en `lib/academy-data.ts` |
| Frontend (monorepo, ya cableado) | `apps/web` | Next 16, proxy `/api`, sesión real, CRUD Stages 1–5 |
| Backend / API | `apps/api` | Express 5 + TypeScript, cookie session |
| Shared types | `packages/shared` | Zod schemas / DTOs / permissions catalog |
| ORM | Prisma 7 | `apps/api/prisma/schema.prisma` |
| DB | PostgreSQL 17 | `Timestamptz(3)` en instantes de clase |
| Auth | JWT HS256 en cookie `academia_session` | Stateless; user reload por request |
| Authz | `authenticate` + `requirePermission` / ownership | SUPER_ADMIN/DIRECTOR bypass catálogo |
| Env | `.env.example`, Compose | Separación web vs API secrets |
| Docker | `docker-compose*.yml`, Dockerfiles | web + api + db (+ MinIO materials) |
| Rutas UI | `ROUTE-MAP.md` | Source of truth de navegación monorepo |

**Flujo browser:** `fetch('/api/...')` same-origin → Next rewrite → Express.

**Finance:** dominio + shared types existen en working tree; **sin routers HTTP**.

---

## Authentication

### Endpoints

| UI action | HTTP | Endpoint (Express) | Browser path | Request | Response | Auth | Status |
| --------- | ---- | ------------------ | ------------ | ------- | -------- | ---- | ------ |
| Ingresar | POST | `/auth/login` | `/api/auth/login` | `{ email, password }` | `{ user }` + `Set-Cookie` | No (rate limit) | 200 / 400 / 401 / 429 |
| Sesión actual | GET | `/auth/me` | (SSR interno o `/api/auth/me`) | — | `{ user }` | Cookie | 200 / 401 |
| Cerrar sesión | POST | `/auth/logout` | `/api/auth/logout` | — | vacío | No | 204 |

`SessionUser` (`packages/shared/src/auth.ts`):
`{ id: string, email: string, name: string | null, role: Role }`.

### Mecanismo de sesión

| Atributo | Valor real |
| -------- | ---------- |
| Cookie name | `academia_session` |
| Contenido | JWT HS256 (`jose`), claims `sub`=userId, `role`, `iss=academia` |
| httpOnly | `true` |
| sameSite | `Lax` |
| path | `/` |
| secure | `true` solo si `NODE_ENV === 'production'` |
| TTL | `AUTH_SESSION_TTL` (default **604800** s = 7 días) |
| Store server-side | **No** (stateless JWT) |
| Validación | Cookie → verify JWT → `loadActiveUser(userId)` (revoca si inactivo) |

El `role` del JWT es hint; la autoridad es el usuario recargado.

### Roles

`SUPER_ADMIN` \| `DIRECTOR` \| `ADMINISTRATIVE` \| `TEACHER` \| `STUDENT`
(`packages/shared/src/roles.ts`).

### Guards

| Middleware | Comportamiento |
| ---------- | -------------- |
| `authenticate` | Sin cookie / JWT inválido / user inactivo → **401** `UNAUTHORIZED` |
| `requireRole(...roles)` | Autenticado pero rol no permitido → **403** `FORBIDDEN` |
| `requirePermission(module, action)` | Sin grant (y no bypass) → **403**; SUPER_ADMIN/DIRECTOR bypass |
| Ownership (classes/materials/students/teachers) | IDOR → **403**; recurso ausente → **404** |

### Login throttle

`POST /auth/login`: 10 intentos / 15 min por IP (in-memory) → **429** `TOO_MANY_REQUESTS`.

### academia-front (estado actual)

- Formulario real llama `POST /api/auth/login` con `credentials: 'include'`.
- **DEV bypass** local: `localStorage['academy-dev-session']` + password hardcode
  `academia` — **no es contrato de backend**; debe eliminarse al integrar.
- **No** consume `GET /auth/me` ni `POST /auth/logout`.

---

## Roles & Authorization

### Bypass

- `SUPER_ADMIN` y `DIRECTOR`: `hasPermission` siempre true para pares del catálogo.
- `ADMINISTRATIVE`: solo grants en `RolePermission`.
- `TEACHER` / `STUDENT`: permisos de catálogo **o** ownership de dominio
  (clases, materiales, self-read de profile).

### Catálogo (`PERMISSION_CATALOG`)

Módulos: `students`, `teachers`, `assignments`, `courses`, `groups`, `schedules`,
`classes`, `materials`, `finance`, `users`, `permissions`.  
Actions: `read` \| `create` \| `update` \| `delete` (no todos en todos los módulos;
`materials` no tiene `delete` en catálogo — soft delete usa `materials.update`).

### Discrepancias UI (academia-front) vs backend

| UI actual | Backend |
| --------- | ------- |
| Nav fija muestra Permisos/Administrativos a todos | Solo SUPER_ADMIN/DIRECTOR deberían ver esas entradas (API exige grants/bypass) |
| Permisos: matrix local + fake save | Grant/revoke HTTP real por `(module, action)` |
| Settings hardcode “Director / Omegon” | Rol viene de `/auth/me` |
| Sin gates por rol en mutaciones demo | API rechaza 403 |

---

## API Endpoints

Índice de secciones siguientes. **Sin paginación** en ningún listado auditado.
**Filtros:** solo los query params documentados abajo.

Envelope de error universal:

```json
{ "error": { "code": "BAD_REQUEST|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|CONFLICT|TOO_MANY_REQUESTS|INTERNAL_ERROR", "message": "..." } }
```

Validación Zod → casi siempre **400** con `message` string (sin `issues[]`).

---

## Students

Schemas: `packages/shared/src/students.ts` · Router: `student-registry.ts`

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Listar | GET | `/students` | — | `{ students: Student[] }` | `students.read` | 200 / 401 / 403 |
| Crear | POST | `/students` | `{ email, password?, firstName, lastName, level, isActive? }` | `{ student }` | `students.create` | 201 / 400 / 409 |
| Ver detalle | GET | `/students/:id` | — | `{ student }` | `students.read` **o** STUDENT dueño | 200 / 403 / 404 |
| Editar | PATCH | `/students/:id` | ≥1 de `firstName,lastName,level,isActive` | `{ student }` | `students.update` | 200 / 400 / 404 |
| Desactivar | DELETE | `/students/:id` | — | `{ student }` `isActive:false` | `students.delete` | 200 / 404 |

`level`: `A1`…`C2`. Soft delete: `isActive=false` (profile + user).

**Distinct:** `POST /users/students` solo provisiona identidad User (email/password/name),
no el perfil académico completo.

---

## Teachers

Schemas: `teachers.ts` · Router: `teacher-registry.ts`

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Listar | GET | `/teachers` | — | `{ teachers }` | `teachers.read` | 200 / 403 |
| Crear | POST | `/teachers` | `{ email, password?, firstName, lastName, level, availability?, isActive? }` | `{ teacher }` | `teachers.create` | 201 / 400 / 409 |
| Ver | GET | `/teachers/:id` | — | `{ teacher }` | `teachers.read` **o** TEACHER dueño | 200 / 403 / 404 |
| Editar | PATCH | `/teachers/:id` | ≥1 campo editable | `{ teacher }` | `teachers.update` | 200 / 400 / 404 |
| Desactivar | DELETE | `/teachers/:id` | — | soft | `teachers.delete` | 200 / 404 |

`availability`: `AVAILABLE` \| `UNAVAILABLE` \| `LIMITED`.

---

## Assignments

Schemas: `assignments.ts` · Router: `student-teacher-assignment.ts`  
Modelo: **link actual** Student→Teacher (sin historial, sin entity `status`).

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Ver profesor actual | GET | `/students/:id/teacher` | — | `{ assignment: { studentId, teacherId, assignedAt, updatedAt } }` | `assignments.read` **o** STUDENT dueño | 200 / 404 |
| Asignar / reemplazar | POST | `/students/:id/teacher` | `{ teacherId }` | `{ assignment }` | `assignments.create` | 200 / 400 / 404 |
| Quitar | DELETE | `/students/:id/teacher` | — | vacío | `assignments.update` | 204 / 404 |

TEACHER no puede autoasignarse estudiantes (actor = sesión).

---

## Courses

Schemas: `courses.ts`, `course-types.ts`, `service-types.ts`

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Listar | GET | `/courses` | — | `{ courses }` | `courses.read` | 200 / 403 |
| Crear | POST | `/courses` | ver abajo | `{ course }` | `courses.create` | 201 / 400 |
| Ver | GET | `/courses/:id` | — | `{ course }` | `courses.read` | 200 / 404 |
| Editar | PATCH | `/courses/:id` | ≥1 campo | `{ course }` | `courses.update` | 200 / 400 / 404 |
| Desactivar | DELETE | `/courses/:id` | — | soft | `courses.delete` | 200 / 404 |

**Create body:** `name`, `description?`, `courseType` (`REGULAR`\|`TEACHER_TRAINING`),
`serviceType` (`ONE_TO_ONE_60`\|`ONE_TO_ONE_90`\|`GROUP_120`),
`amountMinor?`+`currency?` juntos (`ARS`\|`USD`), `isActive?`.

**DTO:** incluye `durationMinutes` **derivado** (60/90/120) — no editable libre.

---

## Groups

Schemas: `groups.ts`, `enrollments.ts` · Router: `groups.ts`

### CRUD grupo

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Listar | GET | `/groups` | — | `{ groups }` | `groups.read` | 200 |
| Crear | POST | `/groups` | `{ courseId, name, isActive? }` | `{ group }` | `groups.create` | 201 / 400 / 404 |
| Ver | GET | `/groups/:id` | — | `{ group }` | `groups.read` | 200 / 404 |
| Editar | PATCH | `/groups/:id` | `name?`, `isActive?`, `scheduleOptionId?\|null` | `{ group }` | `groups.update` | 200 / 400 / 404 |
| Desactivar | DELETE | `/groups/:id` | — | soft | `groups.delete` | 200 / 404 |

`Group`: `{ id, courseId, name, teacherId, scheduleOptionId, isActive, createdAt, updatedAt }`.

### Teacher del grupo

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Ver | GET | `/groups/:id/teacher` | — | `{ groupId, teacherId }` | `groups.read` | 200 / 404 |
| Asignar | POST | `/groups/:id/teacher` | `{ teacherId }` | idem | `groups.update` | 200 / 404 |
| Quitar | DELETE | `/groups/:id/teacher` | — | 204 | `groups.update` | 204 |

### Enrollments (máx. 15 activos)

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Listar activos | GET | `/groups/:id/students` | — | `{ enrollments }` | `groups.read` | 200 |
| Inscribir | POST | `/groups/:id/students` | `{ studentId }` | `{ enrollment }` | `groups.update` | 201 / **400** si full |
| Dar de baja | DELETE | `/groups/:id/students/:studentId` | — | 204 soft | `groups.update` | 204 |

Capacidad: `GROUP_MAX_ACTIVE_ENROLLMENTS = 15` → **400** (no 409) si full.

---

## Schedule Options

Schemas: `schedules.ts`

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Listar | GET | `/schedule-options` | — | `{ scheduleOptions }` | `schedules.read` | 200 |
| Crear | POST | `/schedule-options` | `{ day, startTime, endTime, isActive? }` | `{ scheduleOption }` | `schedules.create` | 201 / 400 |
| Ver | GET | `/schedule-options/:id` | — | `{ scheduleOption }` | `schedules.read` | 200 / 404 |
| Editar | PATCH | `/schedule-options/:id` | day/times/`isActive` | `{ scheduleOption }` | `schedules.update` | 200 |
| Desactivar | DELETE | `/schedule-options/:id` | — | soft | `schedules.delete` | 200 |

`day`: `MONDAY`…`SUNDAY`; times `HH:mm` (civil, **sin** TZ en el string).
`label` derivado server-side (ej. `Lunes 18:00–20:00`).

---

## Classes

Schemas: `class-sessions.ts` · Router: `classes.ts` · Domain: `class-session-service.ts`

### Ownership (resumen)

| Rol | Lectura | Escritura (CRUD sesión / attendance write / notes write) |
| --- | ------- | -------------------------------------------------------- |
| Con `classes.read` / SUPER_ADMIN / DIRECTOR | Todas | Con `classes.create\|update\|delete` |
| TEACHER sin grant | Solo grupos donde `Group.teacherId` = su Teacher | Solo esos grupos |
| STUDENT sin grant | Solo grupos con Enrollment activo | **Nunca** escritura |
| Generate masivo | — | Solo `classes.create` (sin bypass por ownership teacher) |

### Endpoints

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Listar | GET | `/classes` | query `groupId?` | `{ classSessions }` (incluye inactivas) | ownership/read | 200 / 403 |
| Crear individual | POST | `/classes` | `{ groupId, startAt, meetingUrl? }` | `{ classSession }` | create actor | 201 / 400 / 403 / 404 / **409** overlap |
| Ver | GET | `/classes/:id` | — | `{ classSession }` | ownership | 200 / 403 / 404 |
| Editar | PATCH | `/classes/:id` | ≥1 de `startAt`, `isActive`, `meetingUrl\|null` | `{ classSession }` | update actor | 200 / 400 / 403 / 404 / **409** |
| Cancelar (soft) | DELETE | `/classes/:id` | — | `{ classSession }` `isActive:false` | delete actor | 200 / 403 / 404 |
| Generar semanal | POST | `/groups/:id/classes/generate` | `{ from, to }` civil `YYYY-MM-DD` (máx 90 días) | `{ groupId, from, to, generatedCount, skippedCount, conflictCount, classSessions }` | `classes.create` | 200 / 400 / 404 |

### Reglas de dominio (ClassSession)

| Tema | Comportamiento real |
| ---- | ------------------- |
| Duración | **Derivada** de `Course.serviceType` vía Group; `endAt` no se envía en create |
| `meetingUrl` | https absoluto opcional; generate deja `null`; patch puede clear con `null` |
| Estados | **No** hay enum `SCHEDULED/IN_PROGRESS/...`; solo `isActive` + fechas |
| Cancelación | Soft delete `isActive=false` |
| UNIQUE | `@@unique([groupId, startAt])`; generate → `skippedCount` |
| Conflictos teacher | Overlap half-open en sesiones activas del mismo teacher → create/PATCH **409**; generate → `conflictCount` (no falla) |
| Prerrequisitos | Group activo, Course activo, `scheduleOptionId` activo en el group |
| Timezone generate | Civil date + `ScheduleOption.startTime` en `ACADEMY_TIMEZONE` → UTC |
| JSON | `startAt`/`endAt` ISO-8601 UTC (`.toISOString()`) |

DTO: `{ id, groupId, startAt, endAt, serviceType, durationMinutes, scheduleOptionId, teacherId, meetingUrl, isActive, createdAt, updatedAt }`.

---

## Calendar

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Rango civil | GET | `/classes/calendar` | query `from`, `to` (`YYYY-MM-DD`, máx 93 días) | `{ from, to, classSessions: CalendarEvent[] }` | ownership/read | 200 / 400 / 403 |

- Solo sesiones **`isActive: true`**.
- Ventana: `[from 00:00 local academy TZ, dayAfter(to) 00:00 local)`.
- Event enriquecido: `group` (course), `teacher`, `meetingUrl`, tiempos.

---

## Attendance

Schemas: `attendance.ts`

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Listar | GET | `/classes/:id/attendance` | — | `{ attendances }` | read (STUDENT → solo su fila) | 200 / 403 / 404 |
| Registrar | POST | `/classes/:id/attendance` | `{ studentId, status }` | `{ attendance }` | write (`classes.update` o teacher dueño) | 201 / 400 / 403 / **409** dup |
| Cambiar | PATCH | `/classes/:id/attendance/:studentId` | `{ status }` | `{ attendance }` | write | 200 / 404 |

`status`: `PRESENT` \| `ABSENT`. Incluye `student: { id, firstName, lastName }`.
Sin DELETE. Unique `(classSessionId, studentId)`.

---

## Notes

Schemas: `class-notes.ts`

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Listar | GET | `/classes/:id/notes` | — | `{ notes }` | read | 200 |
| Crear | POST | `/classes/:id/notes` | `{ content }` trim 1–4000 | `{ note }` | write | 201 |
| Editar | PATCH | `/classes/:id/notes/:noteId` | `{ content }` | `{ note }` | write | 200 |
| Borrar | DELETE | `/classes/:id/notes/:noteId` | — | 204 | write | 204 |

**Hard delete** (no soft). STUDENT: lectura según ownership de clase; sin write.

---

## Materials

Schemas: `materials.ts` · Storage S3-compatible (MinIO/Spaces)

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Listar scoped | GET | `/materials` | query XOR `courseId` **o** `classSessionId` | `{ materials }` | materials.read / ownership | 200 / 400 / 403 |
| Metadata | GET | `/materials/:id` | — | `{ material }` | read | 200 / 404 |
| Descargar / abrir | GET | `/materials/:id/download` | — | `{ kind, downloadUrl?, expiresInSeconds?, externalUrl? }` | read | 200 |
| Crear LINK | POST | `/materials` | `{ title, kind:"LINK", externalUrl, courseId\|classSessionId, description? }` | `{ material }` | create | 201 |
| Intent FILE | POST | `/materials/uploads` | mime/size/filename + XOR association | `{ material, uploadUrl, expiresInSeconds }` | create | 201 |
| Completar FILE | POST | `/materials/:id/complete` | — | `{ material }` READY | update | 200 |
| Editar meta | PATCH | `/materials/:id` | `title?`/`description?` | `{ material }` | update | 200 |
| Soft delete | DELETE | `/materials/:id` | — | 204 | **`materials.update`** | 204 |

MIME allowlist: pdf, jpeg/png/webp, audio mpeg/wav/ogg/mp4. **Sin video.**

---

## Administratives

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Crear cuenta ADMIN | POST | `/users/administratives` | `{ email, password (≥12), name? }` | `{ user }` | `users.create` (SUPER_ADMIN/DIRECTOR bypass) | 201 / 200 / 400 / 409 |
| Listar administrativos | — | **NO EXISTE** | — | — | — | — |

---

## Permissions

Schemas: `permissions.ts` · Router: `administrative-permissions.ts`

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Catálogo | GET | `/permissions/catalog` | — | `{ permissions: [{module,action}] }` | `permissions.read` | 200 / 403 |
| Grants ADMINISTRATIVE | GET | `/roles/administrative/permissions` | — | `{ permissions }` | `permissions.read` | 200 |
| Otorgar | POST | `/roles/administrative/permissions` | `{ module, action }` | `{ permission }` | `permissions.update` | 201 / 200 |
| Revocar | DELETE | `/roles/administrative/permissions` | `{ module, action }` | 204 | `permissions.update` | 204 |

Audit append-only en grant/revoke (sin UI de auditoría).

---

## Settings

**No hay** endpoint de “settings de academia” en HTTP (finance settings = dominio sin HTTP).

| UI action | HTTP | Endpoint | Request | Response | Auth | Status |
| --------- | ---- | -------- | ------- | -------- | ---- | ------ |
| Ver identidad sesión | GET | `/auth/me` | — | `{ user }` | cookie | 200 / 401 |
| Cerrar sesión | POST | `/auth/logout` | — | 204 | — | 204 |
| Theme UI (claro/oscuro) | — | **client-only** | localStorage | — | N/A | N/A |

`ACADEMY_TIMEZONE` / split financiero: **API-only / Stage 6** — no settings UI contract aún.

---

## Dates & Timezone

| Tema | Backend real | Riesgo UI |
| ---- | ------------ | --------- |
| Business TZ | `ACADEMY_TIMEZONE` IANA, default `America/Argentina/Buenos_Aires` | Front no recibe este valor por API; monorepo web hardcodea display TZ |
| Storage | `start_at` / `end_at` `Timestamptz(3)` | OK como instantes absolutos |
| JSON | ISO-8601 UTC (`...Z`) | `new Date(iso)` + `Intl` en `es-AR` OK si se usa zona correcta |
| Civil dates | `YYYY-MM-DD` en generate/calendar | Tratar como medianoche **local academia**, no UTC midnight |
| ScheduleOption times | `HH:mm` civil | No son UTC |
| Create `startAt` | Cliente debe enviar instante ISO correcto | UI que arman `YYYY-MM-DDTHH:mm:00` **sin offset** es ambigua → riesgo |
| DST | BA sin DST hoy | Otros TZ IANA pueden fallar en horas inexistentes |

---

## Error Contract

| Status | `error.code` | Cuándo |
| ------ | ------------ | ------ |
| 400 | `BAD_REQUEST` | Zod fail, group full, rango inválido, prereq clase, etc. |
| 401 | `UNAUTHORIZED` | Sin sesión / login inválido |
| 403 | `FORBIDDEN` | Permiso/ownership |
| 404 | `NOT_FOUND` | Recurso o “sin assignment” |
| 409 | `CONFLICT` | Teacher overlap clase; attendance dup; role/profile conflicts |
| 429 | `TOO_MANY_REQUESTS` | Login throttle |
| 500 | `INTERNAL_ERROR` | No controlado (mensaje genérico) |
| 503 | (health body) | DB degradada en `/health` |

Shape: `{ error: { code, message } }` — **sin** lista de field errors.

Frontend debería:

- 401 → redirigir `/login` (excepto en el propio login).
- 403 → mensaje “sin permiso”, no fingir éxito.
- 409 → conflicto (reagenda / asistencia).
- 400 capacity → “grupo lleno”.

---

## Frontend Integration Gaps

Referencia UI: **`academia-front`** (demo).  
(`apps/web` del monorepo ya tiene cableado real Stages 1–5; no es el gap principal.)

### Por pantalla

#### `/dashboard`

| | |
| - | - |
| **A Demo** | Copy/roles/localStorage DEV; accesos rápidos estáticos |
| **B API** | `GET /auth/me` |
| **C Acciones UI** | Navegación a módulos |
| **D Endpoints** | N/A (solo sesión) |
| **E Sin backend** | — |
| **F Diff modelo** | Debe mostrar `user.name/email/role` reales |

#### `/dashboard/students` (+ `[id]`)

| | |
| - | - |
| **A** | `demoStudents` |
| **B** | `GET/POST/PATCH/DELETE /students` |
| **C** | Buscar, crear, editar, desactivar |
| **D** | Endpoints students arriba |
| **E** | — |
| **F** | Casi compatible (CEFR); IDs demo `stu-*` → UUID; create necesita password rules API |

#### `/dashboard/teachers` (+ `[id]`)

| | |
| - | - |
| **A** | `demoTeachers` |
| **B** | CRUD `/teachers` |
| **C** | Crear/editar/desactivar/availability |
| **D** | Endpoints teachers |
| **E** | — |
| **F** | UI omite `level` teacher (API lo requiere en create) |

#### `/dashboard/assignments`

| | |
| - | - |
| **A** | `demoAssignments` con `status ASSIGNED/UNASSIGNED`, nombres denormalizados |
| **B** | `GET/POST/DELETE /students/:id/teacher` + listas students/teachers |
| **C** | Asignar / quitar |
| **D** | Assignments endpoints |
| **E** | Historial de asignaciones (diferido a propósito) |
| **F** | **Needs Adapter:** no existe resource `Assignment` con `status`; 404 = sin profesor |

#### `/dashboard/courses` (+ `[id]`)

| | |
| - | - |
| **A** | `demoCourses` con `level`, `studentCount` |
| **B** | CRUD `/courses` |
| **C** | Crear/editar/ver |
| **D** | Courses endpoints |
| **E** | Materials UI en detail (strings) — API materials existe |
| **F** | **Needs Adapter fuerte:** `courseType`/`serviceType`/`durationMinutes` vs `level` |

#### `/dashboard/groups` (+ `[id]`)

| | |
| - | - |
| **A** | `demoGroups` con `schedule` string, `courseName`, `teacherName`, `studentCount` |
| **B** | Groups CRUD + teacher + enrollments + schedule-options |
| **C** | Crear grupo; detail limitado |
| **D** | Groups + schedule-options + enrollments |
| **E** | UI no modela scheduleOption picker ni roster 15 real |
| **F** | **Needs Adapter:** denormalized names vs IDs; schedule string vs `scheduleOptionId` |

#### `/dashboard/classes` (+ `[id]`)

| | |
| - | - |
| **A** | `demoClasses` + dialogs locales; status inventados; attendance/notes/materials strings |
| **B** | `/classes*`, generate, attendance, notes, materials |
| **C** | CRUD visual, generate dialog, “Ir a la clase” |
| **D** | Ver sección Classes / Attendance / Notes / Materials |
| **E** | Filtros avanzados / estados de lifecycle de producto — **no en API** |
| **F** | **Needs Adapter:** statuses, duración libre en forms, `endTime` editable, modality label |

#### `/dashboard/calendar`

| | |
| - | - |
| **A** | Estado React sobre `demoClasses` |
| **B** | `GET /classes/calendar?from&to` |
| **C** | Mes, create/edit modal local, generate local |
| **D** | Calendar + classes CRUD + generate |
| **E** | — |
| **F** | Civil range + TZ; no mutar arrays locales |

#### `/dashboard/student` (+ `/classes`, `/materials`, `/attendance`)

| | |
| - | - |
| **A** | (antes) no existía hub real |
| **B** | `GET /students/me`, `/students/me/materials`, `/students/me/attendance?from&to`; clases vía `GET /classes/calendar` (scope por sesión STUDENT) |
| **C** | Próxima clase, listados próximas/pasadas, materiales LINK/FILE, asistencia RO |
| **D** | Student Hub OpenAPI tag; download material reutiliza `GET /materials/:id/download` |
| **E** | Progress, reprogramación, pago online |
| **F** | Ownership solo por sesión — nunca confiar `studentId` del cliente; finance omite split academia/profesor |

#### `/dashboard/student/finance`

| | |
| - | - |
| **A** | (antes) fuera del Student Hub |
| **B** | `GET /students/me/finance`; `POST /students/me/finance/charges/:chargeId/pay` |
| **C** | Resumen, cargos, pagos; botón **Pagar** solo en Charge OPEN sin Payment; “Pago pendiente” si Payment PENDING |
| **D** | Student Hub OpenAPI; serializers curados; checkout → PENDING via provider stub |
| **E** | Live MP/Stripe SDK / redirect checkout |
| **F** | Ownership solo sesión; no MANUAL desde alumno; no allocations/settlements/academyPercentage; no “marcar pagado” en UI |

#### `/dashboard/teacher` (+ classes / students / attendance / materials / earnings)

| | |
| - | - |
| **A** | (antes) TEACHER veía nav ops admin |
| **B** | `GET /teachers/me*`; clases vía calendar scoped; earnings vía `/finance/allocations` + `settlements` (teacherId forzado por sesión); asistencia/notas vía `/classes/:id/*` |
| **C** | Próxima clase, alumnos (Assignment ∪ Enrollment), materiales owned, earnings RO |
| **D** | Teacher Hub OpenAPI; group read/roster con ownership teacher |
| **E** | Payout automático, requests de pago |
| **F** | Nunca confiar `teacherId` del cliente; IDOR entre teachers / students ajenos |

#### `/dashboard/permissions`

| | |
| - | - |
| **A** | Matrix local + `setTimeout` “guardado” |
| **B** | catalog + GET/POST/DELETE administrative permissions |
| **C** | Toggle checkboxes, Guardar |
| **D** | Permissions endpoints (save = N requests grant/revoke diff) |
| **E** | UI de auditoría de cambios |
| **F** | Catálogo UI incluye actions no siempre en catalog real (validar pair) |

#### `/dashboard/administratives`

| | |
| - | - |
| **A** | Form fake success |
| **B** | `POST /users/administratives` |
| **C** | Crear (password ≥12 ya en UI) |
| **D** | Provision endpoint |
| **E** | Listado de administrativos |
| **F** | Compatible en create; empty state OK |

#### `/dashboard/settings`

| | |
| - | - |
| **A** | Hardcode Omegon / Director; logout no llama API |
| **B** | `/auth/me`, `/auth/logout` |
| **C** | Theme toggle, “Cerrar sesión” |
| **D** | Auth endpoints; theme = client-only |
| **E** | Config academy % (finance HTTP pendiente) |
| **F** | Reemplazar hardcode por sesión |

### ClassSession — comparación detallada UI vs API

| Capacidad | UI academia-front | Backend |
| --------- | ----------------- | ------- |
| Crear individual | Form: group, date, start, **end**, meetingUrl; muta array demo | `{ groupId, startAt, meetingUrl? }`; **end derivado** |
| Generación masiva | Dialog local: days-of-week + hours; escribe `demoClasses` | `{ from, to }` + ScheduleOption del group; TZ academia |
| Edición | Modals locales | PATCH `startAt` / `meetingUrl` / `isActive` |
| Cancelación | Status `CANCELLED` / `isActive` demo | DELETE soft → `isActive:false` |
| Calendario | Local state | `GET /classes/calendar` |
| Filtros | UI group/teacher locales | List: `groupId?`; calendar: rango civil |
| Estados | `SCHEDULED\|IN_PROGRESS\|COMPLETED\|CANCELLED` | **Solo** `isActive` + tiempo |
| Duración | Minutos desde start/end del form | `serviceType` del Course |
| Grupo/Curso/Profesor | Nombres denormalizados en demo | IDs; enrich en calendar |
| Estudiantes | Array de nombres | Via enrollments del group + attendance API |
| meetingUrl | https check en form | `meetingUrlSchema` https |
| Timezone | `Date` browser / strings sin Z | Academy TZ en generate/calendar; ISO UTC out |
| Ownership | Ninguno | Ver tabla ownership |

---

## Missing Backend Capabilities

| Capacidad pedida por UI / producto | Estado backend |
| --------------------------------- | -------------- |
| Listado de usuarios ADMINISTRATIVE | **Backend Gap** |
| Assignment history | Diferido (no MVP bloqueante) |
| Class lifecycle statuses (`IN_PROGRESS`, etc.) | **Backend Gap** (solo `isActive`) |
| Free-form class duration / endTime en create | **No** — duración derivada (correcto de dominio) |
| Finance HTTP (settings %, charges, payments) | **Backend Gap** (dominio WIP, sin routes) |
| Auto Charge generation | Diferido Stage 6 |
| Meeting provisioning Zoom/Meet | Future backlog |
| `/auth/me` expuesto fields de permisos efectivos | **UNKNOWN** — hoy solo `{ user }`; UI debe inferir nav por `role` o fallar en 403 |
| Endpoint que expone `ACADEMY_TIMEZONE` al front | **Backend Gap** menor (o documentar env build-time) |

---

## Recommended Integration Order

1. **Auth shell** — quitar DEV localStorage; `/auth/login|me|logout`; guards dashboard.
2. **Students** → **Teachers** (shapes cercanos).
3. **Assignments** (adaptar modelo UI → link API).
4. **Courses** (rehacer formularios a `courseType`/`serviceType`).
5. **Schedule options** + **Groups** (teacher, scheduleOption, enrollments 15).
6. **Classes** individual + soft cancel + **generate**.
7. **Calendar** (`from`/`to` civiles, display TZ BA).
8. **Attendance** + **Notes** en class detail.
9. **Materials** contextual (course + class, upload 3-step).
10. **Permissions** + **Administratives** create.
11. **Settings** sesión real.
12. Public SEO routes decision (landing one-page vs `/about`…).
13. Finance — **después** Stage 6B-2 HTTP.

---

## Integration Readiness

### Ready

Funciones donde el contrato API existe y la UI solo debe cablear (shapes cercanos):

- Login cookie (`POST /auth/login`) — path ya usado por academia-front.
- Students CRUD (CEFR, soft delete).
- Teachers CRUD (+ availability).
- Administratives **create** (password ≥12).
- Permissions catalog modules (nombres alineados).
- Soft-delete semantics (“Desactivar”).
- `meetingUrl` https.
- Error envelope estable.

> Nota: el monorepo `apps/web` **ya** está Ready+integrado para Stages 1–5;
> esta lista mira el hueco respecto a **academia-front**.

### Needs Adapter

Backend existe; UI usa otra forma:

- Assignments (`Assignment.status` / nombres vs `{ studentId, teacherId }`).
- Courses (`level`/`studentCount` vs `courseType`/`serviceType`/`durationMinutes`).
- Groups (schedule string / counts vs IDs + enrollments API).
- Classes (lifecycle statuses; endTime libre; generate local ≠ API).
- Calendar (local arrays vs civil query + ISO UTC).
- Class detail attendance/notes/materials (strings vs recursos anidados).
- Permissions save (diff local vs POST/DELETE por grant).
- Settings (hardcode vs `/auth/me`).
- Datetime construction without academy TZ.

### Backend Gap

- List ADMINISTRATIVE users.
- Class status machine rica.
- Finance HTTP.
- Exponer business timezone al cliente (opcional).
- Assignment history (out of MVP scope explícito).

### UI Gap

Backend listo; academia-front no tiene UI real:

- Materials LINK + FILE upload/complete/download.
- Attendance PRESENT/ABSENT mutate.
- Class notes CRUD.
- Schedule-options management UI dedicada.
- Enrollment roster con tope 15.
- Weekly generate contra API.
- Logout / session header reales.
- Role-gated nav (Permisos/Administrativos).
- Public routes `/about|/courses|/teachers|/contact` (monorepo) si se preserva ROUTE-MAP.
- Loading / empty / error states atados a HTTP.

### Unclear

- **UNKNOWN** — ¿Se adopta landing one-page de v0 y se deprecan rutas públicas SEO del monorepo, o se reintroducen?
- **UNKNOWN** — ¿Dark mode / purple tokens de v0 reemplazan tokens AA actuales? Requiere decisión de contraste.
- **UNIQUE(groupId,startAt)` create individual:** store no mapea P2002→409 de forma explícita en el audit; el 409 documentado es overlap de teacher. Comportamiento exacto ante duplicate start → **UNKNOWN — requiere verificación**.
- **CourseValidationError** no mapeado a HttpError en algunos handlers → posible 500 → **UNKNOWN** en edge cases de dominio curso.

---

## Variables de entorno (frontend connection)

Solo nombres / propósito (sin valores):

| Variable | Quién | Propósito |
| -------- | ----- | --------- |
| `API_INTERNAL_URL` | Next server / Docker web | Destino rewrite `/api/*` y SSR fetch |
| `NEXT_PUBLIC_APP_URL` | Web | Origen canónico SEO/metadata |
| `WEB_PORT` | Compose | Puerto host (no lógica app) |
| `AUTH_SECRET` | **API only** | Firma JWT (nunca al browser) |
| `AUTH_SESSION_TTL` | API | TTL cookie/JWT |
| `ACADEMY_TIMEZONE` | API | Business TZ (default BA) |
| `CORS_ALLOWED_ORIGINS` | API | Vacío si same-origin proxy |
| `NODE_ENV` | ambos | secure cookie / analytics |

El browser **no** necesita URL pública del API.

---

## Health / Docs (referencia)

| HTTP | Endpoint | Auth | Notas |
| ---- | -------- | ---- | ----- |
| GET | `/health` | No | 200/503 |
| GET | `/openapi.json` | No | si docs enabled |
| GET | `/docs` | No | Swagger |

---

*Fin del contrato de auditoría. Único archivo de salida pretendido de esta tarea:
`docs/FRONTEND-BACKEND-CONTRACT.md`.*
