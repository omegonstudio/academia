# Development image for the Next.js frontend.
# Sources are bind-mounted by docker-compose.dev.yml.
FROM node:22-slim

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN npm ci

COPY docker/web-dev-entrypoint.sh /usr/local/bin/web-dev-entrypoint.sh
RUN chmod +x /usr/local/bin/web-dev-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/web-dev-entrypoint.sh"]
CMD ["npm", "run", "dev", "-w", "@academia/web"]
