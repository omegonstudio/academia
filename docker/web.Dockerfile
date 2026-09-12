# Production image for the Next.js frontend.
#
# Uses `output: 'standalone'`, so the runtime stage carries a self-contained
# server plus only the traced dependencies instead of the whole node_modules.

# ---------------------------------------------------------------------------
# Stage 1 — install
# ---------------------------------------------------------------------------
FROM node:22-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2 — build
# ---------------------------------------------------------------------------
FROM deps AS build

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Next.js serializes rewrite destinations into the build output, so the API
# address must be present at BUILD time — setting it only at runtime leaves the
# standalone server proxying /api to its own localhost.
#
# The default is the Compose service name, which is stable across environments
# because both stacks name the service `api`. Point the API somewhere else and
# this image needs rebuilding, or a reverse proxy in front. See
# docs/INFRASTRUCTURE.md.
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=${API_INTERNAL_URL}

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm run build -w @academia/shared \
    && npm run build -w @academia/web

# ---------------------------------------------------------------------------
# Stage 3 — runtime
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# The standalone server binds to $HOSTNAME, which Docker sets to the container
# ID. That resolves to a single interface, so loopback probes fail and the
# container never reports healthy. Binding all interfaces fixes both.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

WORKDIR /app

# outputFileTracingRoot is the repo root, so the standalone bundle keeps the
# workspace layout: the server entrypoint lands at apps/web/server.js.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

USER node

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
