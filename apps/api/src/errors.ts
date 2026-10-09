export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class BadRequestError extends ApiError {
  constructor(code: string, message: string) {
    super(400, code, message);
    this.name = "BadRequestError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, code: string = "VALIDATION_ERROR") {
    super(400, code, message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(code: string, message: string) {
    super(404, code, message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(code: string, message: string) {
    super(409, code, message);
    this.name = "ConflictError";
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(code: string, message: string) {
    super(503, code, message);
    this.name = "ServiceUnavailableError";
  }
}

export class BusyError extends ApiError {
  constructor(code: string, message: string) {
    super(503, code, message);
    this.name = "BusyError";
  }
}
