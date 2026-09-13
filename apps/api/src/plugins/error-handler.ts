import fp from 'fastify-plugin';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@tessera/shared/errors';
import { ZodError } from 'zod';

export default fp(
  async (app: FastifyInstance) => {
    app.setErrorHandler((err: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
      const requestId = req.id;
      const payloadError =
        typeof err === 'object' &&
        err &&
        'error' in err &&
        typeof (err as { error?: unknown }).error === 'object' &&
        (err as { error?: unknown }).error
          ? ((err as { error: Record<string, unknown> }).error ?? null)
          : null;

      if (payloadError?.code === 'RATE_LIMIT_EXCEEDED') {
        req.log.warn({ err, requestId }, 'Rate limit excedido');
        return reply.status(429).send({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message:
              typeof payloadError.message === 'string'
                ? payloadError.message
                : 'Limite de solicitudes excedido',
            details: payloadError.details,
            requestId,
          },
        });
      }

      if (err instanceof AppError) {
        req.log.warn(
          { err, code: err.code, status: err.statusCode, requestId },
          'AppError capturado',
        );
        return reply.status(err.statusCode).send({
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
            requestId,
          },
        });
      }

      if (err instanceof ZodError) {
        req.log.warn({ err, requestId }, 'Error de validacion Zod');
        return reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Los datos enviados no son validos',
            details: err.flatten(),
            requestId,
          },
        });
      }

      if (err.validation) {
        return reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: err.message,
            details: err.validation,
            requestId,
          },
        });
      }

      if (err.statusCode && err.statusCode < 500) {
        return reply.status(err.statusCode).send({
          error: {
            code: err.code ?? 'CLIENT_ERROR',
            message: err.message,
            requestId,
          },
        });
      }

      if (err.code === 'ECONNREFUSED') {
        req.log.error({ err, requestId }, 'Base de datos no disponible');
        return reply.status(503).send({
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: 'No se pudo conectar con la base de datos. Verifica que Postgres esté levantado.',
            requestId,
          },
        });
      }

      req.log.error({ err, requestId }, 'Error no manejado');
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          requestId,
        },
      });
    });

    app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Ruta ${req.method} ${req.url} no encontrada`,
          requestId: req.id,
        },
      });
    });
  },
  { name: 'error-handler' },
);
