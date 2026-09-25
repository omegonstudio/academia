export class FinanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinanceValidationError';
  }
}

export class FinanceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinanceNotFoundError';
  }
}

export class FinanceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinanceConflictError';
  }
}

export class FinanceInvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinanceInvalidTransitionError';
  }
}
