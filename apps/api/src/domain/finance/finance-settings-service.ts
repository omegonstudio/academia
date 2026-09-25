import type { AcademyPercentage } from '@academia/shared';
import {
  DEFAULT_ACADEMY_PERCENTAGE,
  isAcademyPercentage,
  teacherPercentageFromAcademy,
} from '@academia/shared';
import {
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import type { AcademyFinanceSettingsRecord } from './finance-types.js';

export interface AcademyFinanceSettingsView {
  id: string;
  academyPercentage: AcademyPercentage;
  teacherPercentage: number;
  updatedAt: Date;
  updatedByUserId: string | null;
}

function toView(
  record: AcademyFinanceSettingsRecord,
): AcademyFinanceSettingsView {
  return {
    id: record.id,
    academyPercentage: record.academyPercentage,
    teacherPercentage: teacherPercentageFromAcademy(record.academyPercentage),
    updatedAt: record.updatedAt,
    updatedByUserId: record.updatedByUserId,
  };
}

/**
 * Returns current settings, creating the default row (40) if missing.
 * HTTP authz (SUPER_ADMIN/DIRECTOR) is Stage 6B-2 — domain only validates values.
 */
export async function getOrCreateFinanceSettings(
  store: FinanceStore,
): Promise<AcademyFinanceSettingsView> {
  const existing = await store.getFinanceSettings();
  if (existing) return toView(existing);
  const created = await store.upsertFinanceSettings({
    academyPercentage: DEFAULT_ACADEMY_PERCENTAGE,
    updatedByUserId: null,
  });
  return toView(created);
}

export async function updateFinanceSettings(
  store: FinanceStore,
  input: {
    academyPercentage: number;
    updatedByUserId: string | null;
  },
): Promise<AcademyFinanceSettingsView> {
  if (!isAcademyPercentage(input.academyPercentage)) {
    throw new FinanceValidationError(
      `academyPercentage must be one of 20, 30, 40, 50 (got ${input.academyPercentage}).`,
    );
  }
  const updated = await store.upsertFinanceSettings({
    academyPercentage: input.academyPercentage,
    updatedByUserId: input.updatedByUserId,
  });
  return toView(updated);
}

export async function requireFinanceSettings(
  store: FinanceStore,
): Promise<AcademyFinanceSettingsRecord> {
  const view = await getOrCreateFinanceSettings(store);
  const row = await store.getFinanceSettings();
  if (!row) {
    throw new FinanceNotFoundError('Finance settings missing after upsert.');
  }
  if (row.academyPercentage !== view.academyPercentage) {
    throw new FinanceNotFoundError('Finance settings inconsistent.');
  }
  return row;
}
