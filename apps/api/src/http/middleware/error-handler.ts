import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { HttpError, NotFoundError } from '../errors.js';

export function notFoundHandler(): RequestHandler {
  return (_req, _res, next) => {
    next(new NotFoundError('Unknown endpoint.'));
  };
}

/**
 * Terminal error handler.
 *
 * Known `HttpError`s are reported verbatim. Anything else is logged in full and
 * answered with a generic 500, so an unexpected stack trace or driver message
 * never reaches a client.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, _next) => {
    if (error instanceof HttpError) {
      if (error.status >= 500) {
        logger.error({ err: error, path: req.path }, 'Request failed');
      }

      res.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }

    logger.error({ err: error, path: req.path }, 'Unhandled request error');

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  };
}
