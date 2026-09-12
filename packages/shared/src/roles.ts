import { z } from 'zod';

/**
 * The five roles of the academy. Order is meaningful only for display;
 * authorization is never derived from array position.
 */
export const ROLES = [
  'SUPER_ADMIN',
  'DIRECTOR',
  'ADMINISTRATIVE',
  'TEACHER',
  'STUDENT',
] as const;

export const roleSchema = z.enum(ROLES);

export type Role = z.infer<typeof roleSchema>;

export function isRole(value: unknown): value is Role {
  return roleSchema.safeParse(value).success;
}
