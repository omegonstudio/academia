# Academia — Production Readiness Audit

| Campo | Valor |
| --- | --- |
| Auditoría base (DEV-03) | Rama `dev` @ `634b64f` (2026-11-03) |
| Remediación documentada | PROD-01 en `feature/prod-01-finance-security` (FIN-DTO + OPS-02 / PAY-STRIPE-CFG) |
| Este cierre documental | Solo actualización de este archivo; no afirma re-ejecución de suites ni verificación en producción |
| Veredicto | **NOT READY** |

---

## 1. Resumen ejecutivo

### Estado general

Academia en `dev` @ `634b64f` tiene un **MVP de producto amplio y bien estructurado**: identidad y permisos server-side, academia live (cursos/grupos/sesiones/inscripciones/asistencia/notas), LMS asíncrono endurecido (LMS-01–05 / decisiones #50–#52), finanzas con freeze 40–90 y webhooks nativos MP/Stripe detrás de un puerto de dominio, Meet/Zoom con lifecycle XOR, notificaciones in-app + Resend opcional, CI con lint/typecheck/unit/integration/build/docker/secrets-hygiene, y Compose prod local smokeado.

Eso **no** equivale a estar listo para promover `dev` → `main` y operar producción de forma segura: el job de deploy PROD **nunca se ejecutó** contra un host real; pagos y reuniones no tienen evidencia live; la UI de membresía aparenta cobrar sin backend; no hay recuperación de contraseña; y faltan drills de backup/offsite en PROD.

**PROD-01 (rama `feature/prod-01-finance-security`):** FIN-DTO y OPS-02/PAY-STRIPE-CFG quedaron remediados en código con tests automatizados → estado **TESTEADO** (no VERIFICADO en operación real).

### ¿Puede promoverse `dev` a `main`?

**No en el estado actual.**  
`main` dispara `.github/workflows/production.yml` (CI + deploy SSH). Promover hoy sería aceptar un deploy no ensayado y un go-live con huecos P1 abiertos.

### Bloqueantes P0

No se encontró un P0 de “vulnerabilidad trivial explotable en código abierto” al nivel de auth bypass total o webhooks sin firma en producción (la firma se fuerza con `requireWebhookSignature` cuando `NODE_ENV=production`).  

Los **P0 operativos / de integridad** que impiden declarar producción segura:

| ID | Tema |
| --- | --- |
| **OPS-01** | Deploy PROD GitHub → DigitalOcean **nunca ejecutado** (NO VERIFICADO). |
| **FIN-LEGACY / FIN-SIG** | Controles de webhook + Remediación 01 implementados; OPS-02 (secret Stripe en boot) remediado en PROD-01 → **TESTEADO**. |

La **membresía engañosa** y demás P1 operativos siguen abiertos. FIN-DTO ya no es bloqueante abierto (remediado → **TESTEADO**).

### Remediados por PROD-01 (TESTEADO; no VERIFICADO en prod)

| ID | Estado actual |
| --- | --- |
| **FIN-DTO** | **TESTEADO** — STUDENT 403 en `GET /finance/allocations` y `GET /finance/allocations/:id`; portal `/students/me/finance` curado (#45). |
| **OPS-02 / PAY-STRIPE-CFG** | **TESTEADO** — en production, `STRIPE_SECRET_KEY` sin `STRIPE_WEBHOOK_SECRET` invalida config (preflight + `createRuntimeApp`). |

### Bloqueantes P1 aún abiertos (go-live)

| ID | Tema |
| --- | --- |
| **AUTH-RESET** | Sin forgot/reset password. |
| **PAY-LIVE** | Checkout/webhooks MP/Stripe: tests con mocks; smoke live **NO VERIFICADO**. |
| **UI-MEMBER** | `/dashboard/membership` CTA “Elegir plan” sin `Próximamente` ni API (incumple non-negotiable de producto). |
| **MEET-LIVE** | Google Meet / Zoom: código + tests mock; OAuth/credenciales reales **NO VERIFICADO**. |
| **OPS-BACKUP** | Scripts/docs de backup existen; agenda offsite + drill PROD **PENDIENTE**. |
| **INFRA-CSP** | Sin Content-Security-Policy en Next. |

### Riesgos principales

1. Promoción a `main` sin ensayo de deploy → migración/health/secrets mal puestos.  
2. UX de membresía genera expectativa de cobro inexistente.  
3. Sin reset de password → dependencia total de operadores.  
4. Refunds admin solo ledger (desalineación PSP) si se usan en producción.  
5. Pagos/Meet/Zoom live aún **NO VERIFICADO** (mocks ≠ operación real).

### Nivel de confianza de la auditoría

**Alto** sobre código, schema, tests automatizados y workflows (inspección + suites ya verdes en DEV-01/02).  
**Medio-bajo** sobre operación real (Neon hosted, Vercel, DO, Resend, MP/Stripe, Meet/Zoom): marcada **NO VERIFICADO** donde no hay evidencia en este commit.

---

## 2. Estado de Git y versión auditada

| Campo | Valor |
| --- | --- |
| Base DEV-03 | `dev` @ `634b64f` — `fix(test): enforce local integration database and cleanup` |
| Rama PROD-01 | `feature/prod-01-finance-security` (cambios de aplicación + este doc; **sin commit/push en este cierre documental**) |
| `main` | `5cb42a5` (intacta; no modificada) |
| Incluye (base) | Remediación 01, LMS-01–05, DEV-01 sync PG + gates de integration local |
| Incluye (PROD-01, reportado) | Gate STUDENT allocations 403; `STRIPE_WEBHOOK_SECRET` obligatorio en prod |

### Suites de referencia (reportadas; no re-ejecutadas en este cierre documental)

| Contexto | Suite | Resultado reportado |
| --- | --- | --- |
| DEV-01/02 @ `634b64f` | API unit | 612 tests |
| DEV-01/02 @ `634b64f` | API integration PostgreSQL | 58 tests |
| DEV-01/02 @ `634b64f` | Web lint / typecheck / test / build | 96 tests + build OK |
| PROD-01 (implementación) | API lint / typecheck | OK |
| PROD-01 (implementación) | Focalizados env + finance + Stripe/MP webhooks + student-hub | 80 OK |
| PROD-01 (implementación) | Suite API unit | 617 OK |

Este cierre documental **no** re-ejecuta suites, **no** toca bases de datos y **no** afirma verificación contra proveedores reales ni producción.

### Fuentes contrastadas

`README.md`, `TODO.md`, `ROUTE-MAP.md`, `docs/DECISIONS.md` (#41–#52), `docs/ARCHITECTURE.md`, `docs/INFRASTRUCTURE.md`, `docs/DEPLOY-CHECKLIST.md`, `docs/BACKUP-RESTORE.md`, `docs/audits/LMS-03|04|05_*`, `docs/audits/COURSES_LMS_AUDIT.md` (**obsoleto** vs LMS-01–05), Prisma schema/migraciones, `packages/shared`, API/web, `.github/workflows/ci.yml` + `production.yml`, Compose.

**No existe** `TASK_TRACKER.md`.

---

## 3. Matriz de readiness

| # | Dominio | Estado | Prioridad máx. | Evidencia dominante | Conclusión |
| --- | --- | --- | --- | --- | --- |
| A | Auth / authz | PARCIAL | P1 | Cookie HttpOnly + reload DB; scrypt; `requirePermission`; FIN-DTO **TESTEADO** (PROD-01); sin reset | Auth sólida; falta password reset |
| B | Academia live | IMPLEMENTADO / TESTEADO | P2 | Course/Group/Session/Enrollment; max 15; timezone AR | Operable en MVP |
| C | LMS asíncrono | IMPLEMENTADO / TESTEADO | P2 | LMS-01–05; gratis + publish gates; paid path pendiente | Listo para cursos gratis; cobro LMS no |
| D | Finanzas | IMPLEMENTADO / TESTEADO | P1 | Freeze 40–90; webhooks nativos; legacy bloqueado; FIN-DTO **TESTEADO** | Ledger OK; refunds PSP / PAY-LIVE abiertos |
| E | MP / Stripe | PARCIAL | P1 | Adapters + firma + fetch-before-ledger; boot Stripe secret **TESTEADO** (PROD-01); mocks | Boot gate OK en tests; live **NO VERIFICADO** |
| F | Meet / Zoom | PARCIAL | P1 | Lifecycle + XOR + huérfanos; mocks | No VERIFICADO con APIs reales |
| G | Frontend / roles / Spanish2Go | PARCIAL | P1 | Dashboards por rol; oferta pública marketing; membership engañosa | Spanish2Go ≠ producto; membership P1 |
| H | Notificaciones | PARCIAL | P1 | 3 eventos + Resend opcional; sin reset | Cableado mínimo |
| I | Infra / seguridad | PARCIAL | P0 | Compose/health/docs; deploy PROD no corrido; sin CSP; OPS-02 **TESTEADO** | Base buena; ops PROD no verificada |
| J | CI/CD | PARCIAL | P0 | CI completo; production.yml sin ejecución real; sin E2E | Gate de merge bueno; CD no ensayado |

---

## 4. Hallazgos P0

### OPS-01 — Deploy de producción nunca ejecutado

| Campo | Valor |
| --- | --- |
| Dominio | J / I |
| Prioridad | **P0** |
| Descripción | El workflow `production.yml` (SSH → `prod-up.sh` → migrate en entrypoint → health) existe, pero `TODO.md` Stage 0 admite que el job **no se ha ejecutado** contra un servidor provisionado. |
| Evidencia | `TODO.md` L64–65; `.github/workflows/production.yml`; `docs/INFRASTRUCTURE.md` / `DEPLOY-CHECKLIST.md` |
| Impacto | Promover a `main` puede disparar el primer deploy real sin ensayo: secrets, DNS, migrate, Spaces, health. |
| Escenario | Merge a `main` → SSH falla a mitad / `.env` incompleto / health 503 → servicio caído o schema a medias. |
| Recomendación | Ensayo controlado: provisionar DO, secrets, dry-run `workflow_dispatch`, documentar resultado. No mergear a `main` hasta pasar el ensayo. |
| Criterio de aceptación | Al menos un deploy PROD exitoso (o staging idéntico) con health `ok` y rollback documentado. |
| Dependencias | Host DO, DNS, TLS, secrets server-side, GitHub Environment `production`. |
| Estado | **NO VERIFICADO** / **PENDIENTE** ops |

### OPS-02 — Arranque Stripe en prod sin webhook secret (histórico; remediado)

| Campo | Valor |
| --- | --- |
| Dominio | E / I |
| Prioridad | **P0** (configuración) |
| Descripción (antes) | Con `STRIPE_SECRET_KEY` live, `evaluateConfiguration` **no** exigía `STRIPE_WEBHOOK_SECRET` (sí lo hacía para MP). El proceso podía arrancar; webhooks fallaban después. |
| Cambio PROD-01 | `evaluateConfiguration` exige `STRIPE_WEBHOOK_SECRET` cuando hay `STRIPE_SECRET_KEY` en `NODE_ENV=production` (espejo MP). Fallo vía `preflight.ts` (entrypoint antes de HTTP) y `createRuntimeApp` throw. Sin imprimir secretos. |
| Evidencia | `apps/api/src/config/env.ts`; `env.test.ts` (prod sin secret / con secret / non-prod); `docker/api-entrypoint.sh` → `preflight.js`; `create-runtime-app.ts` L107–112 |
| Tests | `env.test.ts` nuevos; suites Stripe/MP webhook existentes (regresión). |
| Estado | **TESTEADO** (automatizado). **No VERIFICADO** en despliegue/producción real. |

> **Nota:** Legacy inbox Stripe/MP sigue bloqueado fuera de `NODE_ENV=test`. Firma nativa sin cambios de procesamiento.

---

## 5. Hallazgos P1

### AUTH-RESET — Sin recuperación de contraseña

| Campo | Valor |
| --- | --- |
| Dominio | A / H |
| Prioridad | **P1** |
| Descripción | No hay forgot/reset password, tokens ni email de recuperación. |
| Evidencia | Búsqueda sin matches en TS/MD; `ROUTE-MAP.md` auth = login/logout/me |
| Impacto | Usuarios bloqueados dependen de SuperAdmin/Director (provisionamiento no pisa password existente). |
| Escenario | Alumno olvida password → abandono / soporte manual inseguro. |
| Recomendación | Flujo token de un solo uso + email Resend + rate limit; o decisión explícita de negocio “reset manual MVP”. |
| Criterio de aceptación | Endpoint + email + test; o decisión firmada en `DECISIONS.md` aplazando. |
| Estado | **PENDIENTE** |

### FIN-DTO — STUDENT leía split vía `/finance/allocations` (histórico; remediado)

| Campo | Valor |
| --- | --- |
| Dominio | A / D |
| Prioridad | **P1** |
| Descripción (antes) | STUDENT en `mode: 'student'` podía listar/obtener allocations con `academyPercentage` y montos de split. El portal `/students/me/finance` ya ocultaba esos campos (#45). |
| Cambio PROD-01 | `GET /finance/allocations` y `GET /finance/allocations/:id` responden **403** si `scope.mode === 'student'`. TEACHER solo propias; admin/director/grant `finance.read` sin cambio. Contratos shared intactos. |
| Evidencia | `apps/api/src/http/routes/finance.ts` (gate student); tests `finance.test.ts` (FIN-DTO aislamiento); portal `student-hub.test.ts` (sin split). |
| Tests | STUDENT propia/ajena → 403; TEACHER A ≠ B → 403; ADMINISTRATIVE sin/con grant; DIRECTOR conserva split. |
| Estado | **TESTEADO** (automatizado). **No VERIFICADO** en producción real. |

### PAY-STRIPE-CFG — Asimetría de validación env Stripe vs MP (histórico; remediado)

| Campo | Valor |
| --- | --- |
| Dominio | E |
| Prioridad | **P1** |
| Descripción | Ver OPS-02. Antes: MP exigía webhook secret en boot; Stripe no. PROD-01 igualó el criterio. |
| Estado | **TESTEADO** (automatizado reportado). **No VERIFICADO** en prod |

### PAY-LIVE — Pagos live no verificados

| Campo | Valor |
| --- | --- |
| Dominio | E |
| Prioridad | **P1** |
| Descripción | Adapters MP/Stripe, checkout alumno, webhooks nativos (fetch-before-ledger, idempotencia `WebhookEvent`) están implementados y cubiertos con **fetch mockeado**. No hay evidencia en repo de transacción sandbox/live exitosa ni webhook registrado. |
| Evidencia | `payment-provider.ts`, `mercadopago-webhook.ts`, `stripe-webhook.ts`, `student-checkout.ts`, `*-webhook.test.ts`; TODO smoke ngrok/CLI |
| Impacto | Riesgo de fallar el primer cobro real. |
| Recomendación | Smoke controlado sandbox → staging con ngrok/Stripe CLI; checklist en `DEPLOY-CHECKLIST.md`. |
| Criterio de aceptación | Al menos 1 pago MP y 1 Stripe sandbox → SUCCEEDED + allocation; replay idempotente. |
| Estado | **TESTEADO** (mock) / **NO VERIFICADO** (live) |

### UI-MEMBER — Membresía aparenta ser operable

| Campo | Valor |
| --- | --- |
| Dominio | G |
| Prioridad | **P1** |
| Descripción | `/dashboard/membership` muestra planes y CTA “Elegir plan” / “Plan seleccionado” sin pagar, sin API y **sin** etiqueta `Próximamente` (non-negotiable README/producto). |
| Evidencia | `apps/web/src/app/dashboard/membership/page.tsx`; `membership-plan-card.tsx` L109; ROUTE-MAP documenta “sin pagos” pero la UI no lo dice |
| Impacto | Expectativa comercial falsa. |
| Recomendación | Añadir `Próximamente` visible o deshabilitar CTA; o conectar cobro real. |
| Criterio de aceptación | Usuario no puede creer que compró un plan. |
| Estado | **PARCIAL** |

### MEET-LIVE — Meet/Zoom sin verificación real

| Campo | Valor |
| --- | --- |
| Dominio | F |
| Prioridad | **P1** (si go-live incluye aulas virtuales automáticas) |
| Descripción | OAuth S2S Zoom, Google refresh, create/update/delete, XOR, huérfanos (`meetCreationFailed` / `zoomCreationFailed`) implementados y testeados con mocks. Credenciales reales y cuota API **NO VERIFICADO**. |
| Evidencia | `google-meet-service.ts`, `zoom-meeting-service.ts`, `classes-google-meet.test.ts`, `classes-zoom.test.ts`, DECISIONS #49 |
| Recomendación | Smoke con cuentas de prueba; documentar scopes y rotación de tokens. |
| Criterio de aceptación | Crear/actualizar/cancelar 1 Meet y 1 Zoom ligados a ClassSession en staging. |
| Estado | **TESTEADO** (mock) / **NO VERIFICADO** (live) |

### OPS-BACKUP — Backup/restore PROD no ensayado

| Campo | Valor |
| --- | --- |
| Dominio | I |
| Prioridad | **P1** |
| Descripción | `docs/BACKUP-RESTORE.md` + `scripts/db-backup.sh` / `db-restore.sh` existen. Materials (Spaces) fuera de `pg_dump`. TODO Stage 9: cron offsite + drill PROD pendientes. |
| Impacto | Pérdida de datos sin restore probado. |
| Recomendación | Drill restore en staging; backup Spaces versioning; agenda offsite. |
| Criterio de aceptación | Restore exitoso documentado con RTO/RPO acordados. |
| Estado | **IMPLEMENTADO** (docs/scripts) / **NO VERIFICADO** (PROD) |

### INFRA-CSP — Sin Content-Security-Policy

| Campo | Valor |
| --- | --- |
| Dominio | I / G |
| Prioridad | **P1** |
| Descripción | Headers nosniff / frame / referrer / COOP presentes; **no** CSP en `next.config.ts`. |
| Impacto | Superficie XSS mayor si hubiera inyección en UI. |
| Recomendación | CSP restrictiva compatible con Next + assets. |
| Estado | **PARCIAL** |

### NOTIF-SCOPE — Cobertura de eventos limitada

| Campo | Valor |
| --- | --- |
| Dominio | H |
| Prioridad | **P1** (operación) / negociable a P2 |
| Descripción | Solo `USER_CREATED`, `TEACHER_ASSIGNED`, `CLASS_MEETING_LINK`. Sin emails de pago, cancelación de clase, LMS, reset password. |
| Evidencia | `packages/shared/src/notifications.ts`; `notification-hooks.ts` |
| Impacto | Comunicación operativa incompleta. |
| Recomendación | Priorizar pago SUCCEEDED / clase cancelada / reset según negocio. |
| Estado | **IMPLEMENTADO** (mínimo) |

---

## 6. Hallazgos P2 / P3 (agrupados)

### P2

| ID | Dominio | Resumen | Estado |
| --- | --- | --- | --- |
| **FIN-REFUND-PSP** | D/E | `POST …/refunds` confirma ledger sin llamar PSP; inbound MP puede sincronizar. Riesgo de desalineación. | PARCIAL |
| **PAY-RECON** | D/E | Sin job de reconciliación post-outage (fuera de MVP #44, pero operativo). | PENDIENTE |
| **LMS-PAID** | C | Checkout pago LMS + grant en succeedPayment pendiente; CTA contacto. | PENDIENTE |
| **LMS-ADMIN-UI** | C | Soft-delete módulo/lección y review submissions sin UI completa (API parcial). | PARCIAL |
| **LMS-GRANT-DRAFT** | C | `grantAccess` admin no exige PUBLISHED (`enrollFree` sí). | PARCIAL |
| **CI-E2E** | J | Sin Playwright/Cypress en CI. | PENDIENTE |
| **ROUTE-MAP-DRIFT** | G | Tabla privada inicial / Stage 5 materiales desfasados vs hubs reales. | PARCIAL |
| **DOC-LMS-AUDIT** | C | `COURSES_LMS_AUDIT.md` aún lista H1–H5 abiertos; código ya los cerró. | DOC OBSOLETA |
| **DOC-DECISIONS** | — | #41 “freeze trigger” supersedido por #44; #47 duplicado; comentarios `has-permission` stale. | PARCIAL |
| **RATE-LIMIT** | I | Throttle login in-memory; no sirve multi-réplica. | PARCIAL |
| **CI-SECRETS-GREP** | J | Hygiene no lista GOOGLE_MEET_*/ZOOM_*/S3_SECRET en assert de example filled. | PARCIAL |
| **AUTH-BOOTSTRAP** | A | Bootstrap reafirma SUPER_ADMIN en email existente sin password. | IMPLEMENTADO (riesgo residual) |

### P3

| ID | Dominio | Resumen |
| --- | --- | --- |
| **LIVE-GIST** | B | GiST/EXCLUDE teacher overlap deferred (#33). |
| **UI-I18N** | G | Label TEACHER “Earnings” en inglés. |
| **LMS-CERT** | C | `certificateEnabled` sin emisión. |
| **S2GO-PRODUCT** | G | Mentorías/píldoras/Blabla2Go = marketing + mailto (honesto vía PendingBlock en oferta pública). |

---

## 7. Auditoría funcional por rol

| Capacidad | SUPER_ADMIN | DIRECTOR | ADMINISTRATIVE | TEACHER | STUDENT |
| --- | --- | --- | --- | --- | --- |
| Login / sesión | Sí | Sí | Sí | Sí | Sí |
| Reset password | No | No | No | No | No |
| Provision users | Sí (bypass) | Sí (bypass) | Solo con grant `users.create` | No* | No |
| Grants ADMINISTRATIVE | Sí | Sí | No | No | No |
| CRUD students/teachers | Sí | Sí | Según grants | Limitado / hub propio | No |
| Cursos/grupos/sesiones | Sí | Sí | Según grants | Own group + attendance/notes | Own calendar/materials |
| Meet/Zoom generate | Sí (si creds) | Sí | Según grants | Según ownership | No |
| LMS admin | Sí | Sí | Según grants | Parcial / sin author UI | Learner (gratis) |
| Finance settings % | Sí | Sí | Lectura si grant | No | No |
| `GET /finance/allocations` | Sí | Sí | Solo con `finance.read` | Solo propias | **403** (PROD-01) |
| `GET /finance/allocations/:id` | Sí | Sí | Solo con `finance.read` | Solo propia; ajena **403** | **403** propia y ajena (PROD-01) |
| Charges/payments (API admin scoped) | Sí | Sí | Según grants | Scoped teacher | Portal `/students/me/finance` (#45); sin split |
| Checkout pago | — | — | — | — | Sí (API; live NO VERIF.) |
| Membership UI | Ve UI engañosa | Idem | Idem | Idem | Idem |
| Notificaciones campana | Sí | Sí | Sí | Sí | Sí |

\*Teacher no se auto-asigna alumnos (regla de producto; enforced server-side en assignments).

**Multi-tenancy:** modelo de **una academia**; no hay aislamiento cross-tenant. N/A.

---

## 8. Flujos end-to-end

| Flujo | Estado | Notas |
| --- | --- | --- |
| Inscripción alumno (live) | IMPLEMENTADO / TESTEADO | Max 15 con lock; integración enrollment |
| Curso live + calendario + asistencia | IMPLEMENTADO / TESTEADO | Timezone `America/Argentina/Buenos_Aires` default |
| Curso asíncrono gratis | IMPLEMENTADO / TESTEADO | Publish gates; LINEAR; progress; quiz |
| Curso asíncrono de pago | PENDIENTE | Sin checkout LMS |
| Pago charge live (MP/Stripe) | PARCIAL | Código + mocks; live NO VERIFICADO |
| Webhook → SUCCEEDED → allocation freeze | IMPLEMENTADO / TESTEADO | Remediación 01 legacy off |
| Refund | PARCIAL | Ledger admin; inbound MP; sin PSP outbound |
| Liquidación teacher | IMPLEMENTADO / TESTEADO | Mark paid; sin payout bancario (MVP) |
| Clase virtual Meet/Zoom | PARCIAL | Código + mocks; live NO VERIFICADO |
| Notificaciones | PARCIAL | 3 eventos; email opcional |

---

## 9. Integraciones externas

| Integración | Código | Tests automatizados | Config prod (código) | Verificado live / proveedor real |
| --- | --- | --- | --- | --- |
| Mercado Pago | Sí (Preference + webhook) | Mock + firma unit | Token + `MERCADOPAGO_WEBHOOK_SECRET` exigidos en `evaluateConfiguration` | **NO** |
| Stripe | Sí (Checkout Session + webhook) | Mock + firma unit + gate boot (PROD-01) | Key live check; **`STRIPE_WEBHOOK_SECRET` exigido en boot** si hay `STRIPE_SECRET_KEY` (**TESTEADO**; no VERIFICADO en prod) | **NO** |
| Google Meet / Calendar | Sí | HTTP/unit mock | `GOOGLE_MEET_*` | **NO** |
| Zoom | Sí S2S | HTTP/unit mock | `ZOOM_*` | **NO** |
| Resend | Sí fail-soft | Unit templates | `NOTIFICATIONS_ENABLED` + keys | **NO** |
| S3 / Spaces | Sí adapter | Unit/storage | S3_* | DEV MinIO local; Spaces PROD **NO VERIF.** |
| Neon | Cliente Prisma + docs | Integration usa Compose local en CI/script | Hosted DEV docs | Hosted **NO VERIF.** en esta auditoría |
| Vercel | `vercel.json` + docs | — | DEV hosted | **NO VERIF.** |
| DigitalOcean | Compose prod + SSH workflow | Smoke Compose **local** | Secrets host | Deploy **NO VERIF.** |

---

## 10. Seguridad

### Controles presentes

- Sesión HttpOnly, SameSite=Lax, Secure en prod; user reload por request (rol no confiado del JWT solo).  
- scrypt + decoy anti-enumeración + throttle login.  
- `requirePermission` + ownership en classes/finance/materials.  
- Webhooks: firma + fetch recurso + idempotencia; legacy inbox bloqueado fuera de test.  
- PROD-01: STUDENT sin acceso a allocations (403); Stripe webhook secret obligatorio en production boot (**TESTEADO**).  
- CORS allowlist; headers básicos web; secrets hygiene CI; least-privilege env (web sin `DATABASE_URL`).  
- OpenAPI/Swagger gated por `API_DOCS_ENABLED`.

### Riesgos abiertos

- Sin CSP.  
- Rate limit no distribuido.  
- Refund ledger-only.  
- Bootstrap SuperAdmin reassert role.  
- Authz matrix Stage 1 no cubre todas las rutas posteriores (TODO Stage 9).  
- Password reset ausente.  
- Boot/firma Stripe **no VERIFICADOS** contra entorno de producción real (solo tests).

### IDOR (muestra)

- Charge/payment detail: ownership por `studentId`/`teacherId` de sesión — **OK** en tests hub.  
- **Hallazgo histórico (pre–PROD-01):** allocations list/get para STUDENT no era IDOR cross-student, pero **sí** exponía campos sensibles del split propio (`academyPercentage`, montos).  
- **Estado actual (PROD-01):** STUDENT recibe **403** en `GET /finance/allocations` y `GET /finance/allocations/:id` (propia y ajena) — **TESTEADO** en tests automatizados reportados; **no VERIFICADO** en producción. TEACHER sigue limitado a allocations propias (ajena → 403).

---

## 11. Infraestructura y operación

| Tema | Estado |
| --- | --- |
| Compose DEV/PROD | IMPLEMENTADO; prod sin exponer DB/API |
| Health `/health` | IMPLEMENTADO / TESTEADO (config vs DB) |
| Migraciones Prisma | Versionadas; `migrate deploy` en entrypoint y CI integration |
| Integration local vs Neon | DEV-01/02: script fuerza URLs locales + `system_identifier` (commit `634b64f`) |
| Backups PG | Scripts + docs; Spaces aparte; drill PROD pendiente |
| Deploy PROD | Workflow listo; **nunca corrido** |
| Rollback | Implícito (git checkout + redeploy); no runbook ensayado |
| Monitoreo | Logs pino; Sentry mencionado en example; alerting **NO VERIFICADO** |
| Cron | Sin reconciliación pagos / sin backup cron prod |

---

## 12. Plan de remediación priorizado

### Fase 0 — Antes de tocar `main` (P0)

1. **OPS-01** Ensayo deploy PROD (o staging clone) + health + rollback note.  
2. Checklist secrets: MP, Stripe (incl. webhook secret — gate PROD-01), AUTH, DB, S3, Meet/Zoom, Resend.  
3. ~~OPS-02 / PAY-STRIPE-CFG~~ → **TESTEADO** en PROD-01.

### Fase 1 — Bloqueantes go-live (P1)

1. ~~**FIN-DTO**~~ → **TESTEADO** en PROD-01 (403 STUDENT).  
2. **UI-MEMBER** `Próximamente` / deshabilitar CTA.  
3. **PAY-LIVE** Smoke MP + Stripe sandbox con webhook real.  
4. **AUTH-RESET** Implementar o decisión explícita de aplazamiento.  
5. **MEET-LIVE** Smoke Meet + Zoom si el go-live los usa.  
6. **OPS-BACKUP** Drill restore + plan Spaces.  
7. **INFRA-CSP** CSP mínima.  
8. **NOTIF-SCOPE** Al menos eventos críticos acordados (pago / clase).

### Fase 2 — Importante (P2)

- Refund → PSP o UX “solo contable”.  
- Reconciliación mínima.  
- LMS paid path o CTA claramente no-checkout.  
- UI soft-delete LMS + review attempts.  
- E2E smoke crítico en CI.  
- Actualizar `COURSES_LMS_AUDIT.md` / ROUTE-MAP / DECISIONS drift.  
- Rate limit compartido si >1 réplica API.

### Fase 3 — Mejoras (P3)

- GiST overlaps; i18n Earnings; certificados; producto Spanish2Go (booking, ebooks).

### Esfuerzo relativo (orden sugerido)

| Ítem | Esfuerzo | Impacto |
| --- | --- | --- |
| ~~FIN-DTO fix~~ | Hecho (PROD-01, TESTEADO) | — |
| UI-MEMBER label | Bajo | Alto |
| ~~Stripe webhook secret gate~~ | Hecho (PROD-01, TESTEADO) | — |
| Deploy rehearsal | Medio | Crítico |
| Payment smoke | Medio | Crítico |
| Password reset | Medio-Alto | Alto |
| Meet/Zoom smoke | Medio | Alto si aulas auto |
| CSP | Medio | Medio |
| Backup drill | Medio | Alto |
| E2E | Alto | Medio |

---

## 13. Criterios de promoción a `main`

Gates **todos** obligatorios:

1. Working tree limpio; CI verde en el commit candidato (lint, typecheck, unit, integration, build, docker, secrets-hygiene).  
2. ~~**FIN-DTO** cerrado con test~~ (PROD-01 **TESTEADO**).  
3. **UI-MEMBER** no engaña.  
4. ~~**Stripe webhook secret** exigido en prod config~~ (PROD-01 **TESTEADO**; falta smoke live).  
5. Smoke pagos sandbox documentado (MP + Stripe) en entorno que use los mismos adapters.  
6. Ensayo `production.yml` (o staging idéntico) con health `ok`.  
7. Backup/restore drill firmado o fecha + responsable.  
8. Decisión explícita sobre password reset (ship o defer).  
9. Si go-live usa Meet/Zoom: smoke real OK.  
10. `main` solo vía PR review; sin force-push; Environment `production` con reviewers.

Hasta entonces: **no promover**.

---

## 14. Riesgos aceptables y decisiones pendientes

### Puede postergarse (con decisión de negocio)

- LMS de pago / certificados / review submissions UI.  
- Spanish2Go booking, ebooks, cobro Blabla2Go.  
- GiST teacher conflicts.  
- E2E browser completo.  
- Reconciliación avanzada y payouts automáticos.  
- Multi-réplica + rate limit Redis.  
- Password reset **solo si** soporte manual queda documentado y aceptado.

### Necesita decisión explícita

| Tema | Pregunta |
| --- | --- |
| Password reset | ¿MVP sin self-service? |
| Membresía | ¿Marketing interno o cobro real en v1? |
| Aulas virtuales | ¿Manual `meetingUrl` basta al día 1? |
| Refunds | ¿Admin puede marcar REFUNDED sin PSP? |
| Deploy target | ¿DO listo o solo Vercel+Neon “prod-like”? |

---

## 15. Veredicto final

### **NOT READY**

**Justificación:** el producto MVP está sustancialmente implementado y testeado a nivel de código. PROD-01 cerró FIN-DTO y el gate de `STRIPE_WEBHOOK_SECRET` (**TESTEADO**, no VERIFICADO en prod). Siguen abiertos: deploy PROD no ensayado (OPS-01), pagos/Meet/Zoom live, membresía engañosa, password reset, backup drill. Promover `dev` → `main` hoy activaría un camino de deploy no ensayado.

**Camino a READY WITH CONDITIONS:** cerrar Fase 0 + ítems P1 marcados en §12–13; entonces un go-live **controlado** (pocos usuarios, pagos sandbox→live supervisado, Meet manual opcional) puede reevaluarse.

**No confundir:**

| Afirmación incorrecta | Realidad |
| --- | --- |
| “CI verde ⇒ prod ready” | CI no despliega ni cobra |
| “UI membresía ⇒ cobro” | Sin API |
| “Webhook testeado ⇒ PSP OK” | Solo mocks |
| “Compose prod smoke local ⇒ DO OK” | SSH/secrets/DNS no verificados |
| “Portal alumno oculta split ⇒ seguro” | Antes filtraba; PROD-01: allocations → **403** STUDENT (**TESTEADO**) |
| “COURSES_LMS_AUDIT H1–H5 abiertos” | Cerrados por LMS-01–05 en este commit |

---

## Apéndice A — Contradicciones doc ↔ código

1. `docs/audits/COURSES_LMS_AUDIT.md` vs LMS-01–05 en `634b64f`.  
2. DECISIONS #41 “freeze trigger open” vs #44 + código.  
3. DECISIONS #45 “portal no split” — PROD-01 alinea API: STUDENT 403 en `/finance/allocations`.  
4. DECISIONS #47 numeración duplicada (Notifications vs Spanish2Go).  
5. Comentarios en `has-permission.ts` / `require-permission.ts` (“rutas aún no cableadas”).  
6. `ROUTE-MAP.md` tabla privada inicial incompleta vs hubs Stage 7/8.  
7. README non-negotiable `Próximamente` vs membership UI.

## Apéndice B — Fortalezas que sostienen un futuro go-live

- Authz server-side y ownership tests.  
- Freeze financiero 40–90 + legacy allocations CHECK.  
- Remediación 01 (legacy webhook inbox).  
- LMS publish / LINEAR / soft-delete / quiz preserve.  
- Integration suite PG + gates anti-Neon en `test-integration.sh`.  
- Health, migraciones versionadas, secrets hygiene, Compose prod no expone DB.

---

## Apéndice C — Remediación PROD-01 (FIN-DTO + Stripe secret)

| Ítem | Antes (hallazgo histórico) | Después (código en rama PROD-01) | Estado de evidencia |
| --- | --- | --- | --- |
| FIN-DTO | STUDENT 200 en allocations con split | STUDENT **403** en list y `:id` (propia y ajena); TEACHER solo propias; ADMINISTRATIVE con `finance.read`; DIRECTOR/SUPER_ADMIN admin; alumno vía `/students/me/finance` (#45) | **TESTEADO** (suite reportada). **No VERIFICADO** en prod |
| OPS-02 / PAY-STRIPE-CFG | Prod podía arrancar con Stripe key y webhook secret vacío | `evaluateConfiguration` exige secret si hay key en production; `preflight` exit 1 antes de HTTP; `createRuntimeApp` throw; dev/test sin exigencia innecesaria; firma nativa sin cambio de procesamiento | **TESTEADO** (suite reportada). **No VERIFICADO** en prod |
| Preflight | Ya corría antes de HTTP en entrypoint | Mismo orden; ahora también falla por issue Stripe secret | Documentado en código |
| Caminos Stripe | Nativo + legacy | Legacy fuera de `test`; nativo con firma; sin bypass nuevo identificado en auditoría PROD-01 | Auditado en código |
| Contratos shared | — | Sin cambios de cálculo ni shapes de allocation | OK |

**Resultados de tests reportados por la implementación PROD-01 (no re-verificados en este cierre documental):** lint/typecheck OK; focalizados 80 OK; suite API 617 OK.

**Sigue NOT READY / no VERIFICADO:** deploy real (OPS-01), smoke PSP live (PAY-LIVE), Meet/Zoom live, membresía, password reset, backup drill PROD, CSP.

*Origen: DEV-03 auditoría. Remediación: PROD-01 en `feature/prod-01-finance-security`. Este apéndice sincroniza el estado documental.*
