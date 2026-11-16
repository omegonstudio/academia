# Academia — Auditoría: pagos pendientes de estudiantes

| Campo | Valor |
| --- | --- |
| Rama / commit base (auditoría) | `dev` @ `9e12aa2` (post–merge PROD-01) |
| Implementación T1–T9 | `dev` @ `566eef1` (post–T8; T9 docs) |
| Tipo original | Solo auditoría |
| Fecha auditoría | 2026-11-03 |
| Fecha cierre implementación | 2026-11-16 |
| Relación | Tras PROD-01; plan de pagos/comprobantes ejecutado en `origin/dev` |

**Convención de evidencia**

- **EN CÓDIGO / TESTEADO:** existe implementación y/o tests automatizados en el repo.
- **NO VERIFICADO:** requiere smoke con PSP real, Spaces prod u operación hosted.

---

## 1. Estado actual de estudiantes activos e inactivos

### Significado

| Campo | Modelo | Significado operativo (código) |
| --- | --- | --- |
| `User.isActive` | Identity | Si es `false`, login y carga de sesión fallan (`auth-service.ts`: mismo timing que password incorrecta). |
| `Student.isActive` | Perfil alumno | Soft-delete / baja lógica del perfil; sincronizado con User en soft-delete. |
| `Enrollment.isActive` | Membresía en Group | Inscripción activa en un grupo; listas y entitlements filtran activos. |

Schema: [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma).

### Quién los modifica

| Operación | Archivo | Efecto |
| --- | --- | --- |
| Soft-delete Student | `domain/students/student-store.ts` (`softDelete`) | `Student.isActive=false` + `User.isActive=false` en transacción |
| Update Student `isActive` | `student-store.update` | Puede reflejar en User si el patch incluye `isActive` |
| Deactivate enrollment | `domain/enrollments/enrollment-store.ts` | `Enrollment.isActive=false` |
| Re-enroll | enrollment store | Puede reactivar `isActive=true` |

### Filtros que usan `isActive`

- Enrollments por grupo: solo activos.
- Materials (entitlement): requieren enrollment activo.
- Login: requiere `User.isActive`.
- **Portal finance** (`getStudentFinancePortal`): resuelve Student por `userId` de sesión; **no** filtra cargos por `Student.isActive` ni por deuda.

### Deuda y actividad

**No hay desactivación automática por cargos pendientes.**  
Búsqueda en dominio finance / auto-charge: sin vínculo a `isActive`.

| Escenario | Comportamiento verificado en código |
| --- | --- |
| Alumno activo + Charge OPEN | Puede autenticarse; portal lista cargos; CTA Pagar según reglas UI (§3) |
| Alumno inactivo (`User.isActive=false`) | No puede login → no accede al portal (aunque existan Charges) |
| Enrollment inactivo + deuda | Enrollment no da acceso a materials del grupo; Charges existentes no se borran ni se auto-cancelan por ese hecho |

---

## 2. Flujo actual de cargos y pagos

```text
Charge (OPEN)
  → createPayment / startStudentCheckout → Payment (PENDING)
  → Provider hosted checkout (MP Preference / Stripe Session)  [o stub sin URL]
  → Webhook nativo (firma + fetch recurso)  |  MANUAL: POST …/succeed (admin)
  → succeedPayment → Payment SUCCEEDED + Charge PAID + RevenueAllocation ORIGINAL
```

### Creación de Charge

- Dominio: `createChargeForClassSession` / `createChargeForEnrollmentPeriod` — [`charge-service.ts`](../../apps/api/src/domain/finance/charge-service.ts).
- HTTP admin: `POST /finance/charges` — [`finance.ts`](../../apps/api/src/http/routes/finance.ts).
- Automático: [`auto-charge.ts`](../../apps/api/src/domain/finance/auto-charge.ts) / runner (post-clase / período GROUP).

### Portal estudiante

| Endpoint | Función |
| --- | --- |
| `GET /students/me/finance` | `getStudentFinancePortal` — charges, payments, refunds mínimos, summary; **sin** split (#45 / PROD-01) |
| `POST /students/me/finance/charges/:chargeId/pay` | `startStudentCheckout` |

Rutas: [`student-hub.ts`](../../apps/api/src/http/routes/student-hub.ts).  
Checkout: [`student-checkout.ts`](../../apps/api/src/domain/finance/student-checkout.ts).

### Estados Charge / Payment

- Charge: típicamente `OPEN` → `PAID` (vía succeed); no hay “vencimiento” de Charge en dominio MVP.
- Payment: `PENDING` → `SUCCEEDED` | `FAILED` | `CANCELLED`; `SUCCEEDED` → `REFUNDED` — [`payment-transitions.ts`](../../apps/api/src/domain/finance/payment-transitions.ts).
- `FAILED` / `CANCELLED` son **terminales** (sin transición de salida).

### Idempotencia / doble cobro

- Checkout alumno: clave `student-checkout:{studentId}:{chargeId}`.
- Un solo Payment por Charge (`chargeId @unique`).
- Webhooks: `WebhookEvent` + processor idempotente ([`webhook-service.ts`](../../apps/api/src/domain/finance/webhook-service.ts)).
- Re-entry PENDING: re-resuelve `checkoutUrl` sin segundo Payment.

### RevenueAllocation

Creada en `succeedPayment` (ORIGINAL congelada con `%` vigente). REVERSAL en refund total.  
**EN CÓDIGO / TESTEADO** (unit + finance HTTP + integration reportada históricamente).  
**NO VERIFICADO** con PSP live (PROD readiness).

---

## 3. Causa concreta de la ausencia del botón de pago

### UI

- Página: [`apps/web/src/app/dashboard/student/finance/page.tsx`](../../apps/web/src/app/dashboard/student/finance/page.tsx)
- Regla: [`chargeCheckoutUiState`](../../apps/web/src/lib/student-finance.ts)

| Condición | Estado UI | CTA |
| --- | --- | --- |
| Charge ≠ `OPEN` | `other` | Ninguno |
| `OPEN` + sin Payment | `payable` | Botón **Pagar** |
| `OPEN` + Payment `PENDING` | `pending` | Texto “Pago pendiente” **sin botón** |
| `OPEN` + Payment FAILED/CANCELLED/… | `other` | Ninguno |

### Backend vs UI (gap)

- Backend **sí** reanuda checkout si Payment está `PENDING` (`resolveCheckoutUrlForPending`).
- UI **no** ofrece CTA de reanudación/reintento en `pending`.
- Tras primer “Pagar” con **stub** (`checkoutUrl: null`), queda PENDING → al recargar no hay botón.
- Si Payment queda `FAILED`/`CANCELLED` y Charge sigue `OPEN`: UI sin Pagar; API responde conflicto “cannot be restarted” → **callejón sin salida** en MVP 1:1.

El resumen “cargos pendientes” = Charges `OPEN`; **no** implica botón Pagar.

---

## 4. Matriz de medios de pago

| Medio | En dominio Academia | Flujo punta a punta | Evidencia | Estado |
| --- | --- | --- | --- | --- |
| Mercado Pago | Sí (`MERCADOPAGO`) | Preference + webhook nativo si hay token; stub si no | `payment-provider.ts`, `mercadopago-webhook.ts`, tests mock | **IMPLEMENTADO** (código) / live **NO VERIFICADO** |
| Stripe | Sí (`STRIPE`) | Checkout Session + webhook nativo si hay key; stub si no | idem Stripe; boot secret PROD-01 | **IMPLEMENTADO** / live **NO VERIFICADO** |
| MANUAL | Sí | Solo admin: create + `POST …/succeed` | `finance.ts`, Manual provider | **IMPLEMENTADO** (admin) |
| Transferencia bancaria (Academia) | No | — | Sin modelo/endpoint/UI | **INEXISTENTE** |
| QR propio Academia | No | — | Sin modelo/endpoint/UI | **INEXISTENTE** |
| Medios dentro del checkout hosted MP | Fuera del dominio | Posibles en UI de MP | No controlados por Academia | **NO VERIFICADO** / no propio |

Routing moneda → provider: `providerForCurrency` en [`packages/shared/src/finance.ts`](../../packages/shared/src/finance.ts) (ARS→MP, USD/EUR→Stripe; nunca MANUAL en checkout alumno).

---

## 5. Diagnóstico del modelo de pagos parciales

### Restricción

```prisma
// schema.prisma — model Payment
chargeId String @unique
```

### Consecuencias

| Caso | Implicación |
| --- | --- |
| Segunda transferencia / segundo intento tras FAILED | No cabe segundo Payment; hace falta cambio de modelo o política de reset |
| Pagos parciales | No modelados (un Charge ↔ un Payment por el monto completo) |
| Reenvío de comprobante | No hay entidad de comprobante; si se amarra a Payment 1:1, colisiona |
| Conciliación monto informado ≠ adeudado | No hay campo ni flujo |
| RevenueAllocation | Asume Payment SUCCEEDED por el monto del Charge |

### Propuesta (solo diseño; no implementar)

Introducir **`PaymentSubmission`** (o nombre equivalente) **separado** de `Payment`:

- Representa un **comprobante informado** (archivo, fecha, monto, observación, estado de revisión).
- `Payment` / `succeedPayment` / allocations siguen siendo la verdad de dinero confirmado.
- Aprobar submission → crear/confirmar Payment (MANUAL o transición controlada) de forma **transaccional e idempotente**.
- Varias submissions por Charge permitidas; como máximo una APPROVED que dispare el ledger (o política explícita de parciales en fase posterior).

Preserva historial, evita confundir “envié comprobante” con “pagado”, y no rompe freeze de allocations.

---

## 6. Propuesta de flujo de comprobantes

### Estudiante

1. Ver Charges `OPEN` (y submissions previas).
2. Subir comprobante: archivo (imagen/PDF), fecha efectiva, monto, observación opcional.
3. Estado: `SUBMITTED` | `NEEDS_CORRECTION` | `APPROVED` | `REJECTED`.
4. Historial consultable; **no** implica Charge PAID hasta aprobación admin.

### Administración

Bandeja con: estudiante, charge, fecha/monto informados, comprobante (URL firmada), estado, delta vs `amountMinor` del Charge, observaciones internas.

Acciones: aprobar / rechazar / solicitar corrección.

**Aprobar:** transacción única: validar submission + (crear/succeed Payment MANUAL o equivalente) + Charge PAID + allocation; idempotente por `submissionId` / clave única.

**Rechazar / corrección:** no toca ledger.

---

## 7. Propuesta de notificaciones y almacenamiento

### Notificaciones (hoy)

| Canal | Estado | Paths |
| --- | --- | --- |
| In-app | Sí | `Notification` + `GET /notifications`; UI campana |
| Resend email | Opcional (`NOTIFICATIONS_ENABLED`) | `resend-email-sender.ts`, `notification-publisher.ts` |
| Tipos | Solo `USER_CREATED`, `TEACHER_ASSIGNED`, `CLASS_MEETING_LINK` | `packages/shared/src/notifications.ts` |
| Finance | **No** | Ningún hook en charge/payment/webhook |
| Telegram | **No infra** | Solo copy marketing (p. ej. membership) |

**Preferencia post-aprobación:** email Resend a roles admin/director al llegar submission; in-app opcional; Telegram solo si se construye integración (hoy **inexistente**).  
Notificación: enlace autenticado a Academia; **sin** adjuntar el archivo del comprobante.

### Almacenamiento (hoy / reutilizable)

Patrón materials:

- Puerto: [`object-storage.ts`](../../apps/api/src/storage/object-storage.ts)
- Adapter S3/Spaces/MinIO: `s3-compatible-storage.ts`
- Flujo: create → presigned PUT → complete + magic bytes; `storageKey` no expuesto; GET firmado

**Receipts:** no existen. Reutilizar mismo puerto con prefijo `receipts/…`, MIME/tamaño, authz por rol, retención documentada. Bucket privado; riesgo principal = URL firmada filtrada o key público por error de config (**NO VERIFICADO** en Spaces prod).

---

## 8. Archivos involucrados (mapa)

```
apps/api/prisma/schema.prisma
apps/api/src/domain/finance/
  charge-service.ts, payment-service.ts, student-checkout.ts,
  student-finance-portal.ts, payment-provider.ts, payment-transitions.ts,
  webhook-service.ts, mercadopago-webhook.ts, stripe-webhook.ts, auto-charge.ts
apps/api/src/http/routes/finance.ts, student-hub.ts, notifications.ts
apps/api/src/domain/students/student-store.ts
apps/api/src/domain/enrollments/enrollment-store.ts
apps/api/src/domain/identity/auth-service.ts
apps/api/src/storage/object-storage.ts, s3-compatible-storage.ts
apps/api/src/domain/materials/material-service.ts
apps/api/src/domain/notifications/*
apps/web/src/app/dashboard/student/finance/page.tsx
apps/web/src/lib/student-finance.ts, api-browser.ts
packages/shared/src/finance.ts, notifications.ts
docs/DECISIONS.md (#44, #45, #48)
docs/audits/PRODUCTION_READINESS_AUDIT.md (PROD-01)
```

---

## 9. Riesgos e implicancias

| Cambio potencial | Riesgo | Mitigación de diseño |
| --- | --- | --- |
| CTA reanudar PENDING | Doble UX vs doble cobro | Reusar mismo Payment + idempotency key |
| Nuevo Payment tras FAILED | Rompe `@unique` o requiere nullificar/archivar Payment viejo | Preferir `PaymentSubmission` o estado “superseded” documentado |
| Pagos parciales | Allocations / freeze / settlements | Fuera de MVP; requiere rediseño de montos |
| Aprobar comprobante = succeed MANUAL | Admin marca pagado sin dinero en PSP | Igual que refund ledger-only: política explícita + auditoría |
| Upload receipts | Exposición / malware | Bucket privado, MIME, size, firmas, virus scan futuro |
| Notificar con adjunto | Filtración PII | Solo deep-link autenticado |

---

## 10. Plan de implementación — estado de cierre

| # | Ticket | Estado | Evidencia |
| --- | --- | --- | --- |
| T1 | Continuar pago PENDING | **IMPLEMENTADO + TESTEADO + INTEGRADO EN DEV** | `42a3aa9` / merge `23c6dfc` |
| T2 | Reintentos FAILED/CANCELLED | **IMPLEMENTADO + TESTEADO + INTEGRADO EN DEV** | `2ea1cff` / merge `f9d4b10`; DECISIONS #53; migración `20261116190000_payment_retry_history` |
| T3 | PaymentSubmission | **IMPLEMENTADO + TESTEADO + INTEGRADO EN DEV** | `0023e46` / merge `4f60e29`; migración `20261116200000_payment_submission` |
| T4 | Upload receipts/ | **IMPLEMENTADO + TESTEADO + INTEGRADO EN DEV** | `844a8dc` / merge `70c7729`; AV pendiente documentado |
| T5 | Bandeja admin | **IMPLEMENTADO + TESTEADO + INTEGRADO EN DEV** | `ea7adb0` / merge `3476de7` |
| T6 | Approve ledger | **IMPLEMENTADO + TESTEADO + INTEGRADO EN DEV** | `b2b7ae0` / merge `28c659f` |
| T7 | Notificaciones | **IMPLEMENTADO + TESTEADO + INTEGRADO EN DEV** | `fe520f9` / merge `d0e3df8` |
| T8 | Regresión | **TESTEADO** (unit/lint/typecheck/build) | merge `566eef1`; API 634 unit; web 96; **NO** smoke PSP live |
| T9 | Docs | **INTEGRADO EN DEV** (este cierre) | rama `docs/payments-t9-readiness` |

**No VERIFICADO EN SANDBOX / PRODUCCIÓN:** PSP live, Spaces prod drill, deploy PROD.

**Fuera de alcance (sigue):** Telegram, QR Academia, transferencia como provider nativo, pagos parciales.

---

## Resumen ejecutivo (actualizado)

1. Deuda **no** desactiva alumnos; inactivo = no login.  
2. Ciclo Charge→Payment→webhook→Allocation + retries (#53) **TESTEADO** con mocks; live PSP **NO VERIFICADO**.  
3. CTA: Pagar / Continuar pago / Reintentar pago según OPEN + estado Payment.  
4. MP/Stripe/MANUAL existen; comprobantes de transferencia vía `PaymentSubmission` (no provider nativo).  
5. Historial de Payments por Charge permitido; como máximo un live PENDING|SUCCEEDED.  
6. Comprobante ≠ pagado hasta approve admin con `moneyReceivedConfirmed` + monto exacto.  
7. Notificar Resend/in-app a Director/SuperAdmin; storage `receipts/` privado.