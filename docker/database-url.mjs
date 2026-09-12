// Assembles a PostgreSQL connection URL from discrete parameters.
//
// Why this exists: building the URL by string interpolation in Compose is
// unsafe. A password containing "/" makes the URL unparseable, and one
// containing "+", "=" or "@" parses into the *wrong* host or credentials
// silently — which is worse. Percent-encoding each component removes the whole
// class of failure, so any generated password is safe.
//
// Prints the URL on stdout. It contains a secret, so the caller must capture it
// rather than log it.

const REQUIRED = ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(
    `[database-url] cannot build DATABASE_URL, missing: ${missing.join(', ')}`,
  );
  process.exit(1);
}

const host = process.env.POSTGRES_HOST || 'db';
const port = process.env.POSTGRES_PORT || '5432';
const schema = process.env.POSTGRES_SCHEMA || 'public';

if (!/^[0-9]+$/.test(port)) {
  console.error(`[database-url] POSTGRES_PORT must be numeric, got "${port}"`);
  process.exit(1);
}

const encode = encodeURIComponent;

const url =
  `postgresql://${encode(process.env.POSTGRES_USER)}` +
  `:${encode(process.env.POSTGRES_PASSWORD)}` +
  `@${host}:${port}` +
  `/${encode(process.env.POSTGRES_DB)}` +
  `?schema=${encode(schema)}`;

process.stdout.write(url);
