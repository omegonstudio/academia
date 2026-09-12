# Development image for the API.
#
# Sources are bind-mounted by docker-compose.dev.yml, so this image only needs
# the dependency tree and the toolchain. node_modules is kept inside the image
# and shadowed by an anonymous volume, which keeps host and container installs
# from fighting over native artefacts.
FROM node:22-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=development

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN npm ci

COPY docker/api-dev-entrypoint.sh /usr/local/bin/api-dev-entrypoint.sh
COPY docker/database-url.mjs /usr/local/lib/academia/database-url.mjs
RUN chmod +x /usr/local/bin/api-dev-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/usr/local/bin/api-dev-entrypoint.sh"]
CMD ["npm", "run", "dev", "-w", "@academia/api"]
