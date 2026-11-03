# LMS-05 — Editor administrativo de quizzes

| Campo | Valor |
| --- | --- |
| Fecha | 2026-11-03 |
| Rama | `feature/lms-01-linear-lock` |
| Hallazgo | H3 — editor de 1 pregunta pisaba cuestionarios ricos |
| Commits | **Ninguno** |
| Prisma / migraciones | **Sin cambios** (sin versionado) |

---

## 1. Problema original / comportamiento anterior

- UI `LessonQuizEditor`: solo título, passScore y **una** pregunta SINGLE_CHOICE con 2 opciones.
- GET admin hidrataba título/passScore **sin** preguntas.
- `PUT` upsert hacía `deleteMany` de preguntas + recreate → cualquier «Guardar» destruía quizzes multi-pregunta (API/seed).
- Intentos de alumnos (`OnlineQuizAttempt`) no se borraban (FK Restrict al quiz; answers en JSON), pero IDs de preguntas/opciones en `answersJson` quedaban huérfanos tras recreate.

## 2. Comportamiento nuevo

### UI
- Editor multi-pregunta: crear/editar/reordenar/eliminar (draft local), opciones, tipos API (`SINGLE_CHOICE` / `MULTIPLE_CHOICE` / `TRUE_FALSE` / `SHORT_TEXT`), puntos, explicación.
- Guardado **explícito** (sin autosave).
- `ConfirmDialog` para eliminar pregunta del borrador (sin `alert`/`confirm`/`prompt`).
- Banner si `attemptCount > 0` con reglas de edición restringida.
- Errores locales + mensaje de API.

### Dominio / HTTP
- `attemptCount` en `OnlineQuizAdmin`.
- Upsert acepta `id` opcional en preguntas/opciones.
- Sin attempts → `replace` (recreate atómico en transacción).
- Con attempts → `preserve`: update in-place; **400** si se intenta borrar pregunta/opción existente o cambiar tipo.
- Filas de attempts / scores / `answersJson` **nunca** se eliminan en upsert.
- Submissions de lección no se tocan (modelo distinto).

## 3. Archivos

**Shared:** `packages/shared/src/online-courses.ts`  
**API:** `online-quiz-service.ts`, `online-quiz-service.test.ts`, `online-course-service.ts`, stores in-memory/Prisma, `online-courses.test.ts`  
**Web:** `[id]/page.tsx` (`LessonQuizEditor`), `api-browser.ts`  
**Docs:** este informe, `TODO.md`, `DECISIONS.md` #52

## 4. Tests ejecutados (evidencia)

| Suite | Resultado |
| --- | --- |
| `online-quiz-service.test.ts` | 6 passed |
| `online-courses.test.ts` (incl. round-trip + perm 403) | 22 passed |
| publish + visibility LMS | OK |
| Web lint / typecheck / build | OK |
| Integration `online-courses.integration.test.ts` | **1 passed** (suite global sigue con fallos preexistentes Zoom/finance) |

### Preexistentes
- Finance `AcademyPercentage` unused / test `30` (Remediación 01 stash).
- Integration suite global (Zoom schema / finance) — no introducidos por LMS-05.

## 5. Riesgos / pendientes

- Sin versionado: no se puede “retirar” una pregunta tras el primer intento; hace falta producto + migración si se requiere.
- UI aún no lista intentos/resultados por alumno (solo `attemptCount`).
- Cambiar `isCorrect` tras intentos altera calificación de **nuevos** intentos; históricos quedan en JSON (aceptable sin versionado).
- Requiere `npm run build -w @academia/shared` para que Zod acepte `id` en runtime.
