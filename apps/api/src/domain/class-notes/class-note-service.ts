import type {
  ClassNote,
  CreateClassNoteRequest,
  UpdateClassNoteRequest,
} from '@academia/shared';

export class ClassNoteNotFoundError extends Error {
  constructor(message = 'Class note not found.') {
    super(message);
    this.name = 'ClassNoteNotFoundError';
  }
}

export class ClassNoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClassNoteValidationError';
  }
}

export class ClassNoteForbiddenError extends Error {
  constructor(
    message = 'You are not allowed to modify notes for this class.',
  ) {
    super(message);
    this.name = 'ClassNoteForbiddenError';
  }
}

export interface ClassNoteRecord {
  id: string;
  classSessionId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassNoteClassSessionRef {
  id: string;
  groupId: string;
  isActive: boolean;
  teacherId: string | null;
}

/**
 * Write actor for class notes (same policy as Attendance).
 * - `admin`: classes.update (incl. SUPER_ADMIN/DIRECTOR bypass).
 * - `teacher`: Group.teacherId must match.
 */
export type ClassNoteWriteActor =
  | { mode: 'admin' }
  | { mode: 'teacher'; teacherId: string };

export interface ClassNoteStore {
  findClassSession(
    classSessionId: string,
  ): Promise<ClassNoteClassSessionRef | null>;
  listByClassSession(classSessionId: string): Promise<ClassNoteRecord[]>;
  findById(noteId: string): Promise<ClassNoteRecord | null>;
  create(input: {
    classSessionId: string;
    content: string;
  }): Promise<ClassNoteRecord>;
  updateContent(
    noteId: string,
    content: string,
  ): Promise<ClassNoteRecord | null>;
  deleteById(noteId: string): Promise<boolean>;
}

export function toClassNoteDto(record: ClassNoteRecord): ClassNote {
  return {
    id: record.id,
    classSessionId: record.classSessionId,
    content: record.content,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function assertWriteActorOwnsSession(
  actor: ClassNoteWriteActor,
  session: ClassNoteClassSessionRef,
): void {
  if (actor.mode === 'admin') return;
  if (session.teacherId !== actor.teacherId) {
    throw new ClassNoteForbiddenError();
  }
}

async function requireWritableSession(
  store: ClassNoteStore,
  classSessionId: string,
  actor: ClassNoteWriteActor,
): Promise<ClassNoteClassSessionRef> {
  const session = await store.findClassSession(classSessionId);
  if (!session) {
    throw new ClassNoteNotFoundError('Class session not found.');
  }
  if (!session.isActive) {
    throw new ClassNoteValidationError('Class session is inactive.');
  }
  assertWriteActorOwnsSession(actor, session);
  return session;
}

/**
 * Note must exist and belong to the URL classSessionId (prevents cross-session
 * IDOR via noteId).
 */
async function requireNoteInSession(
  store: ClassNoteStore,
  classSessionId: string,
  noteId: string,
): Promise<ClassNoteRecord> {
  const note = await store.findById(noteId);
  if (!note || note.classSessionId !== classSessionId) {
    throw new ClassNoteNotFoundError('Class note not found.');
  }
  return note;
}

export async function listClassNotes(
  store: ClassNoteStore,
  classSessionId: string,
): Promise<ClassNote[]> {
  const session = await store.findClassSession(classSessionId);
  if (!session) {
    throw new ClassNoteNotFoundError('Class session not found.');
  }

  return (await store.listByClassSession(classSessionId)).map(toClassNoteDto);
}

export async function createClassNote(
  store: ClassNoteStore,
  classSessionId: string,
  input: CreateClassNoteRequest,
  actor: ClassNoteWriteActor,
): Promise<ClassNote> {
  await requireWritableSession(store, classSessionId, actor);

  const created = await store.create({
    classSessionId,
    content: input.content,
  });
  return toClassNoteDto(created);
}

export async function updateClassNote(
  store: ClassNoteStore,
  classSessionId: string,
  noteId: string,
  input: UpdateClassNoteRequest,
  actor: ClassNoteWriteActor,
): Promise<ClassNote> {
  await requireWritableSession(store, classSessionId, actor);
  await requireNoteInSession(store, classSessionId, noteId);

  const updated = await store.updateContent(noteId, input.content);
  if (!updated) {
    throw new ClassNoteNotFoundError('Class note not found.');
  }
  return toClassNoteDto(updated);
}

export async function deleteClassNote(
  store: ClassNoteStore,
  classSessionId: string,
  noteId: string,
  actor: ClassNoteWriteActor,
): Promise<void> {
  await requireWritableSession(store, classSessionId, actor);
  await requireNoteInSession(store, classSessionId, noteId);

  const deleted = await store.deleteById(noteId);
  if (!deleted) {
    throw new ClassNoteNotFoundError('Class note not found.');
  }
}
