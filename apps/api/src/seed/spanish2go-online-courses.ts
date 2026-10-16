/**
 * Idempotent import of Spanish2Go course structure into the async LMS.
 *
 * Source of truth:
 *   `_research_out/spanish2go_migration/*.json`
 *
 * Imports only titles, order, marketing copy and relationships present in the
 * JSON. Does not invent video/PDF URLs. Does not publish courses (DRAFT).
 * Does not overwrite existing READY/uploaded lesson assets.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isFinanceCurrency,
  type FinanceCurrency,
} from '@academia/shared';
import { logger } from '../lib/logger.js';
import type { Database } from '../lib/prisma.js';

const RESEARCH_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../_research_out/spanish2go_migration',
);

const COURSE_FILES = [
  'curso_taller_calentamientos.json',
  'curso_mis_4_amigos_del_pasado.json',
] as const;

type JsonAsset = {
  type?: string;
  title?: string;
  sourceUrl?: string | null;
  availability?: string;
  notes?: string;
};

type JsonLesson = {
  title: string;
  position: number;
  contentType?: string | null;
  description?: string | null;
  estimatedMinutes?: number | null;
  assets?: JsonAsset[];
};

type JsonModule = {
  title: string;
  position: number;
  description?: string | null;
  lessons: JsonLesson[];
};

type JsonCourseFile = {
  course: {
    title: string;
    slug: string;
    author?: string | null;
    subtitle?: string | null;
    description?: string | null;
    price?: number | null;
    currency?: string | null;
    benefits?: string[];
    bonus?: string[];
  };
  modules: JsonModule[];
};

export type Spanish2GoSeedSummary = {
  researchDir: string;
  courses: Array<{
    slug: string;
    title: string;
    courseOutcome: 'created' | 'updated';
    modulesUpserted: number;
    lessonsUpserted: number;
    pendingAssets: number;
    skippedExistingAssets: number;
    commercialPriceNote: string | null;
    authorNote: string | null;
  }>;
};

function loadCourseFile(filename: string): JsonCourseFile {
  const fullPath = path.join(RESEARCH_DIR, filename);
  const raw = JSON.parse(readFileSync(fullPath, 'utf8')) as JsonCourseFile;
  if (!raw.course?.title || !raw.course?.slug || !Array.isArray(raw.modules)) {
    throw new Error(`Invalid Spanish2Go course file: ${filename}`);
  }
  return raw;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max);
}

function acceptsSubmissionFor(contentType: string | null | undefined): boolean {
  return contentType === 'entrega' || contentType === 'valoracion';
}

function countPendingAssets(modules: JsonModule[]): number {
  let count = 0;
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      for (const asset of lesson.assets ?? []) {
        if (!asset.sourceUrl) count += 1;
      }
    }
  }
  return count;
}

/** Major-unit number → integer minor units (2 decimal places). */
function priceMajorToAmountMinor(price: number): bigint | null {
  if (!Number.isFinite(price) || price < 0) return null;
  return BigInt(Math.round(price * 100));
}

function resolveJsonListPrice(course: JsonCourseFile['course']): {
  amountMinor: bigint | null;
  currency: FinanceCurrency | null;
  note: string | null;
} {
  if (
    course.price === null ||
    course.price === undefined ||
    !course.currency
  ) {
    return { amountMinor: null, currency: null, note: null };
  }
  if (!isFinanceCurrency(course.currency)) {
    return {
      amountMinor: null,
      currency: null,
      note: `JSON price ${course.price} ${course.currency} not stored: unsupported FinanceCurrency.`,
    };
  }
  const amountMinor = priceMajorToAmountMinor(course.price);
  if (amountMinor === null) {
    return {
      amountMinor: null,
      currency: null,
      note: `JSON price ${course.price} ${course.currency} not stored: invalid amount.`,
    };
  }
  return { amountMinor, currency: course.currency, note: null };
}

async function upsertCourseStructure(
  database: Database,
  data: JsonCourseFile,
): Promise<Spanish2GoSeedSummary['courses'][number]> {
  const { course, modules } = data;
  const slug = course.slug.trim();
  const title = truncate(course.title.trim(), 200);
  const subtitle = course.subtitle
    ? truncate(course.subtitle.trim(), 300)
    : null;
  const description = course.description
    ? truncate(course.description.trim(), 10000)
    : null;
  const benefits = course.benefits ?? [];
  const bonus = course.bonus ?? [];

  const listPrice = resolveJsonListPrice(course);
  const commercialPriceNote = listPrice.note;
  const authorNote = course.author
    ? `Author "${course.author}" not linked: OnlineCourse.authorTeacherId requires a Teacher row (no free-text author field).`
    : null;

  const existing = await database.onlineCourse.findUnique({
    where: { slug },
  });

  let courseId: string;
  let courseOutcome: 'created' | 'updated';

  if (existing) {
    courseId = existing.id;
    courseOutcome = 'updated';
    await database.onlineCourse.update({
      where: { id: courseId },
      data: {
        title,
        subtitle,
        description,
        benefits,
        bonus,
        isActive: true,
        // Never force-publish. Never wipe a price an admin may have set later.
        // Never clear coverImageUrl.
      },
    });
  } else {
    const created = await database.onlineCourse.create({
      data: {
        title,
        slug,
        subtitle,
        description,
        benefits,
        bonus,
        status: 'DRAFT',
        accessMode: 'OPEN',
        certificateEnabled: false,
        amountMinor: listPrice.amountMinor,
        currency: listPrice.currency,
        authorTeacherId: null,
        coverImageUrl: null,
        isActive: true,
      },
    });
    courseId = created.id;
    courseOutcome = 'created';
  }

  let modulesUpserted = 0;
  let lessonsUpserted = 0;
  let skippedExistingAssets = 0;

  const sortedModules = [...modules].sort((a, b) => a.position - b.position);

  for (const mod of sortedModules) {
    const moduleTitle = truncate(mod.title.trim(), 200);
    const moduleDescription = mod.description
      ? truncate(mod.description.trim(), 2000)
      : null;
    const modulePosition = mod.position;

    const existingModules = await database.onlineCourseModule.findMany({
      where: { onlineCourseId: courseId, position: modulePosition },
      orderBy: { createdAt: 'asc' },
    });

    let moduleId: string;
    if (existingModules[0]) {
      moduleId = existingModules[0].id;
      await database.onlineCourseModule.update({
        where: { id: moduleId },
        data: {
          title: moduleTitle,
          description: moduleDescription,
          position: modulePosition,
          isActive: true,
        },
      });
      // Soft-deactivate accidental duplicates at the same position.
      for (const dup of existingModules.slice(1)) {
        await database.onlineCourseModule.update({
          where: { id: dup.id },
          data: { isActive: false },
        });
      }
    } else {
      const created = await database.onlineCourseModule.create({
        data: {
          onlineCourseId: courseId,
          title: moduleTitle,
          description: moduleDescription,
          position: modulePosition,
          isActive: true,
        },
      });
      moduleId = created.id;
    }
    modulesUpserted += 1;

    const sortedLessons = [...mod.lessons].sort(
      (a, b) => a.position - b.position,
    );

    for (const lesson of sortedLessons) {
      const lessonTitle = truncate(lesson.title.trim(), 200);
      const lessonDescription = lesson.description
        ? truncate(lesson.description.trim(), 2000)
        : null;
      const lessonPosition = lesson.position;
      const estimatedMinutes =
        typeof lesson.estimatedMinutes === 'number' &&
        Number.isFinite(lesson.estimatedMinutes) &&
        lesson.estimatedMinutes > 0
          ? Math.trunc(lesson.estimatedMinutes)
          : null;

      const existingLessons = await database.onlineLesson.findMany({
        where: { moduleId, position: lessonPosition },
        orderBy: { createdAt: 'asc' },
      });

      let lessonId: string;
      if (existingLessons[0]) {
        lessonId = existingLessons[0].id;
        await database.onlineLesson.update({
          where: { id: lessonId },
          data: {
            title: lessonTitle,
            description: lessonDescription,
            position: lessonPosition,
            estimatedMinutes,
            acceptsSubmission: acceptsSubmissionFor(lesson.contentType),
            isActive: true,
            // Keep existing lesson status (DRAFT/PUBLISHED) — do not auto-publish.
          },
        });
        for (const dup of existingLessons.slice(1)) {
          await database.onlineLesson.update({
            where: { id: dup.id },
            data: { isActive: false },
          });
        }
      } else {
        const created = await database.onlineLesson.create({
          data: {
            moduleId,
            title: lessonTitle,
            description: lessonDescription,
            position: lessonPosition,
            estimatedMinutes,
            isRequired: true,
            status: 'DRAFT',
            acceptsSubmission: acceptsSubmissionFor(lesson.contentType),
            isActive: true,
          },
        });
        lessonId = created.id;
      }
      lessonsUpserted += 1;

      // Assets without a real sourceUrl are pending — never invent URLs.
      // If the lesson already has any active assets (admin-uploaded), leave them.
      const existingAssetCount = await database.onlineLessonAsset.count({
        where: { lessonId, isActive: true },
      });
      if (existingAssetCount > 0) {
        skippedExistingAssets += existingAssetCount;
      }
    }
  }

  return {
    slug,
    title,
    courseOutcome,
    modulesUpserted,
    lessonsUpserted,
    pendingAssets: countPendingAssets(modules),
    skippedExistingAssets,
    commercialPriceNote,
    authorNote,
  };
}

/**
 * Import both Spanish2Go courses from research JSON. Safe to re-run.
 */
export async function seedSpanish2GoOnlineCourses(
  database: Database,
): Promise<Spanish2GoSeedSummary> {
  const summary: Spanish2GoSeedSummary = {
    researchDir: RESEARCH_DIR,
    courses: [],
  };

  for (const filename of COURSE_FILES) {
    const data = loadCourseFile(filename);
    const result = await upsertCourseStructure(database, data);
    summary.courses.push(result);
    logger.info(
      {
        slug: result.slug,
        outcome: result.courseOutcome,
        modules: result.modulesUpserted,
        lessons: result.lessonsUpserted,
        pendingAssets: result.pendingAssets,
      },
      'Spanish2Go online course seeded',
    );
  }

  return summary;
}

export function resolveSpanish2GoResearchDir(): string {
  return RESEARCH_DIR;
}
