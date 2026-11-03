# LMS-03 — Validación integral de publicación de cursos

| Campo | Valor |
| --- | --- |
| Fecha | 2026-11-03 |
| Rama | `feature/lms-01-linear-lock` |
| Alcance | Gate de publicación (dominio + HTTP + UI admin) |
| Commits | **Ninguno** (pedido explícito) |
| Prisma / migraciones | **Sin cambios** |

---

## 1. Auditoría previa (comportamiento encontrado)

| Pieza | Antes |
| --- | --- |
| `publishOnlineCourse` | Solo `updateOnlineCourse({ status: 'PUBLISHED' })` |
| `POST /online-courses/:id/publish` | Delegaba al dominio sin checks de contenido |
| `PATCH /online-courses/:id` | Permitía `status: PUBLISHED` sin gate |
| UI Publicar | Llamaba API; errores genéricos (no parseaba `error.message`) |
| FREE vs LINEAR | Misma ausencia de validación |

Cursos ya `PUBLISHED` en DB no se revalidan hasta un nuevo intento de publicación.

---

## 2. Reglas de publicación (documentadas)

Sin campos nuevos. Aplican igual a `OPEN` y `LINEAR`.

1. **Título** no vacío (trim).
2. **Descripción** no vacía (trim).
3. **≥1 módulo** activo.
4. **≥1 lección** activa con `status=PUBLISHED`.
5. Cada lección publicada debe ser **teachable** por al menos uno de:
   - asset activo válido (TEXT con `bodyText`; LINK/VIDEO con `externalUrl`; DOCUMENT con `uploadStatus=READY` y `storageKey`);
   - quiz activo con ≥1 pregunta;
   - `acceptsSubmission === true`.
6. Todo asset **activo** de una lección publicada debe ser válido (si no → «recurso no disponible»).
7. Lecciones `DRAFT` no exigen contenido.

---

## 3. Backend

| Archivo | Cambio |
| --- | --- |
| `apps/api/src/domain/online-courses/online-course-publish.ts` | **Nuevo** — evaluate/assert + helpers de asset/lesson |
| `apps/api/src/domain/online-courses/online-course-service.ts` | Gate en `updateOnlineCourse` al pasar a `PUBLISHED` (cubre publish + PATCH) |
| Tests dominio / HTTP / integration helper | Descripción + 2.ª lección con contenido en helpers |

Atomicidad: assert **antes** de `store.updateCourse`; si falla, el status permanece. No se tocan `OnlineCourseAccess` ni progress.

---

## 4. Frontend

| Archivo | Cambio |
| --- | --- |
| `apps/web/src/lib/api-browser.ts` | Parse de `error.message` en publish/unpublish/archive y PATCH curso |
| `apps/web/src/app/dashboard/online-courses/[id]/page.tsx` | Soft-check local + lista de requisitos incumplidos (sin `alert`/`confirm`/`prompt`) |

---

## 5. Tests y resultados

### Ejecutados y OK

```text
npm run test --workspace=@academia/api -- online-course-publish.test.ts online-courses.test.ts
→ 32 passed (domain publish 11 + HTTP online-courses 17 + spanish2go seed 4 matched by pattern)
```

Cobertura LMS-03:

- curso vacío / sin módulos / módulo sin lecciones / lección sin contenido;
- curso válido FREE OPEN y LINEAR;
- fallo atómico (status sigue DRAFT);
- curso con alumno pre-granted;
- PATCH directo `status=PUBLISHED`;
- asset DOCUMENT pendiente;
- lección solo submission / solo quiz.

### Validación amplia (ejecutada)

| Check | Resultado |
| --- | --- |
| ESLint slice LMS (`online-course-publish*`, service, HTTP test) | OK |
| Web lint / typecheck / test (96) / build | OK |
| API unit tests LMS + suite | LMS OK; suite 593 passed / **1 failed preexistente** finance |
| API lint / typecheck workspace completo | **Fallo preexistente** finance (ver abajo) |
| Integration PG `online-courses.integration.test.ts` | **OK** (1 passed) vía `./scripts/test-integration.sh` |
| Integration suite completa | 5 files failed / 12 tests failed — **preexistente** (p. ej. `class_sessions.zoom_meeting_id` ausente en DB local; finance integration) |

### Errores preexistentes (fuera de LMS-03; Remediación 01 en stash)

1. `apps/api/src/domain/finance/in-memory-finance-store.ts` — `AcademyPercentage` import unused → lint + `tsc` fallan en tip de `dev`.
2. `apps/api/src/domain/finance/finance-domain.test.ts` — aún intenta `academyPercentage: 30` tras el cambio de allowed set `{40…90}` → 1 test fallido.
3. Integration PG local: varias suites fallan por schema desfasado (`zoom_meeting_id`) / finance — **no** por LMS-03 (`online-courses.integration` pasó).

No se tocan en LMS-03 (restricción: no modificar Remediación 01 / finanzas / Prisma).

### No probado

- Smoke E2E manual del botón «Publicar» en navegador.

---

## 6. Compatibilidad con cursos existentes

- Cursos **ya PUBLISHED**: sin cambio de estado; el catálogo público no se altera.
- Republish tras unpublish: deben cumplir las reglas (p. ej. descripción obligatoria).
- Seeds Spanish2Go en DRAFT siguen sin auto-publicarse; publicar manualmente exige contenido teachable.

---

## 7. Riesgos y pendientes

| Riesgo / pendiente | Nota |
| --- | --- |
| Formulario admin sin «Guardar» antes de Publicar | La validación usa estado **persistido**; descripción solo en el form no cuenta hasta PATCH save |
| Soft-check FE incompleto si módulos no expandidos | El backend sigue siendo la fuente de verdad |
| Quiz admin UI mínimo (H3 auditoría) | Fuera de LMS-03 |
| Remediación 01 (finance/webhooks) | Sigue en `stash@{0}`; no mezclada |
| LMS-01 / LMS-02 | Preservados en esta rama |

---

## 8. Archivos modificados / creados

**Creados**

- `apps/api/src/domain/online-courses/online-course-publish.ts`
- `apps/api/src/domain/online-courses/online-course-publish.test.ts`
- `docs/audits/LMS-03_PUBLISH_VALIDATION.md`

**Modificados**

- `apps/api/src/domain/online-courses/online-course-service.ts`
- `apps/api/src/http/routes/online-courses.test.ts`
- `apps/api/src/integration/online-courses.integration.test.ts`
- `apps/web/src/lib/api-browser.ts`
- `apps/web/src/app/dashboard/online-courses/[id]/page.tsx`
- `TODO.md`, `ROUTE-MAP.md`, `docs/DECISIONS.md` (#50)
