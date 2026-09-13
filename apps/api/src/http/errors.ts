/**
 * Every failure leaves the API in one shape: `{ error: { code, message } }`.
 * `code` is stable and safe for clients to branch on; `message` is for humans.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'The request payload is invalid.') {
    super(400, 'BAD_REQUEST', message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Authentication is required.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'You are not allowed to perform this action.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource not found.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'The resource conflicts with the current state.') {
    super(409, 'CONFLICT', message);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = 'Too many attempts. Try again later.') {
    super(429, 'TOO_MANY_REQUESTS', message);
  }
}
