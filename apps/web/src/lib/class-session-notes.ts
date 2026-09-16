import {
  CLASS_NOTE_CONTENT_MAX_LENGTH,
  type Role,
} from '@academia/shared';

/** UX gate only — API remains the security boundary. */
export function canMutateNotesUi(role: Role): boolean {
  return role !== 'STUDENT';
}

export function validateNoteContentDraft(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return 'La nota no puede estar vacía.';
  }
  if (trimmed.length > CLASS_NOTE_CONTENT_MAX_LENGTH) {
    return `La nota no puede superar ${CLASS_NOTE_CONTENT_MAX_LENGTH} caracteres.`;
  }
  return null;
}

export function classNoteMutationErrorMessage(
  status: number,
  action: 'create' | 'update' | 'delete' = 'update',
): string {
  switch (status) {
    case 400:
      return 'Revisá el contenido de la nota (1–4000 caracteres).';
    case 403:
      return action === 'delete'
        ? 'No tenés permiso para eliminar esta nota.'
        : 'No tenés permiso para editar notas de esta clase.';
    case 404:
      return 'No encontramos la clase o la nota.';
    default:
      return 'No pudimos guardar la nota. Intentá de nuevo.';
  }
}
