# LMS-04 — Integridad de módulos y lecciones

| Campo | Valor |
| --- | --- |
| Fecha | 2026-11-03 |
| Rama | `feature/lms-01-linear-lock` |
| Hallazgo | H5 — soft-delete de módulo sin propagación / acceso por UUID |
| Commits | **Ninguno** |
| Prisma / migraciones | **Sin cambios** (política sin cascade write) |

---

## 1. Política encontrada (antes)

| Aspecto | Comportamiento |
| --- | --- |
| Eliminación | Solo soft via `isActive` (no hay `DELETE` HTTP de módulo/lección) |
| Hard-delete Prisma | `onDelete: Restrict` en módulo→lección→asset/quiz/progress |
| Soft-delete módulo | `PATCH …/modules/:id { isActive: false }` — **no** tocaba lecciones |
| Outline / `listLessonOrderRefs` | Ya excluía módulos inactivos |
| GET lesson alumno (OPEN) | Solo `lesson.isActive` + PUBLISHED → **bypass por UUID** |
| LINEAR | Lecciones de módulo inactivo caían fuera del order → lock/`403` (no `404`) |
| Progress | Ya exigía presencia en order refs → bloqueado |
| Restore | PATCH con `requireModuleInCourse` que exigía `isActive` → **restore imposible** |
| UI admin delete | No hay botón (API soft sí) |

---

## 2. Política adoptada (sin migración)

1. **Soft-delete only** — nunca hard-delete de módulos, lecciones, assets, progreso, submissions ni attempts.
2. **Sin cascade write** al desactivar módulo: las lecciones conservan su `isActive` propio (trazabilidad individual / restore independiente sin columnas nuevas).
3. **Acceso alumno** requiere módulo **y** lección activos (`requireActiveLessonInActiveModule`) → `404` si el módulo está soft-deleted.
4. **Histórico** intacto en DB; el alumno no lista submissions/quiz de lecciones no navegables.
5. **Restore** = `PATCH { isActive: true }`. Admin puede patchar módulos/lecciones inactivos. Restaurar módulo reexpone lecciones que siguieron activas; lecciones desactivadas individualmente siguen ocultas.
6. **No** se crea UI nueva de delete en este ticket (sigue siendo API/admin tooling).

Si en el futuro se requiere “admin ve lecciones vacías bajo módulo soft-deleted” o cascade reversible con memoria, haría falta columna tipo `deactivatedByModuleId` → **detenerse y autorizar migración**.

---

## 3. Cambios realizados

| Archivo | Cambio |
| --- | --- |
| `online-course-visibility.ts` | Helper + documentación de política |
| `online-course-visibility.test.ts` | Dominio: soft módulo/lección, restore, history, LINEAR quiz |
| `student-online-courses.ts` | Gate en lesson GET, asset download, `assertStudentLessonUnlocked` |
| `online-submission-service.ts` | Create/list respetan módulo activo |
| `online-quiz-service.ts` | `submitQuiz` respeta módulo activo |
| `online-courses.ts` (admin) | PATCH módulo/lección permite inactive (restore) |
| `online-courses.test.ts` | HTTP OPEN/LINEAR soft-delete + restore + lesson individual |
| `TODO.md` / `ROUTE-MAP.md` / `DECISIONS.md` #51 | Sync roadmap |

LMS-01/02/03 preservados. LMS-03 publish rules sin cambios (sigue listando solo módulos activos).

---

## 4. Tests y resultados

| Suite | Resultado |
| --- | --- |
| `online-course-visibility.test.ts` | 5 passed |
| `online-courses.test.ts` (incl. LMS-03/04) | 20 passed |
| `online-course-publish.test.ts` | 11 passed |
| `authorization-matrix.test.ts` | 45 passed |
| Integration `online-courses.integration.test.ts` | 1 passed |
| Web lint / typecheck / build | OK |
| ESLint slice LMS-04 | OK |

### Preexistentes (no introducidos por LMS-04)

- API lint/typecheck: `AcademyPercentage` unused (`in-memory-finance-store`) — Remediación 01 en stash.
- `finance-domain.test.ts` con `30`.
- Integration suite completa: fallos schema Zoom / finance (online-courses PG OK).

---

## 5. Compatibilidad / riesgos / pendientes

- Cursos existentes: filas intactas; solo cambia el gate de lectura alumno.
- Lecciones activas bajo módulo soft-deleted siguen `isActive=true` en DB (intencional); admin GET lessons bajo módulo inactivo sigue `404` salvo restore del módulo.
- UI de desactivar módulo/lección: aún ausente (H6) — pendiente post-LMS-04.
- Cascade write opcional: solo con migración autorizada.
