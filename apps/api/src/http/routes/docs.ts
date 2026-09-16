import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from '../openapi/document.js';

/**
 * OpenAPI JSON + Swagger UI.
 *
 * Mounted only when docs are enabled (`API_DOCS_ENABLED` / non-production default).
 *
 * Cookie auth: Swagger is served on the same origin as the web app when reached
 * via `/api/docs`. After `POST /auth/login` (Try it out or `/login`), the
 * HttpOnly `academia_session` cookie is sent automatically on subsequent
 * same-origin requests (`withCredentials`). No Bearer token is introduced.
 */
export function createDocsRouter(): Router {
  const router = Router();
  const document = buildOpenApiDocument();

  router.get('/openapi.json', (_req, res) => {
    res.status(200).json(document);
  });

  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: 'Academia API docs',
      swaggerOptions: {
        withCredentials: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        // Prefer the rewrite server so Try it out keeps the session cookie.
        defaultModelsExpandDepth: 1,
      },
    }),
  );

  return router;
}
