import {
  CLASS_SESSION_GENERATE_MAX_DAYS,
  eachCivilDateInclusive,
  type CivilDate,
  type GenerateClassSessionsResponse,
  type Role,
} from '@academia/shared';

const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCivilDateInput(value: string): value is CivilDate {
  if (!CIVIL_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m! - 1 &&
    dt.getUTCDate() === d
  );
}

export type GenerateRangeValidation =
  | { ok: true; from: CivilDate; to: CivilDate; dayCount: number }
  | { ok: false; message: string };

/**
 * Client-side format/order/max-span checks. The API remains authoritative.
 */
export function validateGenerateDateRange(
  fromRaw: string,
  toRaw: string,
  maxDays: number = CLASS_SESSION_GENERATE_MAX_DAYS,
): GenerateRangeValidation {
  const from = fromRaw.trim();
  const to = toRaw.trim();
  if (!from || !to) {
    return { ok: false, message: 'Indicá la fecha de inicio y la de fin.' };
  }
  if (!isCivilDateInput(from) || !isCivilDateInput(to)) {
    return {
      ok: false,
      message: 'Usá fechas válidas con formato AAAA-MM-DD.',
    };
  }
  if (from > to) {
    return {
      ok: false,
      message: 'La fecha de fin debe ser igual o posterior a la de inicio.',
    };
  }
  const dayCount = eachCivilDateInclusive(from, to).length;
  if (dayCount > maxDays) {
    return {
      ok: false,
      message: `El rango no puede superar ${maxDays} días.`,
    };
  }
  return { ok: true, from, to, dayCount };
}

/** UX gate only — generate requires `classes.create` (API). */
export function canShowGenerateUi(role: Role): boolean {
  return role !== 'STUDENT';
}

export function generateClassSessionsErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'No se pudo generar. Revisá el grupo, el rango de fechas y que el grupo tenga franja horaria asignada.';
    case 403:
      return 'No tenés permiso para generar clases.';
    case 404:
      return 'No encontramos el grupo.';
    case 409:
      return 'Hay un conflicto que impide completar la generación.';
    default:
      return 'No pudimos generar las clases. Intentá de nuevo.';
  }
}

export function formatGenerateResultSummary(
  result: Pick<
    GenerateClassSessionsResponse,
    'generatedCount' | 'skippedCount' | 'conflictCount' | 'from' | 'to'
  >,
): string {
  return `Rango ${result.from} → ${result.to}: ${result.generatedCount} creadas, ${result.skippedCount} omitidas (ya existían), ${result.conflictCount} omitidas por conflicto de horario.`;
}
