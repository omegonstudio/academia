# MASTER PROMPT — Academia de Español

Actuá como Staff/Principal Full-Stack Engineer, Product Architect, UX/UI Engineer y QA Lead. Vas a desarrollar una academia web de español para `omegon.studio`.

> **Nota de estado (corregida en Stage 0).** La versión original de este documento
> asumía un repositorio existente con frontend y backend ya conectados. La
> auditoría de Stage 0 encontró el repositorio vacío: 7 archivos versionados,
> todos markdown y Cursor rules, sin código. Por lo tanto el stack fue creado
> desde cero en Stage 0. Ver `docs/DECISIONS.md` (decisión 1) y `docs/ARCHITECTURE.md`.

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

Implementado en Stage 0 (ver `docs/ARCHITECTURE.md` para el detalle):

- Next.js 16 (App Router) + React 19 + TypeScript para frontend.
- Node.js 22 + Express 5 + TypeScript para backend.
- PostgreSQL 17 + Prisma 7 con migraciones versionadas.
- Docker desde el inicio: Compose base + overrides separados de development y production.
- Frontend y backend conectados vía proxy same-origin (`/api` → servicio api).
- Monorepo con npm workspaces: `apps/web`, `apps/api`, `packages/shared`.
- Mercado Pago (Argentina) y Stripe (internacional): **no implementados todavía**; el
  límite arquitectónico está definido (dominio de pagos → adaptadores de proveedor).

Reglas permanentes:

- Los roles y login son reales, no mocks.
- Reutilizar la arquitectura existente antes de crear otra.
- No reemplazar infraestructura funcional sin una razón técnica documentada.
- LaQQ es referencia arquitectónica de Omegon; Academia permanece independiente
  (no es dependencia de producto). Ver `docs/LAQQ-REFERENCE.md`.
- No desarrollar features de academia hasta cerrar Stage 0.

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

## Primera tarea — Stage 0: Foundation + Infrastructure

No conviene empezar a desarrollar la academia todavía. Primero convertir lo ya armado en una base de infraestructura de producción.

Antes de features de producto:

1. Auditar el repositorio, arquitectura, Next.js, Node.js, PostgreSQL, auth y conexión frontend/backend.
2. Auditar patrones arquitectónicos de LaQQ (referencia; no copiar negocio ni depender de LaQQ).
3. Dockerizar development y definir estrategia Docker de production.
4. Separar estrictamente DEV / PRODUCTION (DB, secrets, payments, URLs).
5. Crear `.env.example`, revisar `.gitignore`, preparar migraciones y seed seguro de `omegon.info@gmail.com`.
6. CI de GitHub Actions (PR) + CD de producción (`main`).
7. Healthchecks, logging baseline, documentar backup/restore.
8. Establecer baseline SEO y WCAG 2.2 AA.
9. Actualizar `.cursor/rules/`, `ROUTE-MAP.md` y `TODO.md` al estado real.
10. No inventar infraestructura que ya existe.
11. No comenzar funcionalidades posteriores hasta cerrar Stage 0 y actualizar el roadmap.

La regla principal es:

> **MVP pequeño, producción escalable, decisiones explícitas y cero funcionalidades falsas.**

---

# Academia — Infrastructure & Production Addendum

## INFRASTRUCTURE & PRODUCTION REQUIREMENTS

### Objetivo

La academia debe nacer como un proyecto preparado para producción, aunque el MVP inicial sea pequeño.

El objetivo no es sobrearquitecturar el producto, sino establecer desde el principio una infraestructura reproducible, aislada por ambientes, segura y escalable.

La arquitectura debe tomar como referencia técnica los patrones que ya funcionan en el proyecto LaQQ de Omegon, especialmente en:

- Dockerización.
- Separación de ambientes.
- Organización de servicios.
- Configuración mediante variables de entorno.
- PostgreSQL.
- CI/CD.
- GitHub Actions.
- Healthchecks.
- Migraciones.
- Manejo de configuración.
- Flujo de desarrollo → PR → producción.

No copiar código o lógica de negocio de LaQQ. Utilizar únicamente sus patrones arquitectónicos cuando sean apropiados.

### STACK

#### Frontend

- Next.js.
- TypeScript.
- Usar la arquitectura ya existente en el repositorio si fue previamente configurada.
- SSR/Server Components cuando sean apropiados.
- SEO first para las páginas públicas.

#### Backend

- Node.js.
- TypeScript.
- API separada del frontend cuando la arquitectura existente así lo determine.
- Validación de inputs.
- Autorización server-side.
- Manejo consistente de errores.

#### Database

- PostgreSQL.
- Migraciones versionadas.
- Seeds separados de datos de producción.
- No modificar producción manualmente mediante SQL sin una migración o procedimiento documentado.

#### Payments

- **Argentina:** Mercado Pago.
- **Internacional:** Stripe.

Las integraciones de pago deben estar desacopladas del dominio de la academia.

No hacer:

```text
Student → MercadoPago directamente
```

Preferir:

```text
Student
   ↓
Payment Domain
   ↓
Payment Provider
   ├── Mercado Pago
   └── Stripe
```

Esto permitirá agregar o reemplazar proveedores posteriormente.

- Nunca almacenar datos sensibles de tarjetas.
- Utilizar los mecanismos oficiales de tokenización/checkout/webhooks de cada proveedor.

Los webhooks deben:

- validarse;
- ser idempotentes;
- registrar eventos;
- poder procesarse nuevamente de forma segura;
- no confiar únicamente en información enviada desde el frontend.

### DOCKER

El proyecto debe estar dockerizado.

Crear una estrategia clara para:

- development
- production

Utilizar Docker Compose cuando corresponda.

La configuración debe permitir levantar el entorno de desarrollo de forma reproducible.

Ejemplo conceptual:

```text
docker-compose.yml
docker-compose.dev.yml
docker-compose.prod.yml
```

La estructura exacta debe adaptarse a la arquitectura existente y a los patrones comprobados de LaQQ.

No duplicar configuraciones innecesariamente.

### ENVIRONMENTS

Debe existir una separación estricta entre:

- DEV
- PRODUCTION

Nunca compartir entre desarrollo y producción:

- PostgreSQL;
- credenciales;
- secrets;
- API keys;
- payment credentials;
- JWT/session secrets;
- storage credentials;
- URLs internas;
- datos de usuarios.

#### Development

Debe utilizar:

- DB propia de desarrollo.
- Credenciales sandbox/test.
- Mercado Pago test/sandbox cuando corresponda.
- Stripe test mode.
- Datos de prueba.

#### Production

Debe utilizar:

- DB de producción.
- Credenciales reales.
- Mercado Pago producción.
- Stripe live mode.
- Secrets de producción.
- Datos reales.

Nunca ejecutar datos reales dentro de development.

### ENVIRONMENT VARIABLES

Todos los secretos deben provenir de environment variables.

Ejemplos conceptuales:

```text
NODE_ENV=
DATABASE_URL=

NEXT_PUBLIC_APP_URL=
API_URL=

AUTH_SECRET=

MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

Los nombres definitivos deben adaptarse al código existente.

Crear y mantener:

- `.env.example`

El `.env.example` jamás debe contener secretos reales.

El `.gitignore` debe impedir commits accidentales de:

- `.env`
- `.env.local`
- `.env.development`
- `.env.production`

y equivalentes sensibles.

### DATABASE

La base debe ser PostgreSQL.

Las migraciones deben:

- estar versionadas;
- poder ejecutarse de forma reproducible;
- ejecutarse automáticamente durante el deployment cuando sea seguro;
- fallar de manera explícita si existe un problema;
- no destruir datos de producción.

Nunca usar en procesos automáticos de producción:

- `DROP DATABASE`
- `DROP TABLE`
- `TRUNCATE`

salvo que exista una operación explícita, protegida y documentada.

Seeds de desarrollo deben ser independientes de producción.

### CI/CD

Crear GitHub Actions para automatizar:

#### Pull Request

Cada PR debe ejecutar como mínimo:

```text
Install
↓
Lint
↓
Typecheck
↓
Unit tests
↓
Integration tests
↓
Build
```

Si alguna etapa falla, el PR no debe considerarse listo.

#### Production

El deployment de producción debe estar separado del workflow de PR.

Conceptualmente:

```text
Developer
   ↓
feature/*
   ↓
Pull Request
   ↓
CI
   ↓
Review
   ↓
main
   ↓
Production CI/CD
   ↓
Build
   ↓
Migrations
   ↓
Deploy
   ↓
Health check
```

No hacer deployment de producción desde cualquier branch arbitrario.

`main` representa el estado destinado a producción.

### GITHUB ACTIONS

Crear los workflows dentro de:

- `.github/workflows/`

Como mínimo evaluar:

- `ci.yml`
- `production.yml`

La estructura definitiva debe seguir la arquitectura existente de LaQQ cuando sea apropiado.

Los workflows deben:

- utilizar secrets de GitHub;
- nunca imprimir secrets;
- utilizar versiones explícitas de actions;
- cachear dependencias cuando sea conveniente;
- fallar ante errores;
- generar logs útiles;
- verificar health después del deployment.

### HEALTHCHECKS

Cada servicio crítico debe tener una forma de comprobar que está funcionando.

Como mínimo:

- Frontend
- Backend
- PostgreSQL

El backend debería disponer de un endpoint de health, por ejemplo:

- `/health`

que permita distinguir entre:

- application healthy
- database unavailable
- configuration invalid

No exponer información sensible.

### LOGGING & OBSERVABILITY

Desde el MVP:

- logs estructurados cuando sea posible;
- errores distinguibles de logs informativos;
- no loguear passwords;
- no loguear tokens;
- no loguear secrets;
- no loguear datos sensibles innecesariamente.

Preparar la arquitectura para incorporar posteriormente:

- error tracking;
- métricas;
- tracing;
- alertas.

No es necesario implementar observabilidad avanzada durante el primer MVP si no existe infraestructura previa.

### SECURITY

Toda funcionalidad administrativa debe estar protegida por:

```text
Authentication
+
Authorization
+
Server-side validation
```

Nunca confiar únicamente en:

- botones ocultos;
- rutas ocultas;
- permisos enviados desde frontend;
- IDs proporcionados por el cliente.

Prevenir como mínimo:

- IDOR;
- privilege escalation;
- acceso cruzado entre estudiantes;
- acceso cruzado entre docentes;
- modificación de liquidaciones sin autorización;
- modificación de permisos sin autorización.

### BACKUPS

PostgreSQL debe diseñarse pensando en recuperación.

Production debe tener:

- estrategia de backup;
- retención definida;
- procedimiento de restore documentado.

El MVP puede comenzar con backups proporcionados por el proveedor de infraestructura si son confiables, pero la estrategia debe quedar documentada.

### DOMAIN ARCHITECTURE

Mantener separación entre:

- Identity/Auth
- Academy
- Students
- Teachers
- Assignments
- Classes
- Materials
- Payments
- Finance
- Permissions

Payments y Finance deben estar desacoplados.

Por ejemplo:

```text
Payment
   ↓
Payment Provider
   ↓
Payment confirmed
   ↓
Finance
   ↓
Academy 15%
Teacher 85%
```

No calcular la distribución financiera únicamente en componentes frontend.

La regla 15/85 debe existir en el dominio/backend y estar cubierta por tests.

### PRODUCTION READINESS

El proyecto debe distinguir claramente:

| Capa | Significado |
| --- | --- |
| **MVP** | Funcionalidades necesarias para operar la academia. |
| **Production Infrastructure** | Infraestructura necesaria para ejecutar el MVP de forma segura. |
| **Future Product** | Funcionalidades posteriores. |

No implementar funcionalidades de producto futuras únicamente porque la arquitectura ya esté preparada para ellas.

Preparar la infraestructura no significa implementar el producto futuro.

### STAGE 0 ACTUALIZADO

Stage 0 debe incluir:

- Auditar repositorio.
- Auditar arquitectura actual.
- Auditar Next.js.
- Auditar Node.js.
- Auditar PostgreSQL.
- Auditar auth.
- Auditar conexión frontend/backend.
- Auditar patrones arquitectónicos de LaQQ.
- Dockerizar development.
- Definir production Docker strategy.
- Separar DEV/PRODUCTION.
- Crear `.env.example`.
- Revisar `.gitignore`.
- Configurar PostgreSQL development.
- Preparar migraciones.
- Preparar seed seguro de `omegon.info@gmail.com`.
- Crear CI de GitHub.
- Crear CD de producción.
- Configurar GitHub Secrets.
- Crear healthcheck.
- Establecer logging baseline.
- Documentar backup/restore.
- Establecer SEO baseline.
- Establecer WCAG 2.2 AA baseline.
- Actualizar `ROUTE-MAP.md`.
- Actualizar `TODO.md`.

#### Stage 0 Acceptance Criteria

La etapa no se considera terminada hasta que:

- El proyecto pueda levantarse en development de forma reproducible.
- Frontend, backend y PostgreSQL estén correctamente conectados.
- Development y production tengan configuración separada.
- No existan secrets reales en Git.
- CI pueda validar un PR.
- Production tenga un flujo de deployment definido.
- Exista healthcheck.
- Las migraciones sean reproducibles.
- `omegon.info@gmail.com` pueda provisionarse como SuperAdmin de forma segura.
- `ROUTE-MAP.md` y `TODO.md` representen el estado real del proyecto.
- SEO y accesibilidad sean considerados desde la primera implementación.
- La arquitectura no dependa de LaQQ para funcionar.

**Regla:** LaQQ es una referencia arquitectónica, no una dependencia del producto Academia.
