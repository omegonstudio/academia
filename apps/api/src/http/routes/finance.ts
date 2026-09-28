import {
  allocationListQuerySchema,
  chargeListQuerySchema,
  createChargeRequestSchema,
  createPaymentRequestSchema,
  createRefundRequestSchema,
  createTeacherSettlementRequestSchema,
  financeWebhookRequestSchema,
  markTeacherSettlementPaidRequestSchema,
  paymentListQuerySchema,
  settlementListQuerySchema,
  updateFinanceSettingsRequestSchema,
  type AllocationListQuery,
  type ChargeListQuery,
  type ChargeListResponse,
  type ChargeResponse,
  type FinanceSettingsResponse,
  type FinanceWebhookResponse,
  type PaymentListQuery,
  type PaymentListResponse,
  type PaymentResponse,
  type RefundResponse,
  type RevenueAllocationListResponse,
  type RevenueAllocationResponse,
  type SessionUser,
  type SettlementListQuery,
  type TeacherSettlementListResponse,
  type TeacherSettlementResponse,
} from '@academia/shared';
import { Router } from 'express';
import {
  hasPermission,
  type PermissionGrantStore,
} from '../../domain/authorization/has-permission.js';
import {
  createChargeForClassSession,
  createChargeForEnrollmentPeriod,
} from '../../domain/finance/charge-service.js';
import {
  FinanceConflictError,
  FinanceInvalidTransitionError,
  FinanceNotFoundError,
  FinanceValidationError,
} from '../../domain/finance/finance-errors.js';
import {
  serializeAllocation,
  serializeCharge,
  serializeFinanceSettings,
  serializePayment,
  serializeRefund,
  serializeSettlement,
} from '../../domain/finance/finance-http-serialize.js';
import {
  getOrCreateFinanceSettings,
  updateFinanceSettings,
} from '../../domain/finance/finance-settings-service.js';
import type { FinanceStore } from '../../domain/finance/finance-store.js';
import { resolvePaymentProvider } from '../../domain/finance/payment-provider.js';
import {
  createPayment,
  succeedPayment,
} from '../../domain/finance/payment-service.js';
import { confirmTotalRefund } from '../../domain/finance/refund-service.js';
import {
  createTeacherSettlement,
  markTeacherSettlementPaid,
} from '../../domain/finance/settlement-service.js';
import { processProviderWebhook } from '../../domain/finance/webhook-service.js';
import type { StudentStore } from '../../domain/students/student-service.js';
import type { TeacherStore } from '../../domain/teachers/teacher-service.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../errors.js';
import {
  authenticate,
  requireRole,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/require-permission.js';

export interface FinanceDependencies {
  authenticate: AuthenticateOptions;
  finance: FinanceStore;
  permissionGrants: PermissionGrantStore;
  students: StudentStore;
  teachers: TeacherStore;
}

function pathId(raw: string | string[] | undefined): string | undefined {
  return typeof raw === 'string' ? raw : raw?.[0];
}

function mapFinanceError(error: unknown): never {
  if (error instanceof FinanceValidationError) {
    throw new BadRequestError(error.message);
  }
  if (error instanceof FinanceNotFoundError) {
    throw new NotFoundError(error.message);
  }
  if (error instanceof FinanceConflictError) {
    throw new ConflictError(error.message);
  }
  if (error instanceof FinanceInvalidTransitionError) {
    throw new ConflictError(error.message);
  }
  throw error;
}

type FinanceReadScope =
  | { mode: 'admin' }
  | { mode: 'student'; studentId: string }
  | { mode: 'teacher'; teacherId: string };

async function resolveFinanceReadScope(
  grants: PermissionGrantStore,
  user: SessionUser,
  students: StudentStore,
  teachers: TeacherStore,
): Promise<FinanceReadScope | null> {
  if (await hasPermission(grants, user.role, 'finance', 'read')) {
    return { mode: 'admin' };
  }
  if (user.role === 'STUDENT') {
    const student = await students.findByUserId(user.id);
    if (!student) return null;
    return { mode: 'student', studentId: student.id };
  }
  if (user.role === 'TEACHER') {
    const teacher = await teachers.findByUserId(user.id);
    if (!teacher) return null;
    return { mode: 'teacher', teacherId: teacher.id };
  }
  return null;
}

function applyChargeOwnership(
  scope: FinanceReadScope,
  query: ChargeListQuery,
): ChargeListQuery | null {
  if (scope.mode === 'admin') return query;
  if (scope.mode === 'student') {
    if (query.studentId && query.studentId !== scope.studentId) return null;
    return { ...query, studentId: scope.studentId, teacherId: undefined };
  }
  if (query.teacherId && query.teacherId !== scope.teacherId) return null;
  return { ...query, teacherId: scope.teacherId, studentId: undefined };
}

function applyPaymentOwnership(
  scope: FinanceReadScope,
  query: PaymentListQuery,
): PaymentListQuery | null {
  if (scope.mode === 'admin') return query;
  if (scope.mode === 'student') {
    if (query.studentId && query.studentId !== scope.studentId) return null;
    return { ...query, studentId: scope.studentId, teacherId: undefined };
  }
  if (query.teacherId && query.teacherId !== scope.teacherId) return null;
  return { ...query, teacherId: scope.teacherId, studentId: undefined };
}

function applyAllocationOwnership(
  scope: FinanceReadScope,
  query: AllocationListQuery,
): AllocationListQuery | null {
  if (scope.mode === 'admin') return query;
  if (scope.mode === 'student') {
    if (query.studentId && query.studentId !== scope.studentId) return null;
    return { ...query, studentId: scope.studentId, teacherId: undefined };
  }
  if (query.teacherId && query.teacherId !== scope.teacherId) return null;
  return { ...query, teacherId: scope.teacherId, studentId: undefined };
}

function applySettlementOwnership(
  scope: FinanceReadScope,
  query: SettlementListQuery,
): SettlementListQuery | null {
  if (scope.mode === 'admin') return query;
  if (scope.mode === 'student') return null;
  if (query.teacherId && query.teacherId !== scope.teacherId) return null;
  return { ...query, teacherId: scope.teacherId };
}

export function createFinanceRouter({
  authenticate: authOptions,
  finance,
  permissionGrants,
  students,
  teachers,
}: FinanceDependencies): Router {
  const router = Router();

  // --- Settings (#41: SUPER_ADMIN / DIRECTOR only for PATCH) ---------------

  router.get(
    '/finance/settings',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'finance', 'read'),
    (_req, res, next) => {
      void (async () => {
        try {
          const view = await getOrCreateFinanceSettings(finance);
          const body: FinanceSettingsResponse = {
            settings: serializeFinanceSettings(view),
          };
          res.status(200).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  router.patch(
    '/finance/settings',
    authenticate(authOptions),
    requireRole('SUPER_ADMIN', 'DIRECTOR'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = updateFinanceSettingsRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'academyPercentage must be one of 20, 30, 40, 50.',
            );
          }
          const view = await updateFinanceSettings(finance, {
            academyPercentage: parsed.data.academyPercentage,
            updatedByUserId: req.user!.id,
          });
          const body: FinanceSettingsResponse = {
            settings: serializeFinanceSettings(view),
          };
          res.status(200).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  // --- Charges ------------------------------------------------------------

  router.get('/finance/charges', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const scope = await resolveFinanceReadScope(
          permissionGrants,
          req.user!,
          students,
          teachers,
        );
        if (!scope) throw new ForbiddenError();

        const parsed = chargeListQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          throw new BadRequestError('Invalid charge list filters.');
        }
        const filters = applyChargeOwnership(scope, parsed.data);
        if (!filters) throw new ForbiddenError();

        const charges = await finance.listCharges(filters);
        const body: ChargeListResponse = {
          charges: charges.map(serializeCharge),
        };
        res.status(200).json(body);
      } catch (error) {
        mapFinanceError(error);
      }
    })().catch(next);
  });

  router.get(
    '/finance/charges/:id',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Charge id is required.');

          const scope = await resolveFinanceReadScope(
            permissionGrants,
            req.user!,
            students,
            teachers,
          );
          if (!scope) throw new ForbiddenError();

          const charge = await finance.findChargeById(id);
          if (!charge) throw new NotFoundError('Charge not found.');

          if (scope.mode === 'student' && charge.studentId !== scope.studentId) {
            throw new ForbiddenError();
          }
          if (scope.mode === 'teacher') {
            const teacherId = await finance.resolveTeacherIdForCharge(charge);
            if (teacherId !== scope.teacherId) throw new ForbiddenError();
          }

          const body: ChargeResponse = { charge: serializeCharge(charge) };
          res.status(200).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/finance/charges',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'finance', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = createChargeRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid charge kind (CLASS_SESSION or ENROLLMENT_PERIOD) is required.',
            );
          }
          const data = parsed.data;
          const charge =
            data.kind === 'CLASS_SESSION'
              ? await createChargeForClassSession(finance, {
                  classSessionId: data.classSessionId,
                  studentId: data.studentId,
                  createdByUserId: req.user!.id,
                  description: data.description,
                })
              : await createChargeForEnrollmentPeriod(finance, {
                  enrollmentId: data.enrollmentId,
                  periodStart: new Date(data.periodStart),
                  periodEnd: new Date(data.periodEnd),
                  createdByUserId: req.user!.id,
                  description: data.description,
                });
          const body: ChargeResponse = { charge: serializeCharge(charge) };
          res.status(201).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  // --- Payments -----------------------------------------------------------

  router.get(
    '/finance/payments',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const scope = await resolveFinanceReadScope(
            permissionGrants,
            req.user!,
            students,
            teachers,
          );
          if (!scope) throw new ForbiddenError();

          const parsed = paymentListQuerySchema.safeParse(req.query);
          if (!parsed.success) {
            throw new BadRequestError('Invalid payment list filters.');
          }
          const filters = applyPaymentOwnership(scope, parsed.data);
          if (!filters) throw new ForbiddenError();

          const payments = await finance.listPayments(filters);
          const body: PaymentListResponse = {
            payments: payments.map(serializePayment),
          };
          res.status(200).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/finance/payments/:id',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Payment id is required.');

          const scope = await resolveFinanceReadScope(
            permissionGrants,
            req.user!,
            students,
            teachers,
          );
          if (!scope) throw new ForbiddenError();

          const payment = await finance.findPaymentById(id);
          if (!payment) throw new NotFoundError('Payment not found.');

          if (
            scope.mode === 'student' &&
            payment.studentId !== scope.studentId
          ) {
            throw new ForbiddenError();
          }
          if (scope.mode === 'teacher') {
            const charge = await finance.findChargeById(payment.chargeId);
            if (!charge) throw new NotFoundError('Charge not found.');
            const teacherId = await finance.resolveTeacherIdForCharge(charge);
            if (teacherId !== scope.teacherId) throw new ForbiddenError();
          }

          const body: PaymentResponse = { payment: serializePayment(payment) };
          res.status(200).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/finance/payments',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'finance', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = createPaymentRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid chargeId, provider and idempotencyKey are required.',
            );
          }

          let providerPaymentId = parsed.data.providerPaymentId ?? null;
          if (!providerPaymentId) {
            const charge = await finance.findChargeById(parsed.data.chargeId);
            if (!charge) throw new NotFoundError('Charge not found.');
            const provider = resolvePaymentProvider(parsed.data.provider);
            const ref = await provider.createPayment({
              amountMinor: charge.amountMinor,
              currency: charge.currency,
              chargeId: charge.id,
              studentId: charge.studentId,
              idempotencyKey: parsed.data.idempotencyKey,
            });
            providerPaymentId = ref.providerPaymentId;
          }

          const payment = await createPayment(finance, {
            chargeId: parsed.data.chargeId,
            provider: parsed.data.provider,
            idempotencyKey: parsed.data.idempotencyKey,
            providerPaymentId,
            createdByUserId: req.user!.id,
          });
          const body: PaymentResponse = { payment: serializePayment(payment) };
          res.status(201).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/finance/payments/:id/succeed',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'finance', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Payment id is required.');
          const existing = await finance.findPaymentById(id);
          if (!existing) throw new NotFoundError('Payment not found.');
          if (existing.provider !== 'MANUAL') {
            throw new BadRequestError(
              'Only MANUAL payments can be marked SUCCEEDED via this endpoint. Use provider webhooks for MERCADOPAGO/STRIPE.',
            );
          }
          const result = await succeedPayment(finance, id);
          const body: PaymentResponse = {
            payment: serializePayment(result.payment),
          };
          res.status(200).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/finance/payments/:id/refunds',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'finance', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Payment id is required.');
          const parsed = createRefundRequestSchema.safeParse(req.body ?? {});
          if (!parsed.success) {
            throw new BadRequestError('Invalid refund payload.');
          }
          const result = await confirmTotalRefund(finance, {
            paymentId: id,
            reason: parsed.data.reason,
            createdByUserId: req.user!.id,
          });
          const body: RefundResponse = {
            refund: serializeRefund(result.refund),
            payment: serializePayment(result.payment),
          };
          res.status(201).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  // --- Allocations (read-only; immutable) ---------------------------------

  router.get(
    '/finance/allocations',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const scope = await resolveFinanceReadScope(
            permissionGrants,
            req.user!,
            students,
            teachers,
          );
          if (!scope) throw new ForbiddenError();

          const parsed = allocationListQuerySchema.safeParse(req.query);
          if (!parsed.success) {
            throw new BadRequestError('Invalid allocation list filters.');
          }
          const filters = applyAllocationOwnership(scope, parsed.data);
          if (!filters) throw new ForbiddenError();

          const allocations = await finance.listAllocations(filters);
          const body: RevenueAllocationListResponse = {
            allocations: allocations.map(serializeAllocation),
          };
          res.status(200).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/finance/allocations/:id',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Allocation id is required.');

          const scope = await resolveFinanceReadScope(
            permissionGrants,
            req.user!,
            students,
            teachers,
          );
          if (!scope) throw new ForbiddenError();

          const allocation = await finance.findAllocationById(id);
          if (!allocation) throw new NotFoundError('Allocation not found.');

          if (
            scope.mode === 'student' &&
            allocation.studentId !== scope.studentId
          ) {
            throw new ForbiddenError();
          }
          if (
            scope.mode === 'teacher' &&
            allocation.teacherId !== scope.teacherId
          ) {
            throw new ForbiddenError();
          }

          const body: RevenueAllocationResponse = {
            allocation: serializeAllocation(allocation),
          };
          res.status(200).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  // --- Settlements (status OPEN → MARKED_PAID; domain has no OWED) --------

  router.get(
    '/finance/settlements',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const scope = await resolveFinanceReadScope(
            permissionGrants,
            req.user!,
            students,
            teachers,
          );
          if (!scope) throw new ForbiddenError();

          const parsed = settlementListQuerySchema.safeParse(req.query);
          if (!parsed.success) {
            throw new BadRequestError('Invalid settlement list filters.');
          }
          const filters = applySettlementOwnership(scope, parsed.data);
          if (!filters) throw new ForbiddenError();

          const settlements = await finance.listSettlements(filters);
          const body: TeacherSettlementListResponse = {
            settlements: settlements.map(serializeSettlement),
          };
          res.status(200).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/finance/settlements/:id',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Settlement id is required.');

          const scope = await resolveFinanceReadScope(
            permissionGrants,
            req.user!,
            students,
            teachers,
          );
          if (!scope) throw new ForbiddenError();
          if (scope.mode === 'student') throw new ForbiddenError();

          const settlement = await finance.findSettlementById(id);
          if (!settlement) throw new NotFoundError('TeacherSettlement not found.');

          if (
            scope.mode === 'teacher' &&
            settlement.teacherId !== scope.teacherId
          ) {
            throw new ForbiddenError();
          }

          const body: TeacherSettlementResponse = {
            settlement: serializeSettlement(settlement),
          };
          res.status(200).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/finance/settlements',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'finance', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = createTeacherSettlementRequestSchema.safeParse(
            req.body,
          );
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid teacherId, periodStart, periodEnd and currency are required.',
            );
          }
          const settlement = await createTeacherSettlement(finance, {
            teacherId: parsed.data.teacherId,
            periodStart: new Date(parsed.data.periodStart),
            periodEnd: new Date(parsed.data.periodEnd),
            currency: parsed.data.currency,
            note: parsed.data.note,
          });
          const body: TeacherSettlementResponse = {
            settlement: serializeSettlement(settlement),
          };
          res.status(201).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/finance/settlements/:id/mark-paid',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'finance', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Settlement id is required.');
          const parsed = markTeacherSettlementPaidRequestSchema.safeParse(
            req.body ?? {},
          );
          if (!parsed.success) {
            throw new BadRequestError('Invalid mark-paid payload.');
          }
          const settlement = await markTeacherSettlementPaid(
            finance,
            id,
            parsed.data.note,
          );
          const body: TeacherSettlementResponse = {
            settlement: serializeSettlement(settlement),
          };
          res.status(200).json(body);
        } catch (error) {
          mapFinanceError(error);
        }
      })().catch(next);
    },
  );

  // --- Webhooks (no session; signature verification TODO) -----------------

  router.post('/finance/webhooks/mercado-pago', (req, res, next) => {
    void (async () => {
      try {
        // TODO: provider signature verification when SDK/provider credentials are introduced.
        const parsed = financeWebhookRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new BadRequestError(
            'Valid providerEventId and type are required.',
          );
        }
        const result = await processProviderWebhook(finance, {
          provider: 'MERCADOPAGO',
          providerEventId: parsed.data.providerEventId,
          type: parsed.data.type,
          paymentId: parsed.data.paymentId,
          payload: parsed.data.payload,
        });
        const body: FinanceWebhookResponse = {
          received: true,
          duplicate: result.duplicate,
          processed: result.processed,
        };
        res.status(200).json(body);
      } catch (error) {
        mapFinanceError(error);
      }
    })().catch(next);
  });

  router.post('/finance/webhooks/stripe', (req, res, next) => {
    void (async () => {
      try {
        // TODO: provider signature verification when SDK/provider credentials are introduced.
        const parsed = financeWebhookRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new BadRequestError(
            'Valid providerEventId and type are required.',
          );
        }
        const result = await processProviderWebhook(finance, {
          provider: 'STRIPE',
          providerEventId: parsed.data.providerEventId,
          type: parsed.data.type,
          paymentId: parsed.data.paymentId,
          payload: parsed.data.payload,
        });
        const body: FinanceWebhookResponse = {
          received: true,
          duplicate: result.duplicate,
          processed: result.processed,
        };
        res.status(200).json(body);
      } catch (error) {
        mapFinanceError(error);
      }
    })().catch(next);
  });

  return router;
}
