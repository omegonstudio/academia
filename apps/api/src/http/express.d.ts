import type { SessionUser } from '@academia/shared';

declare module 'express-serve-static-core' {
  interface Request {
    /**
     * Set only by the `authenticate` middleware after verifying the session
     * cookie against the database. Never populated from client input.
     */
    user?: SessionUser;
  }
}
