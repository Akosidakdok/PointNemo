export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly retryable = [408, 425, 429, 502, 503, 504].includes(statusCode),
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(code: string, message: string) {
    super(503, code, message);
    this.name = "ServiceUnavailableError";
  }
}

export class BadRequestError extends ApiError {
  constructor(code: string, message: string) {
    super(400, code, message);
    this.name = "BadRequestError";
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

export class PayloadTooLargeError extends ApiError {
  constructor(code: string, message: string) {
    super(413, code, message);
    this.name = "PayloadTooLargeError";
  }
}
