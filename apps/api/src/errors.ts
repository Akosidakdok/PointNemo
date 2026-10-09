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

export class ServiceUnavailableError extends ApiError {
  constructor(code: string, message: string) {
    super(503, code, message);
    this.name = "ServiceUnavailableError";
  }
}
