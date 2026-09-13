import { z } from 'zod';
import { roleSchema } from './roles.js';

/**
 * Login credentials as accepted at the API boundary.
 *
 * The maximum password length is bounded so an oversized body can never reach
 * the key-derivation function.
 */
export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(256),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/**
 * The authenticated identity exposed to clients. This shape is deliberately
 * minimal: it must never carry a password hash, a token or internal metadata.
 */
export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: roleSchema,
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

export const sessionResponseSchema = z.object({
  user: sessionUserSchema,
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

/** Shared payload shape for role provisioning (DIRECTOR, ADMINISTRATIVE, TEACHER, …). */
export const provisionUserRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(12).max(256),
  name: z.string().trim().min(1).max(120).optional(),
});

export type ProvisionUserRequest = z.infer<typeof provisionUserRequestSchema>;

export const provisionDirectorRequestSchema = provisionUserRequestSchema;
export type ProvisionDirectorRequest = ProvisionUserRequest;

export const provisionAdministrativeRequestSchema = provisionUserRequestSchema;
export type ProvisionAdministrativeRequest = ProvisionUserRequest;

export const provisionTeacherRequestSchema = provisionUserRequestSchema;
export type ProvisionTeacherRequest = ProvisionUserRequest;

export const provisionStudentRequestSchema = provisionUserRequestSchema;
export type ProvisionStudentRequest = ProvisionUserRequest;
