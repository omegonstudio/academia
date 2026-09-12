import { hashPassword } from '../lib/password.js';
import { logger } from '../lib/logger.js';
import type { Database } from '../lib/prisma.js';
import { normalizeEmail } from '../domain/identity/user-repository.js';

export type BootstrapOutcome = 'created' | 'reasserted' | 'skipped';

export interface BootstrapOptions {
  email: string;
  /** Absent means the caller has no password to provision with. */
  password?: string | undefined;
}

/**
 * Provisions the technical SUPER_ADMIN account.
 *
 * Runs on every deployment and is therefore idempotent:
 *
 *   - missing account + password available  -> create it
 *   - existing account                      -> re-assert SUPER_ADMIN and active
 *   - no password available                 -> do nothing
 *
 * An existing password is never overwritten, so a rotated production
 * credential cannot be silently reset by a redeploy. A missing
 * SUPERADMIN_PASSWORD is not an error: deployments must not fail because an
 * optional bootstrap secret is absent.
 */
export async function bootstrapSuperAdmin(
  database: Database,
  { email, password }: BootstrapOptions,
): Promise<BootstrapOutcome> {
  const normalized = normalizeEmail(email);

  const existing = await database.user.findUnique({
    where: { email: normalized },
    select: { id: true, role: true, isActive: true },
  });

  if (existing) {
    if (existing.role !== 'SUPER_ADMIN' || !existing.isActive) {
      await database.user.update({
        where: { id: existing.id },
        data: { role: 'SUPER_ADMIN', isActive: true },
      });
      logger.info({ email: normalized }, 'SuperAdmin role re-asserted');
    } else {
      logger.info({ email: normalized }, 'SuperAdmin already provisioned');
    }
    return 'reasserted';
  }

  if (!password) {
    logger.warn(
      { email: normalized },
      'SUPERADMIN_PASSWORD is not set; skipping SuperAdmin bootstrap',
    );
    return 'skipped';
  }

  await database.user.create({
    data: {
      email: normalized,
      name: 'Omegon SuperAdmin',
      passwordHash: await hashPassword(password),
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  logger.info({ email: normalized }, 'SuperAdmin created');
  return 'created';
}
