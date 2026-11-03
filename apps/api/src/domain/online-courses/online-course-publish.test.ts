import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { grantAccess } from './online-access-service.js';
import { createInMemoryOnlineCourseStore } from './in-memory-online-course-store.js';
import {
  assertOnlineCourseReadyToPublish,
  evaluateOnlineCoursePublishReadiness,
} from './online-course-publish.js';
import {
  createOnlineCourse,
  createOnlineCourseModule,
  createOnlineLesson,
  createOnlineLessonAsset,
  OnlineCourseValidationError,
  publishOnlineCourse,
  updateOnlineCourse,
} from './online-course-service.js';
import { upsertQuiz } from './online-quiz-service.js';

describe('online course publish readiness', () => {
  const store = createInMemoryOnlineCourseStore();

  beforeEach(() => {
    store.clear();
  });

  async function baseDraft(options?: {
    accessMode?: 'OPEN' | 'LINEAR';
    withDescription?: boolean;
    slug?: string;
  }) {
    return createOnlineCourse(store, {
      title: 'Curso listo',
      slug: options?.slug ?? `curso-${randomUUID().slice(0, 8)}`,
      ...(options?.withDescription === false
        ? {}
        : { description: 'Descripción mínima válida.' }),
      accessMode: options?.accessMode ?? 'OPEN',
    });
  }

  it('rejects an empty course (no modules)', async () => {
    const course = await baseDraft({ slug: 'empty-course' });
    const issues = await evaluateOnlineCoursePublishReadiness(
      store,
      course.id,
    );
    expect(issues.map((i) => i.code)).toContain('MODULES_REQUIRED');
    await expect(publishOnlineCourse(store, course.id)).rejects.toBeInstanceOf(
      OnlineCourseValidationError,
    );
    const after = await store.findById(course.id);
    expect(after?.status).toBe('DRAFT');
  });

  it('rejects a course with a module but no lessons', async () => {
    const course = await baseDraft({ slug: 'module-only' });
    await createOnlineCourseModule(store, course.id, { title: 'Módulo 1' });
    const issues = await evaluateOnlineCoursePublishReadiness(
      store,
      course.id,
    );
    expect(issues.map((i) => i.code)).toContain('PUBLISHABLE_LESSON_REQUIRED');
    await expect(
      assertOnlineCourseReadyToPublish(store, course.id),
    ).rejects.toThrow(/lección publicada/i);
    const after = await store.findById(course.id);
    expect(after?.status).toBe('DRAFT');
  });

  it('rejects a published lesson without teachable content', async () => {
    const course = await baseDraft({ slug: 'lesson-empty' });
    const mod = await createOnlineCourseModule(store, course.id, {
      title: 'Módulo 1',
    });
    await createOnlineLesson(store, mod.id, {
      title: 'Lección vacía',
      status: 'PUBLISHED',
    });
    const issues = await evaluateOnlineCoursePublishReadiness(
      store,
      course.id,
    );
    expect(issues.map((i) => i.code)).toContain('LESSON_CONTENT_REQUIRED');
    await expect(publishOnlineCourse(store, course.id)).rejects.toBeInstanceOf(
      OnlineCourseValidationError,
    );
    expect((await store.findById(course.id))?.status).toBe('DRAFT');
  });

  it('allows a published lesson that only accepts submissions', async () => {
    const course = await baseDraft({ slug: 'lesson-submit' });
    const mod = await createOnlineCourseModule(store, course.id, {
      title: 'Módulo 1',
    });
    await createOnlineLesson(store, mod.id, {
      title: 'Entrega',
      status: 'PUBLISHED',
      acceptsSubmission: true,
    });
    await expect(publishOnlineCourse(store, course.id)).resolves.toMatchObject({
      status: 'PUBLISHED',
    });
  });

  it('allows a published lesson with quiz only', async () => {
    const course = await baseDraft({ slug: 'lesson-quiz' });
    const mod = await createOnlineCourseModule(store, course.id, {
      title: 'Módulo 1',
    });
    const lesson = await createOnlineLesson(store, mod.id, {
      title: 'Quiz lesson',
      status: 'PUBLISHED',
    });
    await upsertQuiz(store, lesson.id, {
      title: 'Check',
      questions: [
        {
          prompt: '¿2+2?',
          type: 'SINGLE_CHOICE',
          options: [
            { label: '4', isCorrect: true },
            { label: '5', isCorrect: false },
          ],
        },
      ],
    });
    await expect(publishOnlineCourse(store, course.id)).resolves.toMatchObject({
      status: 'PUBLISHED',
    });
  });

  it('publishes a valid FREE OPEN course with TEXT content', async () => {
    const course = await baseDraft({
      slug: 'valid-free',
      accessMode: 'OPEN',
    });
    const mod = await createOnlineCourseModule(store, course.id, {
      title: 'Módulo 1',
    });
    const lesson = await createOnlineLesson(store, mod.id, {
      title: 'Lección 1',
      status: 'PUBLISHED',
    });
    await createOnlineLessonAsset(store, lesson.id, 'user-1', {
      kind: 'TEXT',
      title: 'Texto',
      bodyText: 'Contenido',
    });
    const published = await publishOnlineCourse(store, course.id);
    expect(published.status).toBe('PUBLISHED');
    expect(published.amountMinor).toBeNull();
  });

  it('publishes a valid LINEAR course', async () => {
    const course = await baseDraft({
      slug: 'valid-linear',
      accessMode: 'LINEAR',
    });
    const mod = await createOnlineCourseModule(store, course.id, {
      title: 'Módulo 1',
    });
    const lesson = await createOnlineLesson(store, mod.id, {
      title: 'Lección 1',
      status: 'PUBLISHED',
      isRequired: true,
    });
    await createOnlineLessonAsset(store, lesson.id, 'user-1', {
      kind: 'TEXT',
      title: 'Texto',
      bodyText: 'Contenido linear',
    });
    await expect(publishOnlineCourse(store, course.id)).resolves.toMatchObject({
      status: 'PUBLISHED',
      accessMode: 'LINEAR',
    });
  });

  it('does not change status when publish fails', async () => {
    const course = await baseDraft({
      slug: 'fail-atomic',
      withDescription: false,
    });
    await expect(publishOnlineCourse(store, course.id)).rejects.toThrow(
      /descripción válida/i,
    );
    expect((await store.findById(course.id))?.status).toBe('DRAFT');
  });

  it('publishes a course that already has student access without altering enrollments', async () => {
    const course = await baseDraft({ slug: 'with-students' });
    const mod = await createOnlineCourseModule(store, course.id, {
      title: 'Módulo 1',
    });
    const lesson = await createOnlineLesson(store, mod.id, {
      title: 'Lección 1',
      status: 'PUBLISHED',
    });
    await createOnlineLessonAsset(store, lesson.id, 'user-1', {
      kind: 'TEXT',
      title: 'Texto',
      bodyText: 'OK',
    });

    const access = await grantAccess(store, {
      onlineCourseId: course.id,
      studentId: 'student-1',
      grantedByUserId: 'director-1',
    });
    expect(access.isActive).toBe(true);

    const published = await publishOnlineCourse(store, course.id);
    expect(published.status).toBe('PUBLISHED');

    const still = await store.findAccess(course.id, 'student-1');
    expect(still?.isActive).toBe(true);
    expect(still?.id).toBe(access.id);
  });

  it('blocks PATCH status=PUBLISHED with the same readiness rules', async () => {
    const course = await baseDraft({ slug: 'patch-bypass' });
    await expect(
      updateOnlineCourse(store, course.id, { status: 'PUBLISHED' }),
    ).rejects.toBeInstanceOf(OnlineCourseValidationError);
    expect((await store.findById(course.id))?.status).toBe('DRAFT');
  });

  it('flags invalid active assets on published lessons', async () => {
    const course = await baseDraft({ slug: 'bad-asset' });
    const mod = await createOnlineCourseModule(store, course.id, {
      title: 'Módulo 1',
    });
    const lesson = await createOnlineLesson(store, mod.id, {
      title: 'Lección 1',
      status: 'PUBLISHED',
      acceptsSubmission: true,
    });
    // Bypass createOnlineLessonAsset validation by writing directly to memory.
    const now = new Date();
    store.assets.set('asset-pending', {
      id: 'asset-pending',
      lessonId: lesson.id,
      kind: 'DOCUMENT',
      title: 'PDF pendiente',
      position: 0,
      bodyText: null,
      externalUrl: null,
      uploadStatus: 'PENDING',
      mimeType: 'application/pdf',
      sizeBytes: null,
      storageKey: null,
      originalFilename: 'x.pdf',
      createdByUserId: 'user-1',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const issues = await evaluateOnlineCoursePublishReadiness(
      store,
      course.id,
    );
    expect(issues.map((i) => i.code)).toContain('ASSET_INVALID');
    await expect(publishOnlineCourse(store, course.id)).rejects.toThrow(
      /recurso asociado no está disponible/i,
    );
    expect((await store.findById(course.id))?.status).toBe('DRAFT');
  });
});
