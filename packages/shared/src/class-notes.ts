import { z } from 'zod';

/** Upper bound for ClassNote.content — free text, longer than Course.description. */
export const CLASS_NOTE_CONTENT_MAX_LENGTH = 4000;

const classNoteContentSchema = z
  .string()
  .trim()
  .min(1)
  .max(CLASS_NOTE_CONTENT_MAX_LENGTH);

/**
 * Private note attached to one ClassSession.
 * Multiple notes per session; no author, soft delete, or versioning in MVP.
 */
export const classNoteSchema = z.object({
  id: z.string().uuid(),
  classSessionId: z.string().uuid(),
  content: classNoteContentSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ClassNote = z.infer<typeof classNoteSchema>;

export const classNoteListResponseSchema = z.object({
  notes: z.array(classNoteSchema),
});

export type ClassNoteListResponse = z.infer<typeof classNoteListResponseSchema>;

export const classNoteResponseSchema = z.object({
  note: classNoteSchema,
});

export type ClassNoteResponse = z.infer<typeof classNoteResponseSchema>;

export const createClassNoteRequestSchema = z.object({
  content: classNoteContentSchema,
});

export type CreateClassNoteRequest = z.infer<
  typeof createClassNoteRequestSchema
>;

export const updateClassNoteRequestSchema = z.object({
  content: classNoteContentSchema,
});

export type UpdateClassNoteRequest = z.infer<
  typeof updateClassNoteRequestSchema
>;
