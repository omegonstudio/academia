# Academia API — smoke flow (manual)

Reproducible manual check of the live API after Stages 0–4. Uses **test data only**.
Does **not** delete or overwrite production/seed identities unless you choose to.

## Prerequisites

1. Stack up (dev Compose or local):
   - Web: `http://localhost:3000`
   - API (direct): `http://localhost:4000` (dev only; production does not publish the API port)
2. A known login (e.g. SuperAdmin from bootstrap, or a DIRECTOR from seed).
3. Docs enabled (default in development). Production requires `API_DOCS_ENABLED=true` explicitly.

Public surfaces via Next rewrite:

| Surface | URL |
| ------- | --- |
| OpenAPI JSON | http://localhost:3000/api/openapi.json |
| Swagger UI | http://localhost:3000/api/docs/ (trailing slash; required for assets) |
| Health | http://localhost:3000/api/health |

Direct API (Insomnia / curl): replace `/api` with `http://localhost:4000`.

## Variables (no secrets)

| Name | Example | Notes |
| ---- | ------- | ----- |
| `API_BASE_URL` | `http://localhost:3000/api` | Prefer rewrite so cookies stay same-origin |
| `API_BASE_URL_DIRECT` | `http://localhost:4000` | Direct API; cookie jar must target that host |

Do **not** commit real passwords. Use local `.env` / Insomnia environment (gitignored).

## Insomnia

1. **Import → From URL** (or From File after saving OpenAPI):
   - `http://localhost:3000/api/openapi.json` (rewrite), or
   - `http://localhost:4000/openapi.json` (direct)
2. Create an environment:
   - `base_url` = `http://localhost:3000/api` (or direct host)
3. Enable **cookie jar** for the base host.
4. Run **Login** (`POST /auth/login`) with your test email/password.
5. Confirm the jar holds `academia_session`.
6. Run authenticated requests (session cookie is sent automatically).

There is no Bearer token. Do not paste HttpOnly cookie values into headers.

### Swagger Try it out (cookie session)

1. Open http://localhost:3000/login and sign in **or** use Swagger `POST /auth/login` with server **`/api`**.
2. Open http://localhost:3000/api/docs.
3. Keep server **`/api`** selected so requests stay same-origin.
4. Call `GET /auth/me` — should return 200 with the session user.
5. Exercise other endpoints; the browser sends `academia_session` automatically.

## Smoke sequence

Use unique names with a prefix such as `smoke-YYYYMMDD-` so leftovers are obvious.

1. **Health** — `GET /health` → 200, `status: ok`.
2. **Login** — `POST /auth/login` → 200 + `Set-Cookie: academia_session=...`.
3. **Current session** — `GET /auth/me` → 200, role as expected.
4. **Student** — `POST /students` (or list `GET /students`) with test profile data.
5. **Teacher** — `POST /teachers` (or list).
6. **Course** — `POST /courses` with `courseType` + `serviceType` (e.g. `REGULAR` + `GROUP_120`). Confirm `durationMinutes` is derived (120), not client-supplied.
7. **Group** — `POST /groups` linked to that course.
8. **Group teacher** — `POST /groups/:id/teacher`.
9. **Enrollment** — `POST /groups/:id/students` (active student). Confirm capacity rule (max **15** active). Soft-deactivate with `DELETE /groups/:id/students/:studentId` if cleaning up.
10. **Schedule** — `GET /schedule-options`; if needed `POST /schedule-options`, then `PATCH /groups/:id` with `scheduleOptionId`.
11. **Generate classes** — `POST /groups/:id/classes/generate` with civil `{ from, to }` (≤ 90 days). Note `generatedCount` / `skippedCount` / `conflictCount`. Requires `classes.create`.
12. **Calendar** — `GET /classes/calendar?from=&to=` (≤ 93 days, academy timezone).
13. **Attendance** — `POST /classes/:id/attendance` with `{ studentId, status: "PRESENT" }` (active enrollment).
14. **Note** — `POST /classes/:id/notes` with trimmed content 1–4000 chars.
15. **Read note** — `GET /classes/:id/notes`.
16. **Permission negative** — with a TEACHER/STUDENT (or ADMINISTRATIVE without grant), call an admin-only route (e.g. `POST /groups/:id/classes/generate` without `classes.create`) → **403**.

## Cleanup

Prefer soft-deletes already exposed by the API (`DELETE` on students/teachers/courses/groups/classes, enrollment deactivate). Do not run destructive SQL against shared databases.

## Related

- Route inventory: `ROUTE-MAP.md`
- Docs gate decision: `docs/DECISIONS.md` (§42)
- OpenAPI schemas: derived from `@academia/shared` Zod contracts
