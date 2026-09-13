import Fastify, { type FastifyInstance, type FastifyBaseLogger } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import underPressure from '@fastify/under-pressure';
import multipart from '@fastify/multipart';
import fastifyRawBody from 'fastify-raw-body';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { nanoid } from 'nanoid';

import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import errorHandler from './plugins/error-handler.js';
import authPlugin from './plugins/auth.js';
import apiKeyPlugin from './plugins/api-key.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import swaggerPlugin, { swaggerUiPlugin } from './plugins/swagger.js';
import institutionDocsPlugin from './plugins/institution-docs.js';

import healthRoutes from './modules/health/routes.js';
import authRoutes from './modules/auth/routes.js';
import institutionRoutes from './modules/institutions/routes.js';
import certificateRoutes from './modules/certificates/routes.js';
import apiKeyRoutes from './modules/api-keys/routes.js';
import webhookRoutes from './modules/webhooks/routes.js';
import portalRoutes from './modules/portal/routes.js';
import privacyRoutes from './modules/privacy/routes.js';
import stripeWebhookRoutes from './modules/stripe/routes.js';
import walletRoutes from './modules/wallet/routes.js';
import jobsRoutes from './modules/jobs/routes.js';
import meRoutes from './modules/me/routes.js';
import publicCoursesRoutes from './modules/public-courses/routes.js';
import coursesContentRoutes from './modules/courses-content/routes.js';
import learnRoutes from './modules/learn/routes.js';
import teacherRoutes from './modules/teacher/routes.js';
import studentRoutes from './modules/student/routes.js';
import adminRoutes from './modules/admin/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    trustProxy: true,
    genReqId: () => nanoid(16),
    disableRequestLogging: false,
    bodyLimit: 5 * 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(errorHandler);
  await app.register(helmet, { global: true, contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.API_CORS_ORIGINS.split(',').map((s) => s.trim()),
    credentials: true,
  });
  await app.register(sensible);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  await app.register(fastifyRawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
  });
  await app.register(underPressure, {
    maxEventLoopDelay: 1_000,
    maxHeapUsedBytes: 1_073_741_824,
    maxRssBytes: 1_610_612_736,
    maxEventLoopUtilization: 0.98,
    message: 'Servicio bajo presion',
    exposeStatusRoute: '/v1/status',
  });

  await app.register(authPlugin);
  await app.register(apiKeyPlugin);
  await app.register(rateLimitPlugin);
  await app.register(swaggerPlugin);
  await app.register(
    async (scope) => {
      await scope.register(swaggerUiPlugin);
    },
    { prefix: '/v1' },
  );
  await app.register(institutionDocsPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(institutionRoutes);
  await app.register(meRoutes);
  await app.register(publicCoursesRoutes);
  await app.register(coursesContentRoutes);
  await app.register(learnRoutes);
  await app.register(teacherRoutes);
  await app.register(studentRoutes);
  await app.register(adminRoutes);
  await app.register(certificateRoutes);
  await app.register(jobsRoutes);
  await app.register(walletRoutes);
  await app.register(apiKeyRoutes);
  await app.register(webhookRoutes);
  await app.register(portalRoutes);
  await app.register(privacyRoutes);
  await app.register(stripeWebhookRoutes);

  // La raiz es lo primero que escanea cualquiera que encuentre el dominio.
  // Publicar aqui el mapa de la documentacion le entrega gratis la superficie
  // de ataque: quien tiene permiso llega a /v1/docs por el dashboard, no por
  // descubrimiento. Devolvemos solo una senal de vida.
  app.get('/', { logLevel: 'warn' }, async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Robots-Tag', 'noindex, nofollow');
    return { service: 'tessera-api', status: 'ok' };
  });

  return app;
}
