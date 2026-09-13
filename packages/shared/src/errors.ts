export type AppErrorCode =
  | 'INVALID_API_KEY'
  | 'INVALID_SIGNATURE'
  | 'INSTITUTION_SUSPENDED'
  | 'INSTITUTION_NOT_APPROVED'
  | 'CERTIFICATE_NOT_FOUND'
  | 'CERTIFICATE_ALREADY_REVOKED'
  | 'INVALID_TEMPLATE'
  | 'INSUFFICIENT_CREDITS'
  | 'RATE_LIMIT_EXCEEDED'
  | 'BLOCKCHAIN_ERROR'
  | 'STORAGE_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL'
  | 'BAD_REQUEST'
  | 'SERVICE_UNAVAILABLE';

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    statusCode = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  public toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export const errors = {
  invalidApiKey: () => new AppError('INVALID_API_KEY', 'API Key invalida o expirada', 401),
  unauthorized: (msg = 'No autorizado') => new AppError('UNAUTHORIZED', msg, 401),
  forbidden: (msg = 'Acceso denegado') => new AppError('FORBIDDEN', msg, 403),
  notFound: (resource: string) => new AppError('NOT_FOUND', `${resource} no encontrado`, 404),
  badRequest: (msg: string, details?: Record<string, unknown>) =>
    new AppError('BAD_REQUEST', msg, 400, details),
  rateLimited: (retryAfter: number) =>
    new AppError('RATE_LIMIT_EXCEEDED', 'Limite de requests superado', 429, { retryAfter }),
  validation: (details: Record<string, unknown>) =>
    new AppError('VALIDATION_ERROR', 'Datos invalidos', 422, details),
  conflict: (msg: string) => new AppError('CONFLICT', msg, 409),
  internal: (msg = 'Error interno del servidor') => new AppError('INTERNAL', msg, 500),
  blockchainError: (msg: string, details?: Record<string, unknown>) =>
    new AppError('BLOCKCHAIN_ERROR', msg, 502, details),
  storageError: (msg: string) => new AppError('STORAGE_ERROR', msg, 502),
  serviceUnavailable: (msg: string) => new AppError('SERVICE_UNAVAILABLE', msg, 503),
  insufficientCredits: (balance: number) =>
    new AppError(
      'INSUFFICIENT_CREDITS',
      'Sin creditos disponibles. Compra un bundle desde el panel para continuar emitiendo.',
      402,
      { balance },
    ),
  certificateAlreadyRevoked: (tokenId: string) =>
    new AppError('CERTIFICATE_ALREADY_REVOKED', 'El certificado ya esta revocado', 409, {
      tokenId,
    }),
};
