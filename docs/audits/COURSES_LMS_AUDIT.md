# Auditoría funcional — Cursos, módulos y lecciones (LMS)

| Campo | Valor |
| --- | --- |
| Fecha | 2026-11-03 |
| Rama al auditar | `feature/remediation-01-ci-legacy-webhooks` (basada en `origin/dev` @ `463148e`) |
| Working tree | Cambios **sin commit** de Remediación 01 (finance/webhooks) **preservados**; no tocados en esta auditoría |
| Alcance | Solo lectura / análisis. **Sin correcciones de código LMS.** |
| Entregable | Este informe |

---

## A. Resumen ejecutivo

El LMS online de Academia cubre el happy path administrativo y del alumno **gratuito**:

**Crear curso → módulos → lecciones → contenidos → publicar → enroll-free → progreso.**

La API y el modelo Prisma están más maduros que la UI de administración. El síntoma reportado (**«Nueva lección» abre `window.prompt`**) es real y localizado; forma parte de un patrón de UX admin incompleto (CRUD parcial, quiz mínimo vs API rica, acciones destructivas sin confirmación).

Riesgos principales:

1. **P0 seguridad pedagógica:** modo `LINEAR` se puede saltar vía `POST quiz/submit` y `POST submissions` (GET sí bloquea).
2. **P1 operación:** create de lección vía diálogo nativo; quiz admin de 1 pregunta puede **pisar** un cuestionario completo al guardar; publish sin validar contenido; soft-delete de módulo no propaga a lecciones.
3. **P2 producto:** checkout pago LMS ausente; `authorTeacherId` en Prisma/API sin UI; sin delete UI de módulos/lecciones.

El ciclo comercial pago (Charge → Payment → grant access) **no está implementado** (documentado post-MVP).

---

## B. Mapa funcional

### Superficies

| Superficie | Ruta / área | Rol |
| --- | --- | --- |
| Admin list + create | `/dashboard/online-courses` | `online_courses.*` |
| Admin detail | `/dashboard/online-courses/[id]` | update/publish/grant |
| Catálogo público | `/cursos`, `/cursos/[slug]` | anónimo |
| Alumno | `/dashboard/student/courses*` | STUDENT |
| API admin | `apps/api/src/http/routes/online-courses.ts` | permisos catalog |
| API alumno | `apps/api/src/http/routes/student-online-courses.ts` | sesión student |
| Dominio | `apps/api/src/domain/online-courses/*` | — |
| Contratos | `packages/shared/src/online-courses.ts` | Zod DTOs |
| Persistencia | Prisma `OnlineCourse*` (schema ~L831+) | PostgreSQL |

### Flujo botones → API (admin detail)

| UI | Handler | Cliente | Persistencia |
| --- | --- | --- | --- |
| Crear curso (modal) | `submit` | `createOnlineCourseBrowser` | `OnlineCourse` DRAFT |
| Guardar curso | `saveCourse` | `updateOnlineCourseBrowser` | PATCH curso |
| Publicar / Despublicar / Archivar | `runStatus` | `publish*` / `unpublish*` / `archive*` | `status` |
| Conceder acceso | `grantAccess` | `grantOnlineCourseAccessBrowser` | `OnlineCourseAccess` |
| Agregar módulo | `addModule` | `createOnlineCourseModuleBrowser` | `OnlineCourseModule` |
| Reordenar módulo | `moveModule` | `reorderOnlineCourseModulesBrowser` | `position` (optimistic UI) |
| **Nueva lección** | `addLesson` | `createOnlineLessonBrowser` | `OnlineLesson` tras prompt |
| Patch lección | `patchLesson` | `updateOnlineLessonBrowser` | blur/select |
| Reordenar lección | `moveLesson` | `reorderOnlineLessonsBrowser` | optimistic |
| Agregar contenido | `addAsset` | create asset / upload document | `OnlineLessonAsset` |
| Quitar contenido | `removeAsset` | `deleteOnlineLessonAssetBrowser` | soft/delete asset |
| Guardar quiz | `saveQuiz` | `upsertOnlineQuizBrowser` | reemplazo completo |

### Modelo de datos (política delete)

- Hard-delete de módulo/lección: Prisma `onDelete: Restrict` (falla si hay hijos).
- Soft-delete: flag `isActive` en course/module/lesson/asset.
- **No hay** `DELETE` HTTP de módulos; solo `PATCH { isActive: false }`.
- Soft-delete de módulo **no** desactiva lecciones hijas automáticamente.
- Cascade duro solo en árbol quiz → questions → options.

### Estado inicial de un curso creado

- `status: DRAFT` (default Prisma / create).
- Create form UI: título, slug, subtítulo, descripción, accessMode (`OPEN`|`LINEAR`), precio opcional, moneda.
- **No** en create UI: cover, benefits, bonus, `authorTeacherId`, `certificateEnabled` (sí existen en schema/API y se editan parcialmente en detail).

---

## C. Hallazgos

### P0

#### H1 — Bypass de restricciones LINEAR en mutaciones de alumno

- **Archivos:**  
  - Lock OK: `apps/api/src/http/routes/student-online-courses.ts` ~L539–550 (GET quiz).  
  - Sin lock: mismo archivo ~L561–607 (`POST …/quiz/submit`), ~L610+ (submissions).  
  - Dominio: `online-quiz-service.ts` `submitQuiz` solo exige access; `online-submission-service.ts` igual.
- **Comportamiento:** con curso `LINEAR` y enrollment activo, el alumno puede enviar quiz/entregas de lecciones posteriores sin completar las requeridas previas. Outline/GET lesson/GET quiz/asset/progress sí respetan el lock.
- **Impacto:** se rompe la promesa pedagógica del modo LINEAR; posible fraude de progreso/evaluación.
- **Repro:** publicar curso LINEAR con 2 lecciones required; enroll-free; `POST …/lessons/<id2>/quiz/submit` sin completar lección 1 → 200 (esperado: 403).
- **Nota:** el test HTTP actual solo verifica LINEAR en GET lesson (`online-courses.test.ts` ~L222).

#### H2 — Create de lección vía `window.prompt` (síntoma reportado)

- **Archivo:** `apps/web/src/app/dashboard/online-courses/[id]/page.tsx`  
  - Función `addLesson` **L679–701**  
  - `window.prompt('Título de la lección')` **L683**  
  - Botón «Nueva lección» ~L1098–1101
- **Comportamiento:** al hacer clic se abre el diálogo nativo del navegador; si hay título, se llama de inmediato a `createOnlineLessonBrowser` y se actualiza estado local con la respuesta (persistencia **inmediata** en PostgreSQL, no solo local).
- **Impacto:** UX inconsistente con el resto del panel; inaccesible para AT/teclado; sin validación inline de longitud/errores de API en el prompt; único path de create de lección.
- **Repro:** Dashboard → Online courses → abrir curso → expandir módulo → «Nueva lección».

### P1

#### H3 — Editor de quiz admin puede destruir cuestionario rico

- **UI:** `LessonQuizEditor` en `[id]/page.tsx` — 1 pregunta `SINGLE_CHOICE`, 2 opciones; GET admin solo hidrata título/`passScorePercent`, **no** las preguntas existentes.
- **API:** `upsertOnlineQuizRequestSchema` admite hasta 50 preguntas y varios tipos.
- **Impacto:** «Guardar cuestionario» reemplaza el quiz completo; un admin que edita tras un upsert API/seed puede borrar preguntas.
- **Repro:** upsert quiz multi-pregunta vía API; abrir UI; guardar el formulario simple → quiz reducido a 1 pregunta.

#### H4 — Publish sin validación de contenido

- **Archivo:** `online-course-service.ts` L853–858 — `publishOnlineCourse` solo setea `status: 'PUBLISHED'`.
- **Impacto:** curso vacío o solo con lecciones DRAFT aparece en catálogo público.
- **Repro:** crear curso sin módulos → Publicar → aparece en `GET /public/online-courses`.

#### H5 — Soft-delete de módulo no propaga; lecciones siguen por ID

- Soft: `PATCH …/modules/:id { isActive: false }` (sin DELETE).
- Outline excluye módulos inactivos; GET lesson por UUID **no** exige `module.isActive`.
- **Impacto:** contenido “oculto” en outline pero alcanzable si se conoce el id (y hay access).
- **UI:** no hay botón de eliminar módulo (API sí permite soft).

#### H6 — Sin UI de eliminar/desactivar lecciones ni editar módulos

- API: `updateOnlineLesson` / `updateOnlineCourseModule` con `isActive`; cliente `updateOnlineCourseModuleBrowser` existe pero **no se usa**.
- **Impacto:** operadores no pueden retirar lecciones/módulos desde el panel sin API manual.

#### H7 — Acciones de alto impacto sin confirmación

- Publicar / Archivar / Quitar asset: sin `ConfirmDialog` ni confirm nativo.
- Contrasta con el único diálogo nativo usado (prompt de título).

### P2

#### H8 — Checkout pago LMS ausente

- FE `/cursos/[slug]`: CTA contacto.
- No hay Charge/Payment → grant automático.
- `succeedPayment` exige teacher de Group; `OnlineCourse.authorTeacherId` no resuelve split (TODO.md / ROUTE-MAP).
- Documentado como post-MVP — **parcial / no implementado**.

#### H9 — `authorTeacherId` en Prisma/API, ausente en FE create/edit

- Bloquea path paid futuro; catálogo público solo muestra `authorName` si se setea por API/seed.

#### H10 — Admin grant sin exigir PUBLISHED

- `grantAccess` puede dar acceso a draft; `enrollFree` sí exige published.

#### H11 — Modal create curso: sin Escape / focus trap; abandono sin warning

- `page.tsx` dialog parcial a11y; cancelar pierde datos sin confirmación.
- Duplicate submit mitigado (`saving` guard) — OK.

#### H12 — Assets: sin reorder UI; sin edit; delete sin confirm

- Tipos soportados en UI: TEXT, LINK, VIDEO, DOCUMENT (upload).
- API PATCH asset no cableado en `api-browser`.

#### H13 — Cobertura de tests incompleta

- Presente: create→publish, enroll-free, progress, LINEAR GET, quiz upsert/submit OPEN, public filter, authz create.
- Ausente: reorder, soft-delete module, publish vacío, LINEAR en submit/submissions, enroll paid reject, submissions CRUD, grant/revoke.

### P3

- `certificateEnabled` sin emisión.
- ROUTE-MAP dice “Modules CRUD” sin DELETE HTTP.
- Empty states de módulos/lecciones como texto plano (no `EmptyState`).
- Typo/copy “Guardá cambios”.
- Lesson title con `defaultValue` (desync si falla PATCH).
- Membership dashboard local-only (fuera de LMS estricto, relacionado).

---

## D. Evidencia consolidada (tabla)

| ID | Sev | Archivo | Línea (aprox.) | Observado |
| --- | --- | --- | --- | --- |
| H2 | P0/P1 UX | `[id]/page.tsx` | 683 | `window.prompt('Título de la lección')` — **único prompt en web** |
| H2 | — | `[id]/page.tsx` | 679–701 | Persistencia inmediata vía `createOnlineLessonBrowser` |
| H1 | P0 | `student-online-courses.ts` | 539–550 vs 561–607 | GET quiz locked; POST submit no |
| H1 | P0 | `online-quiz-service.ts` | ~235–247 | `submitQuiz` sin LINEAR |
| H4 | P1 | `online-course-service.ts` | 853–858 | Publish = status only |
| H5 | P1 | `schema.prisma` | 876, 898 | `onDelete: Restrict`; soft vía `isActive` |
| H3 | P1 | `[id]/page.tsx` | LessonQuizEditor | 1× SINGLE_CHOICE vs API rica |
| H8 | P2 | `cursos/[slug]/page.tsx` | ~232–237 | Contact-only paid |
| Create | — | `online-courses/page.tsx` | 49–101 | Form create + validaciones básicas |

**Único uso de diálogos nativos en `apps/web`:** `window.prompt` en create lección. No hay `alert`/`confirm` en el árbol web auditado.

---

## E. Matriz de funcionalidades

| Capacidad | Estado |
| --- | --- |
| Crear curso (admin UI) | Implementado |
| Editar metadatos curso | Implementado (detail) |
| Cover / benefits / bonus en create | Parcial (API sí; create UI no) |
| `authorTeacherId` UI | No implementado |
| Crear módulo | Implementado |
| Editar / eliminar módulo UI | No implementado (API soft sí) |
| Reordenar módulos | Implementado |
| Crear lección | Implementado parcialmente (prompt nativo) |
| Editar lección (title, min, required, status, submissions) | Implementado |
| Eliminar lección UI | No implementado |
| Reordenar lecciones | Implementado |
| Contenidos TEXT/LINK/VIDEO/DOCUMENT | Implementado |
| Reordenar / editar assets | No implementado |
| Quiz multi-pregunta admin UI | Parcial (API completa; UI mínima) |
| Publish / unpublish / archive | Implementado (sin validación de contenido) |
| Soft-delete curso UI | No implementado (API DELETE existe) |
| Grant / revoke access UI | Parcial (grant sí; revoke/list no) |
| Catálogo público PUBLISHED | Implementado |
| Enroll free | Implementado |
| Checkout pago + grant | No implementado |
| Progress start/complete | Implementado |
| LINEAR outline/GET | Implementado |
| LINEAR mutaciones (submit/submissions) | **No implementado / bypass** |
| Submissions review admin | No implementado |
| Certificados | No implementado |

---

## F. Plan de remediación (propuesto; no ejecutar aún)

Orden sugerido por prioridad y dependencias:

1. **R1 — Sustituir `window.prompt` por formulario/dialogo accesible** para create lección (campos title + opcionales API). Cierra el síntoma reportado (H2).
2. **R2 — Aplicar `isLessonLockedInCourse` en** `POST quiz/submit` y submissions (H1). Tests negativos LINEAR.
3. **R3 — Quiz admin:** cargar preguntas existentes; o UI multi-pregunta mínima; prevenir upsert destructivo accidental (H3).
4. **R4 — Publish gates:** rechazar o advertir curso sin módulos/lecciones PUBLISHED (H4).
5. **R5 — Soft-delete coherente:** UI desactivar módulo/lección; al desactivar módulo, política explícita (propagar `isActive` a lecciones **o** bloquear GET lesson si módulo inactivo) (H5–H6).
6. **R6 — ConfirmDialog** en archivar / quitar asset / publicar (H7).
7. **R7 — Completar CRUD UI** edit módulo, revoke access list (H6/H10).
8. **R8 — Paid LMS** (post-MVP): Charge↔`onlineCourseId`, resolver `authorTeacherId` en freeze (H8–H9).

**No mezclar** con Remediación 01 (finance legacy webhooks) en el mismo PR.

---

## G. Tests necesarios

| Test | Tipo | Objetivo |
| --- | --- | --- |
| LINEAR GET lesson 403 | Existente | Mantener |
| LINEAR POST quiz/submit 403 sin completar previas | Nuevo (P0) | Cerrar H1 |
| LINEAR POST submissions 403 | Nuevo (P0) | Cerrar H1 |
| Create lesson vía API con título vacío → 400 | Existente/ampliar | Validación |
| Publish curso vacío → 400 o documentado 200 | Nuevo (P1) | H4 |
| Soft-delete módulo → GET lesson 403 o lecciones soft | Nuevo (P1) | H5 |
| Reorder modules/lessons permutación inválida | Nuevo | Cobertura |
| Upsert quiz multi → GET admin round-trip | Nuevo | H3 |
| Enroll-free con `amountMinor > 0` → 400 | Nuevo | Paid boundary |
| Admin grant sobre DRAFT | Decensión / documentar | H10 |
| FE: create lección sin `window.prompt` (smoke/component) | Nuevo post-R1 | Regresión H2 |

### Tests ejecutados en esta auditoría

- **No** se re-ejecutó la suite LMS completa aquí (evitar ruido con working tree de Remediación 01).
- Inventario de tests existentes confirmado por lectura de:
  - `apps/api/src/http/routes/online-courses.test.ts` (8 cases)
  - `apps/api/src/integration/online-courses.integration.test.ts` (1 case publish→enroll→progress)
- Remediación 01 (finance) permanece **sin modificar** por esta tarea.

---

## Ciclo end-to-end (visión de cierre)

```text
Crear curso (UI modal → POST /online-courses)
  → Crear módulos (POST …/modules)
  → Crear lecciones (POST …/lessons)  [HOY: prompt nativo]
  → Agregar contenidos (POST assets / upload)
  → [Opcional] Quiz upsert
  → Publicar (POST …/publish)  [HOY: sin gate de contenido]
  → Inscribir (enroll-free | admin grant | pago FUTURO)
  → Consumir (outline + GET lesson + assets)
  → Progreso (POST progress)
  → Evaluar (quiz submit / submissions)  [HOY: LINEAR bypasseable]
```

---

## Criterio de finalización de esta auditoría

Cumplido: mapa del ciclo completo, hallazgo del prompt localizado con evidencia, clasificación P0–P3, matriz, plan de remediación y tests faltantes.

**Próximo paso:** aprobación humana antes de implementar correcciones (empezar por R1+R2).
