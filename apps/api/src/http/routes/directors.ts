import {
  provisionDirectorRequestSchema,
  type SessionResponse,
} from '@academia/shared';
import { Router } from 'express';
import {
  provisionDirector,
  RoleConflictError,
  type DirectorProvisionStore,
} from '../../domain/identity/provision-director.js';
import { BadRequestError, ConflictError } from '../errors.js';
import {
  authenticate,
  requireRole,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';

export interface DirectorsDependencies {
  authenticate: AuthenticateOptions;
  directors: DirectorProvisionStore;
}

/**
 * Director provisioning.
 *
 * Only SUPER_ADMIN may create a DIRECTOR. The role is assigned server-side;
 * the request body never carries a role field.
 */
export function createDirectorsRouter({
  authenticate: authOptions,
  directors,
}: DirectorsDependencies): Router {
  const router = Router();

  router.post(
    '/users/directors',
    authenticate(authOptions),
    requireRole('SUPER_ADMIN'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = provisionDirectorRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'A valid email, password (min. 12 characters) and optional name are required.',
            );
          }

          const { outcome, user } = await provisionDirector(directors, parsed.data);
          const body: SessionResponse = { user };
          res.status(outcome === 'created' ? 201 : 200).json(body);
        } catch (error) {
          if (error instanceof RoleConflictError) {
            next(new ConflictError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  return router;
}
