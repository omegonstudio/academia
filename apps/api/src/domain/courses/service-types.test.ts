import { describe, expect, it } from 'vitest';
import {
  COURSE_SERVICE_DURATION_MINUTES,
  COURSE_SERVICE_TYPES,
  COURSE_TYPES,
  courseServiceTypeSchema,
  courseTypeSchema,
  createCourseRequestSchema,
  durationMinutesForServiceType,
} from '@academia/shared';

describe('course service types', () => {
  it('maps each service type to its fixed duration', () => {
    expect(durationMinutesForServiceType('ONE_TO_ONE_60')).toBe(60);
    expect(durationMinutesForServiceType('ONE_TO_ONE_90')).toBe(90);
    expect(durationMinutesForServiceType('GROUP_120')).toBe(120);
    expect(COURSE_SERVICE_DURATION_MINUTES.ONE_TO_ONE_60).toBe(60);
    expect(COURSE_SERVICE_TYPES).toEqual([
      'ONE_TO_ONE_60',
      'ONE_TO_ONE_90',
      'GROUP_120',
    ]);
  });

  it('rejects invalid service types at the shared schema boundary', () => {
    expect(courseServiceTypeSchema.safeParse('ONE_TO_ONE_30').success).toBe(
      false,
    );
    expect(courseServiceTypeSchema.safeParse('GROUP_60').success).toBe(false);
    expect(courseServiceTypeSchema.safeParse(75).success).toBe(false);
    expect(courseServiceTypeSchema.safeParse('ONE_TO_ONE_60').success).toBe(
      true,
    );

    expect(
      createCourseRequestSchema.safeParse({
        name: 'X',
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_120',
      }).success,
    ).toBe(false);
    expect(
      createCourseRequestSchema.safeParse({
        name: 'X',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      }).success,
    ).toBe(true);
  });
});

describe('course types', () => {
  it('accepts REGULAR and TEACHER_TRAINING only', () => {
    expect(COURSE_TYPES).toEqual(['REGULAR', 'TEACHER_TRAINING']);
    expect(courseTypeSchema.safeParse('REGULAR').success).toBe(true);
    expect(courseTypeSchema.safeParse('TEACHER_TRAINING').success).toBe(true);
    expect(courseTypeSchema.safeParse('UNKNOWN').success).toBe(false);
    expect(courseTypeSchema.safeParse('teacher_training').success).toBe(false);
  });

  it('keeps courseType orthogonal to serviceType duration', () => {
    const parsed = createCourseRequestSchema.safeParse({
      name: 'Formación',
      courseType: 'TEACHER_TRAINING',
      serviceType: 'GROUP_120',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(durationMinutesForServiceType(parsed.data.serviceType)).toBe(120);
    }

    expect(
      createCourseRequestSchema.safeParse({
        name: 'X',
        courseType: 'UNKNOWN',
        serviceType: 'GROUP_120',
      }).success,
    ).toBe(false);
  });
});
