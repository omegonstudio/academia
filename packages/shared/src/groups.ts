import { z } from 'zod';

const nameSchema = z.string().trim().min(1).max(120);

/**
 * Academic group within a Course.
 * teacherId / scheduleOptionId are optional current links (no history).
 */
export const groupSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  name: nameSchema,
  teacherId: z.string().uuid().nullable(),
  scheduleOptionId: z.string().uuid().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Group = z.infer<typeof groupSchema>;

export const groupListResponseSchema = z.object({
  groups: z.array(groupSchema),
});

export type GroupListResponse = z.infer<typeof groupListResponseSchema>;

export const groupResponseSchema = z.object({
  group: groupSchema,
});

export type GroupResponse = z.infer<typeof groupResponseSchema>;

export const createGroupRequestSchema = z.object({
  courseId: z.string().uuid(),
  name: nameSchema,
  isActive: z.boolean().optional(),
});

export type CreateGroupRequest = z.infer<typeof createGroupRequestSchema>;

export const updateGroupRequestSchema = z
  .object({
    name: nameSchema.optional(),
    isActive: z.boolean().optional(),
    scheduleOptionId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.isActive !== undefined ||
      value.scheduleOptionId !== undefined,
    { message: 'At least one field is required.' },
  );

export type UpdateGroupRequest = z.infer<typeof updateGroupRequestSchema>;
