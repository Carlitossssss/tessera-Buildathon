import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { createRedis } from '../lib/redis.js';
import { env } from '../config/env.js';
import { resolveRateLimitKey, resolveRateLimitMax } from './rate-limit.utils.js';

export default fp(
  async (app) => {
    const redis = createRedis({ keyPrefix: 'rl:' });

    await app.register(rateLimit, {
      global: false,
      redis,
      nameSpace: 'tessera',
      keyGenerator: (req) => {
        return resolveRateLimitKey({
          ip: req.ip,
          auth: req.auth,
          apiKey: req.apiKey,
        });
      },
      max: (req) => {
        return resolveRateLimitMax({
          ip: req.ip,
          auth: req.auth,
          apiKey: req.apiKey,
        });
      },
      timeWindow: '1 minute',
      errorResponseBuilder: (_, ctx) => ({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Limite de solicitudes excedido. Reintenta en ${ctx.after}`,
          details: { retryAfter: ctx.after },
        },
      }),
    });

    app.addHook('onClose', async () => {
      await redis.quit();
    });

    app.log.info({ env: env.NODE_ENV }, 'Rate limit configurado');
  },
  { name: 'rate-limit', dependencies: ['error-handler'] },
);
