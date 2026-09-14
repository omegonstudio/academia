import {
  createScheduleOptionRequestSchema,
  updateScheduleOptionRequestSchema,
  type ScheduleOptionListResponse,
  type ScheduleOptionResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import {
  createScheduleOption,
  deleteScheduleOption,
  getScheduleOption,
  listScheduleOptions,
  ScheduleOptionNotFoundError,
  ScheduleOptionValidationError,
  updateScheduleOption,
  type ScheduleOptionStore,
} from '../../domain/schedules/schedule-option-service.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/require-permission.js';

export interface ScheduleOptionsDependencies {
  authenticate: AuthenticateOptions;
  scheduleOptions: ScheduleOptionStore;
  permissionGrants: PermissionGrantStore;
}

function pathId(raw: string | string[] | undefined): string | undefined {
  return typeof raw === 'string' ? raw : raw?.[0];
}

export function createScheduleOptionsRouter({
  authenticate: authOptions,
  scheduleOptions,
  permissionGrants,
}: ScheduleOptionsDependencies): Router {
  const router = Router();

  router.get(
    '/schedule-options',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'schedules', 'read'),
    (_req, res, next) => {
      void (async () => {
        try {
          const body: ScheduleOptionListResponse = {
            scheduleOptions: await listScheduleOptions(scheduleOptions),
          };
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/schedule-options',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'schedules', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = createScheduleOptionRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid day, startTime and endTime (start before end) are required.',
            );
          }
          const scheduleOption = await createScheduleOption(
            scheduleOptions,
            parsed.data,
          );
          const body: ScheduleOptionResponse = { scheduleOption };
          res.status(201).json(body);
        } catch (error) {
          if (error instanceof ScheduleOptionValidationError) {
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.get(
    '/schedule-options/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'schedules', 'read'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Schedule option id is required.');
          const scheduleOption = await getScheduleOption(scheduleOptions, id);
          const body: ScheduleOptionResponse = { scheduleOption };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof ScheduleOptionNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.patch(
    '/schedule-options/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'schedules', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Schedule option id is required.');
          const parsed = updateScheduleOptionRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Provide at least one of day, startTime, endTime or isActive.',
            );
          }
          const scheduleOption = await updateScheduleOption(
            scheduleOptions,
            id,
            parsed.data,
          );
          const body: ScheduleOptionResponse = { scheduleOption };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof ScheduleOptionNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof ScheduleOptionValidationError) {
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.delete(
    '/schedule-options/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'schedules', 'delete'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Schedule option id is required.');
          const scheduleOption = await deleteScheduleOption(
            scheduleOptions,
            id,
          );
          const body: ScheduleOptionResponse = { scheduleOption };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof ScheduleOptionNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  return router;
}
