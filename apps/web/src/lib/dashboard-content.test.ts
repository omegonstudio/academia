import { ROLES } from '@academia/shared';
import { describe, expect, it } from 'vitest';
import { dashboardContentForRole } from './dashboard-content.js';

describe('dashboardContentForRole', () => {
  it('returns distinct content for every role', () => {
    const headings = new Set(
      ROLES.map((role) => dashboardContentForRole(role).heading),
    );
    const summaries = new Set(
      ROLES.map((role) => dashboardContentForRole(role).summary),
    );

    expect(headings.size).toBe(ROLES.length);
    expect(summaries.size).toBe(ROLES.length);
  });

  it.each(ROLES)('defines non-empty copy for %s', (role) => {
    const content = dashboardContentForRole(role);

    expect(content.heading.length).toBeGreaterThan(0);
    expect(content.summary.length).toBeGreaterThan(0);
    expect(content.points.length).toBeGreaterThan(0);
    for (const point of content.points) {
      expect(point.length).toBeGreaterThan(0);
    }
  });

  it('frames SUPER_ADMIN as technical control', () => {
    const content = dashboardContentForRole('SUPER_ADMIN');
    expect(content.heading.toLowerCase()).toContain('técnico');
  });

  it('frames DIRECTOR as academy direction', () => {
    const content = dashboardContentForRole('DIRECTOR');
    expect(content.heading.toLowerCase()).toContain('academia');
  });

  it('mentions Director-controlled permissions for ADMINISTRATIVE', () => {
    const content = dashboardContentForRole('ADMINISTRATIVE');
    expect(content.summary.toLowerCase()).toMatch(/permisos|dirección/);
  });

  it('keeps TEACHER from claiming student assignment', () => {
    const content = dashboardContentForRole('TEACHER');
    expect(content.points.join(' ').toLowerCase()).toMatch(
      /no podés aprovisionar|no puedes aprovisionar|asign/,
    );
  });

  it('scopes STUDENT to own learner space', () => {
    const content = dashboardContentForRole('STUDENT');
    expect(content.heading.toLowerCase()).toContain('estudiante');
  });
});
