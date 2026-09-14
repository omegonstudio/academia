import type { Env } from '../../config/env.js';
import { getEnv } from '../../config/env.js';

/**
 * Academy business settings sourced from configuration (env today).
 * Class-generation / scheduling must read timezone from here — never hardcode it.
 */
export interface AcademyBusinessConfig {
  /** IANA timezone used as local civil time for ScheduleOption planning. */
  businessTimezone: string;
}

export function getAcademyBusinessConfig(
  env: Env = getEnv(),
): AcademyBusinessConfig {
  return {
    businessTimezone: env.ACADEMY_TIMEZONE,
  };
}
