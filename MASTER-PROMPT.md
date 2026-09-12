# MASTER PROMPT — Academia de Español

Actuá como Staff/Principal Full-Stack Engineer, Product Architect, UX/UI Engineer y QA Lead. Vas a desarrollar una academia web de español para `omegon.studio`, sobre el repositorio existente.

## Contexto del producto

La academia pertenece a una directora que es profesora de español.

El modelo educativo inicial tiene:

1. **Clases 1 a 1**
   - 1 estudiante + 1 docente.
   - Duración: 60 o 90 minutos.
   - Estudiantes de distintos niveles.

2. **Clases grupales 1 a N**
   - Máximo 15 estudiantes.
   - Duración: 120 minutos.
   - Una vez por semana.
   - Principalmente para nativos que quieren formarse como profesores de español.

3. **Red de docentes**
   - Los profesores formados por la academia pueden incorporarse como docentes.
   - La dirección asigna estudiantes a docentes.
   - Un docente no puede autoasignarse estudiantes.
   - La academia retiene el 15% del ingreso de cada estudiante.
   - El docente recibe el 85%.

La visión de producción es convertir la plataforma en la infraestructura operativa de una academia escalable: formación de profesores → incorporación de docentes → asignación de estudiantes → clases → seguimiento → liquidaciones.

## Stack y estado inicial

- Next.js para frontend.
- Node.js para backend.
- Frontend y backend ya están conectados.
- Los roles y login deben ser reales, no mocks.
- Reutilizar la arquitectura existente antes de crear otra.
- No reemplazar infraestructura funcional sin una razón técnica documentada.

## Roles

Implementar y respetar estos roles:

- `SUPER_ADMIN`: Omegon / desarrollo / infraestructura.
- `DIRECTOR`: directora de la academia.
- `ADMINISTRATIVE`: administración.
- `TEACHER`: docente.
- `STUDENT`: estudiante.

Cuenta inicial de desarrollo:
- `omegon.info@gmail.com` debe existir como `SUPER_ADMIN`/dev.
- Nunca hardcodear contraseña, token o secreto.
- Usar variables de entorno/seed seguro.
- Si ya existe infraestructura de autenticación, adaptarla en lugar de duplicarla.

### Permisos

La directora puede crear/asignar permisos al rol `ADMINISTRATIVE` desde su panel.

El sistema debe soportar permisos granulares por módulo/acción, por ejemplo:
- students.read/create/update
- teachers.read/create/update
- assignments.read/create/update
- classes.read/create/update
- materials.read/create/update
- finance.read/create/update
- users.read/create/update
- permissions.read/update

`SUPER_ADMIN` tiene acceso técnico total.
`DIRECTOR` tiene control operativo total de la academia y puede administrar permisos de administrativos.
`ADMINISTRATIVE` solamente puede hacer lo que sus permisos permitan.
`TEACHER` opera sobre sus propios estudiantes/clases/materiales.
`STUDENT` accede únicamente a sus propios datos.

## Reglas de producto

- La plataforma es la academia; Zoom/Google Meet es el aula externa.
- No construir videollamada propia en el MVP.
- Las clases deben almacenar un enlace de reunión.
- Los botones de funcionalidades futuras pueden aparecer cuando tenga sentido, pero deben indicar claramente `Próximamente` y no aparentar estar funcionando.
- Nunca crear una pantalla que simule que una acción fue realizada si backend no la ejecutó realmente.
- Los estados críticos deben persistirse en backend.
- Mantener auditoría para acciones administrativas importantes cuando sea razonable.

## MVP

Prioridad:

1. Autenticación real y autorización.
2. Roles y permisos.
3. Dashboard por rol.
4. CRUD de estudiantes.
5. CRUD de docentes.
6. Asignación estudiante ↔ docente.
7. Cursos/grupos.
8. Clases y calendario.
9. Links de Zoom/Google Meet.
10. Materiales.
11. Asistencia y notas básicas.
12. Registro financiero básico: precio, 15% academia, 85% docente, estado.
13. Gestión de administrativos y permisos.
14. SEO técnico y accesibilidad desde el primer día.

No desarrollar todavía:
- videollamada propia,
- app móvil,
- IA,
- gamificación,
- marketplace público,
- chat interno,
- automatización bancaria,
- pagos automáticos a docentes,
- CRM completo,
- sistema avanzado de certificaciones.

## UX/UI

Diseño minimalista, profesional, educativo y adulto. No infantilizar la experiencia.

Usar la identidad visual de Omegon:
- primero buscar tokens, estilos, logos y componentes existentes del proyecto;
- reutilizarlos;
- si no existen colores definidos, crear tokens centralizados y documentarlos;
- no dispersar valores de color por componentes.

La interfaz debe ser responsive y usable en desktop/tablet/mobile.

## Google / SEO

Pensar SEO desde arquitectura y no al final:
- URLs semánticas.
- metadata por página.
- title y description únicos.
- Open Graph.
- sitemap.
- robots.
- canonical cuando corresponda.
- datos estructurados cuando aporten valor.
- buen rendimiento/Core Web Vitals.
- contenido rastreable y semántico.
- headings correctos.
- evitar contenido importante renderizado solamente por interacción cliente.
- páginas públicas indexables separadas del área privada.
- no indexar dashboards, datos de estudiantes ni rutas privadas.

## ADA / accesibilidad

Objetivo: WCAG 2.2 AA como estándar práctico del proyecto.

Aplicar:
- navegación completa por teclado;
- foco visible;
- labels asociados;
- mensajes de error accesibles;
- contraste suficiente;
- no depender únicamente del color;
- botones y links semánticos;
- landmarks;
- headings jerárquicos;
- `aria-*` solamente cuando sea necesario;
- formularios accesibles;
- tablas accesibles;
- estados loading/error/success comunicados correctamente;
- soporte razonable para lectores de pantalla;
- targets táctiles adecuados;
- respetar `prefers-reduced-motion`.

## Arquitectura de información inicial

Público:
- `/`
- `/about`
- `/courses`
- `/teachers`
- `/contact`
- `/login`
- `/register` si corresponde al flujo real

Privado:
- `/dashboard`
- `/dashboard/students`
- `/dashboard/teachers`
- `/dashboard/administratives`
- `/dashboard/assignments`
- `/dashboard/classes`
- `/dashboard/calendar`
- `/dashboard/materials`
- `/dashboard/finance`
- `/dashboard/settings`
- `/dashboard/permissions`

Las rutas pueden ajustarse a la arquitectura existente, pero cualquier cambio debe reflejarse en `ROUTE-MAP.md`.

## Regla de trabajo por etapas

No intentes desarrollar toda la visión de producción en un único paso.

Trabajá por etapas pequeñas, verificables y productivas.

Antes de implementar una etapa:
1. leer las Cursor Rules;
2. leer `ROUTE-MAP.md`;
3. leer `TODO.md`;
4. inspeccionar el código existente;
5. identificar qué ya existe;
6. evitar duplicación.

Después de implementar:
1. ejecutar tests/lint/typecheck/build relevantes;
2. actualizar `TODO.md`;
3. actualizar `ROUTE-MAP.md`;
4. documentar nuevas rutas, estados, permisos y decisiones;
5. dejar TODOs explícitos para las etapas posteriores;
6. verificar SEO y accesibilidad de lo creado.

## PR workflow

Cada PR debe:
- modificar `ROUTE-MAP.md` si cambian rutas/estados/navegación;
- modificar `TODO.md` si se completa, divide o descubre trabajo;
- incluir los TODO de las etapas posteriores afectadas;
- no marcar como completado algo que no esté implementado y probado;
- describir migraciones y cambios de datos;
- incluir riesgos/regresiones relevantes.

No hacer cambios silenciosos en el roadmap.

## Principio de escalabilidad

Construir simple, pero modelar correctamente.

Las entidades centrales previstas son:

User
Student
Teacher
Administrative
Course
Enrollment
TeacherAssignment
ClassSession
Meeting
Material
Attendance
ClassNote
Payment
TeacherSettlement
Permission
RolePermission

No es obligatorio implementar todas en el MVP; sí evitar decisiones que bloqueen su incorporación.

## Primera tarea

Antes de escribir código:

1. Auditar el repositorio.
2. Identificar stack, estructura, auth, API, DB, ORM, estilos y componentes.
3. Comparar lo existente con este objetivo.
4. Crear/actualizar:
   - `.cursor/rules/`
   - `ROUTE-MAP.md`
   - `TODO.md`
5. Proponer una Stage 0 concreta.
6. No inventar infraestructura que ya existe.
7. No comenzar funcionalidades posteriores hasta cerrar la etapa actual y actualizar el roadmap.

La regla principal es:

> **MVP pequeño, producción escalable, decisiones explícitas y cero funcionalidades falsas.**
