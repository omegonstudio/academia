/**
 * CLI: import Spanish2Go course structure into the async LMS.
 *
 *   npm run db:seed:spanish2go -w @academia/api
 */
import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { createPrismaClient } from '../lib/prisma.js';
import {
  resolveSpanish2GoResearchDir,
  seedSpanish2GoOnlineCourses,
} from './spanish2go-online-courses.js';

// Load monorepo root `.env` when running outside Docker.
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../',
);
loadDotenv({ path: path.join(repoRoot, '.env') });

async function main(): Promise<void> {
  const researchDir = resolveSpanish2GoResearchDir();
  logger.info({ researchDir }, 'Spanish2Go seed starting');

  const env = parseEnv();
  const database = createPrismaClient(env.DATABASE_URL);

  try {
    const summary = await seedSpanish2GoOnlineCourses(database);

    for (const course of summary.courses) {
      logger.info(
        {
          slug: course.slug,
          title: course.title,
          outcome: course.courseOutcome,
          modules: course.modulesUpserted,
          lessons: course.lessonsUpserted,
          pendingAssets: course.pendingAssets,
          skippedExistingAssets: course.skippedExistingAssets,
          commercialPriceNote: course.commercialPriceNote,
          authorNote: course.authorNote,
        },
        'Spanish2Go course import result',
      );
    }

    // eslint-disable-next-line no-console -- operator-facing seed summary
    console.log(
      JSON.stringify(
        {
          ok: true,
          researchDir: summary.researchDir,
          courses: summary.courses.map((c) => ({
            slug: c.slug,
            title: c.title,
            outcome: c.courseOutcome,
            modules: c.modulesUpserted,
            lessons: c.lessonsUpserted,
            pendingAssets: c.pendingAssets,
            skippedExistingAssets: c.skippedExistingAssets,
            notes: [c.commercialPriceNote, c.authorNote].filter(Boolean),
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await database.$disconnect();
  }
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Spanish2Go seed failed');
  process.exit(1);
});
