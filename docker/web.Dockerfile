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

# Next.js serializes rewrite destinations and inlines NEXT_PUBLIC_* into the
# build output. Setting either only at runtime leaves production serving
# localhost canonicals / sitemap and proxying /api to its own localhost.
#
# Defaults match the Compose topology (service name `api`) and local SEO.
# Pointing elsewhere requires rebuilding the image. See docs/INFRASTRUCTURE.md.
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

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

# Same source as the build stage: getSession() reads API_INTERNAL_URL at
# runtime, while rewrites were baked above. Re-declare ARG so a single
# --build-arg keeps both uses aligned when Compose does not override env.
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=${API_INTERNAL_URL}

WORKDIR /app

# outputFileTracingRoot is the repo root, so the standalone bundle keeps the
# workspace layout: the server entrypoint lands at apps/web/server.js.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

USER node

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
