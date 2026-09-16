import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from '../openapi/document.js';

const SWAGGER_UI_OPTIONS = {
  customSiteTitle: 'Academia API docs',
  swaggerOptions: {
    withCredentials: true,
    persistAuthorization: true,
    displayRequestDuration: true,
    defaultModelsExpandDepth: 1,
  },
} as const;

/**
 * OpenAPI JSON + Swagger UI.
 *
 * Mounted only when docs are enabled (`API_DOCS_ENABLED` / non-production default).
 *
 * Cookie auth: Swagger is served on the same origin as the web app when reached
 * via `/api/docs`. After `POST /auth/login` (Try it out or `/login`), the
 * HttpOnly `academia_session` cookie is sent automatically on subsequent
 * same-origin requests (`withCredentials`). No Bearer token is introduced.
 *
 * Trailing slash: Swagger's HTML uses relative asset URLs (`./swagger-ui.css`).
 * Behind the Next `/api/*` rewrite the browser URL must end with `/` or those
 * assets resolve to `/api/swagger-ui.css` (404). We serve HTML at both `/docs`
 * and `/docs/` and inject a one-line client redirect that adds the slash when
 * missing — no absolute `Location: /docs/` header (that escapes the `/api` prefix).
 */
export function createDocsRouter(): Router {
  const router = createRouter();
  const document = buildOpenApiDocument();

  router.get('/openapi.json', (_req, res) => {
    res.status(200).json(document);
  });

  const html = swaggerUi
    .generateHTML(document, SWAGGER_UI_OPTIONS)
    .replace(
      '<head>',
      `<head>
  <script>
    if (!location.pathname.endsWith('/')) {
      location.replace(location.pathname + '/' + location.search + location.hash);
    }
  </script>`,
    );

  // Static assets without express.static's absolute `/docs/` redirect.
  router.use('/docs', ...swaggerUi.serveWithOptions({ redirect: false, index: false }));

  const sendUi = (_req: Request, res: Response): void => {
    res.type('html').send(html);
  };

  router.get('/docs', sendUi);
  router.get('/docs/', sendUi);

  return router;
}
