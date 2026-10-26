export interface ErrorDetail {
  field: string;
  message: string;
}

interface AppErrorOptions {
  statusCode: number;
  code: string;
  message: string;
  details?: ErrorDetail[];
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: ErrorDetail[] | undefined;

  constructor({ statusCode, code, message, details }: AppErrorOptions) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
