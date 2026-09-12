# Production image for the API.
#
# Debian slim rather than Alpine: the Prisma CLI expects glibc/OpenSSL, and the
# musl variants have historically needed extra binary targets for no benefit here.

# ---------------------------------------------------------------------------
# Stage 1 — install the full dependency tree (dev included, needed to compile)
# ---------------------------------------------------------------------------
FROM node:22-slim AS deps

WORKDIR /app

# Only manifests are copied first, so the install layer is reused whenever
# sources change but dependencies do not.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2 — compile the shared contracts and the API
# ---------------------------------------------------------------------------
FROM deps AS build

WORKDIR /app

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# `build` runs `prisma generate` first: the generated client is TypeScript under
# src/, so it is compiled into dist/ along with the rest.
RUN npm run build -w @academia/shared \
    && npm run build -w @academia/api

# ---------------------------------------------------------------------------
# Stage 3 — runtime
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime

# openssl is required by the Prisma CLI that applies migrations at startup.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Production dependencies only. The Prisma CLI and dotenv are runtime
# dependencies on purpose: the entrypoint applies migrations.
RUN npm ci --omit=dev --workspace @academia/api --include-workspace-root \
    && npm cache clean --force

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma7.config.ts ./apps/api/prisma7.config.ts

COPY docker/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
COPY docker/database-url.mjs /usr/local/lib/academia/database-url.mjs
RUN chmod +x /usr/local/bin/api-entrypoint.sh

# Run unprivileged. `node` (uid 1000) ships with the base image.
USER node

EXPOSE 4000

ENTRYPOINT ["/usr/local/bin/api-entrypoint.sh"]
# Absolute path: the entrypoint changes directory to apps/api so the Prisma CLI
# finds prisma7.config.ts, so a relative path here would resolve twice.
CMD ["node", "/app/apps/api/dist/server.js"]
