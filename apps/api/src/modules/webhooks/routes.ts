import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHmac, randomBytes } from 'node:crypto';
import { and, eq, isNull } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { WEBHOOK_EVENTS } from '@tessera/shared/constants';
import { errors } from '@tessera/shared/errors';

const webhookEventValues = Object.values(WEBHOOK_EVENTS) as [string, ...string[]];

/**
 * El worker hace POST a esta URL desde dentro de la red de Tessera, asi que un
 * endpoint apuntando a localhost o a rangos privados convertiria el webhook en
 * un SSRF contra nuestra propia infraestructura. Exigimos https publico.
 */
const PRIVATE_HOST = /^(localhost$|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.)/i;

export const webhookUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') return false;
      return !PRIVATE_HOST.test(url.hostname);
    } catch {
      return false;
    }
  }, 'La URL debe ser https y apuntar a un host publico');

const createSchema = z.object({
  url: webhookUrlSchema,
  events: z.array(z.enum(webhookEventValues)).min(1),
});

const listSchema = z.object({
  includeDisabled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

const updateSchema = z
  .object({
    url: webhookUrlSchema.optional(),
    events: z.array(z.enum(webhookEventValues)).min(1).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'Nada que actualizar');

async function getInstitutionId(userId: string) {
  const db = getDb();
  const m = await db.query.institutionMembers.findFirst({
    where: eq(schema.institutionMembers.userId, userId),
  });
  if (!m) throw errors.forbidden('No perteneces a una institucion');
  return m.institutionId;
}

export default async function webhookRoutes(app: FastifyInstance) {
  app.post(
    '/v1/webhooks',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'Webhooks'],
        description: 'Registra un endpoint que recibira webhooks firmados con HMAC-SHA256.',
        body: createSchema,
      },
    },
    async (req, reply) => {
      const body = createSchema.parse(req.body);
      const institutionId = await getInstitutionId(req.auth!.userId);
      const secret = randomBytes(32).toString('hex');
      const db = getDb();
      const [row] = await db
        .insert(schema.webhookEndpoints)
        .values({ institutionId, url: body.url, events: body.events, secret })
        .returning();
      reply.status(201);
      // El secret viaja UNA sola vez. Devolvemos con el todo lo que hace falta
      // para verificar la firma, para que nadie tenga que deducirlo.
      return {
        ...row,
        secret,
        signing: {
          header: 'X-Tessera-Signature',
          format: 't=<unix>,v1=<hmac_sha256>',
          signedPayload: '<timestamp>.<raw_body>',
          algorithm: 'HMAC-SHA256',
          toleranceSeconds: 300,
        },
        warning: 'Guarda el secret ahora. No podras volver a verlo.',
      };
    },
  );

  app.get(
    '/v1/webhooks',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'Webhooks'],
        description: 'Lista los webhook endpoints registrados.',
      },
    },
    async (req) => {
      const query = listSchema.parse(req.query ?? {});
      const institutionId = await getInstitutionId(req.auth!.userId);
      const db = getDb();
      const rows = await db.query.webhookEndpoints.findMany({
        where: query.includeDisabled
          ? eq(schema.webhookEndpoints.institutionId, institutionId)
          : and(
              eq(schema.webhookEndpoints.institutionId, institutionId),
              isNull(schema.webhookEndpoints.disabledAt),
            ),
      });
      // El secret solo se entrega en la creacion. Lo omitimos explicitamente en
      // vez de sobreescribirlo con undefined, que deja la clave en el JSON.
      return rows.map(({ secret: _secret, ...rest }) => rest);
    },
  );

  app.post(
    '/v1/webhooks/:id/test',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit({ max: 10, timeWindow: 60_000 })],
      schema: {
        tags: ['Public API', 'Webhooks'],
        description:
          'Envia una entrega de prueba firmada al endpoint y devuelve como respondio. Sirve para validar la verificacion de firma antes de depender de eventos reales.',
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const institutionId = await getInstitutionId(req.auth!.userId);
      const db = getDb();
      const endpoint = await db.query.webhookEndpoints.findFirst({
        where: and(
          eq(schema.webhookEndpoints.id, id),
          eq(schema.webhookEndpoints.institutionId, institutionId),
        ),
      });
      if (!endpoint) throw errors.notFound('Webhook no encontrado');

      const eventId = `evt_test_${randomBytes(8).toString('hex')}`;
      const body = JSON.stringify({
        id: eventId,
        type: 'webhook.test',
        createdAt: new Date().toISOString(),
        data: { message: 'Entrega de prueba de Tessera. Si la firma valida, tu integracion funciona.' },
      });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = createHmac('sha256', endpoint.secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');

      const startedAt = Date.now();
      try {
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tessera-Event-Id': eventId,
            'X-Tessera-Event-Type': 'webhook.test',
            'X-Tessera-Timestamp': timestamp,
            'X-Tessera-Signature': `t=${timestamp},v1=${signature}`,
            'X-Tessera-Delivery-Attempt': '1',
            'User-Agent': 'Tessera-Webhooks/1.0',
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        return {
          delivered: res.ok,
          statusCode: res.status,
          durationMs: Date.now() - startedAt,
          eventId,
          hint: res.ok
            ? 'Tu endpoint respondio correctamente.'
            : 'Tu endpoint respondio con un codigo distinto de 2xx. Revisa la verificacion de firma.',
        };
      } catch (err) {
        return {
          delivered: false,
          statusCode: null,
          durationMs: Date.now() - startedAt,
          eventId,
          error: err instanceof Error ? err.message : String(err),
          hint: 'No pudimos contactar el endpoint. Verifica que sea publico, https y responda en menos de 10 s.',
        };
      }
    },
  );

  app.patch(
    '/v1/webhooks/:id',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'Webhooks'],
        description:
          'Actualiza la URL o los eventos de un endpoint, o lo reactiva tras haberlo desactivado. El secret no cambia.',
        body: updateSchema,
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = updateSchema.parse(req.body);
      const institutionId = await getInstitutionId(req.auth!.userId);
      const db = getDb();
      const [row] = await db
        .update(schema.webhookEndpoints)
        .set({
          ...(body.url ? { url: body.url } : {}),
          ...(body.events ? { events: body.events } : {}),
          ...(body.enabled === undefined ? {} : { disabledAt: body.enabled ? null : new Date() }),
        })
        .where(
          and(
            eq(schema.webhookEndpoints.id, id),
            eq(schema.webhookEndpoints.institutionId, institutionId),
          ),
        )
        .returning();
      if (!row) throw errors.notFound('Webhook no encontrado');
      const { secret: _secret, ...rest } = row;
      return rest;
    },
  );

  app.delete(
    '/v1/webhooks/:id',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Public API', 'Webhooks'], description: 'Desactiva un webhook endpoint.' },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const institutionId = await getInstitutionId(req.auth!.userId);
      const db = getDb();
      const [row] = await db
        .update(schema.webhookEndpoints)
        .set({ disabledAt: new Date() })
        .where(
          and(
            eq(schema.webhookEndpoints.id, id),
            eq(schema.webhookEndpoints.institutionId, institutionId),
          ),
        )
        .returning();
      if (!row) throw errors.notFound('Webhook no encontrado');
      return { disabled: true };
    },
  );
}
