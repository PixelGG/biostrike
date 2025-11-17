export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, options?: { statusCode?: number; code?: string }) {
    super(message);
    this.name = 'AppError';
    this.statusCode = options?.statusCode ?? 500;
    this.code = options?.code ?? 'INTERNAL_ERROR';
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

