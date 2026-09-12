// Prisma 7 moved datasource configuration out of schema.prisma.
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// The CLI runs with apps/api as its working directory, but .env lives at the
// repository root. dotenv never overwrites an existing variable, so inside
// Docker (where the environment is already populated and no .env exists) this
// call is a harmless no-op.
loadDotenv({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

const url = process.env['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // `prisma generate` needs no connection, so the datasource is omitted when
  // DATABASE_URL is absent instead of failing. That keeps the Docker build stage
  // and CI's codegen step free of any secret. Commands that do need a
  // connection (`migrate dev`, `migrate deploy`) still fail explicitly, naming
  // the missing property.
  ...(url ? { datasource: { url } } : {}),
});
