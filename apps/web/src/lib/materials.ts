import {
  MATERIAL_DEFAULT_MAX_AUDIO_BYTES,
  MATERIAL_DEFAULT_MAX_IMAGE_BYTES,
  MATERIAL_DEFAULT_MAX_PDF_BYTES,
  MATERIAL_DESCRIPTION_MAX_LENGTH,
  MATERIAL_EXTERNAL_URL_MAX_LENGTH,
  MATERIAL_TITLE_MAX_LENGTH,
  isMaterialAllowedMimeType,
  isSafeHttpsExternalUrl,
  materialSizeCategory,
  sanitizeOriginalFilename,
  type MaterialAllowedMimeType,
  type Role,
} from '@academia/shared';

/** UX gate only — API remains the security boundary. */
export function canMutateMaterialsUi(role: Role): boolean {
  return role !== 'STUDENT';
}

export type MaterialsScope =
  | { courseId: string; classSessionId?: never }
  | { classSessionId: string; courseId?: never };

/**
 * Build the list path with exactly one scope query param.
 * Throws if both or neither are provided (programming error).
 */
export function materialsListPath(scope: MaterialsScope): string {
  if ('courseId' in scope && scope.courseId) {
    if ('classSessionId' in scope && scope.classSessionId) {
      throw new Error(
        'Materials list requires exactly one of courseId or classSessionId.',
      );
    }
    return `/materials?courseId=${encodeURIComponent(scope.courseId)}`;
  }
  if ('classSessionId' in scope && scope.classSessionId) {
    return `/materials?classSessionId=${encodeURIComponent(scope.classSessionId)}`;
  }
  throw new Error(
    'Materials list requires exactly one of courseId or classSessionId.',
  );
}

export function validateMaterialTitleDraft(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) return 'El título es obligatorio.';
  if (trimmed.length > MATERIAL_TITLE_MAX_LENGTH) {
    return `El título no puede superar ${MATERIAL_TITLE_MAX_LENGTH} caracteres.`;
  }
  return null;
}

export function validateMaterialDescriptionDraft(
  description: string,
): string | null {
  if (description.trim().length > MATERIAL_DESCRIPTION_MAX_LENGTH) {
    return `La descripción no puede superar ${MATERIAL_DESCRIPTION_MAX_LENGTH} caracteres.`;
  }
  return null;
}

export function validateMaterialExternalUrlDraft(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed.length === 0) return 'La URL es obligatoria.';
  if (trimmed.length > MATERIAL_EXTERNAL_URL_MAX_LENGTH) {
    return `La URL no puede superar ${MATERIAL_EXTERNAL_URL_MAX_LENGTH} caracteres.`;
  }
  if (!isSafeHttpsExternalUrl(trimmed)) {
    return 'La URL debe ser absoluta y usar HTTPS.';
  }
  return null;
}

export function maxBytesForMime(mimeType: MaterialAllowedMimeType): number {
  const category = materialSizeCategory(mimeType);
  if (category === 'pdf') return MATERIAL_DEFAULT_MAX_PDF_BYTES;
  if (category === 'image') return MATERIAL_DEFAULT_MAX_IMAGE_BYTES;
  return MATERIAL_DEFAULT_MAX_AUDIO_BYTES;
}

/** Early UX check — backend remains authoritative (magic bytes / size). */
export function validateMaterialFile(file: File): string | null {
  if (file.size <= 0) {
    return 'El archivo está vacío.';
  }

  const mime = file.type;
  if (!mime || !isMaterialAllowedMimeType(mime)) {
    return (
      'Tipo no permitido. Usá PDF, JPEG, PNG, WebP o audio ' +
      '(MP3, WAV, OGG, M4A). No se admite video ni SVG.'
    );
  }

  const max = maxBytesForMime(mime);
  if (file.size > max) {
    return `El archivo supera el límite de ${formatBytes(max)} para este tipo.`;
  }

  if (!sanitizeOriginalFilename(file.name)) {
    return 'El nombre del archivo no es válido.';
  }

  return null;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function formatMaterialDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function materialKindLabel(kind: 'FILE' | 'LINK'): string {
  return kind === 'FILE' ? 'Archivo' : 'Enlace';
}

export function materialUploadStatusLabel(
  status: 'PENDING' | 'READY',
): string {
  return status === 'PENDING' ? 'Pendiente' : 'Listo';
}

export function materialMutationErrorMessage(
  status: number,
  action: 'create' | 'upload' | 'complete' | 'update' | 'delete' | 'download' | 'list' = 'update',
): string {
  switch (status) {
    case 400:
      if (action === 'upload' || action === 'complete') {
        return 'El archivo no es válido (tipo, tamaño o contenido). Revisá e intentá de nuevo.';
      }
      if (action === 'create') {
        return 'Revisá título y URL (HTTPS absoluto).';
      }
      return 'Revisá los datos del material.';
    case 401:
      return 'Tu sesión expiró. Volvé a iniciar sesión.';
    case 403:
      if (action === 'download' || action === 'list') {
        return 'No tenés permiso para ver este material.';
      }
      if (action === 'delete') {
        return 'No tenés permiso para eliminar este material.';
      }
      return 'No tenés permiso para gestionar materiales aquí.';
    case 404:
      return 'No encontramos el material.';
    case 409:
      return 'Conflicto al guardar. Actualizá la página e intentá de nuevo.';
    case 413:
      return 'El archivo es demasiado grande.';
    default:
      if (action === 'download') {
        return 'No pudimos preparar la descarga. Intentá de nuevo.';
      }
      return 'No pudimos completar la operación. Intentá de nuevo.';
  }
}

export function materialStoragePutErrorMessage(status: number): string {
  if (status === 403 || status === 401) {
    return 'El almacenamiento rechazó la subida. Pedí una nueva URL e intentá de nuevo.';
  }
  if (status >= 500) {
    return 'El almacenamiento no respondió. Intentá de nuevo.';
  }
  return `La subida al almacenamiento falló (${status}).`;
}
