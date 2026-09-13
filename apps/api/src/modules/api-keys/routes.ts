import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { and, eq, isNull } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { errors } from '@tessera/shared/errors';
import { API_KEY_PREFIX, API_KEY_SCOPES } from '@tessera/shared/constants';
import { forgetCachedApiKey } from '../../plugins/api-key.js';

const createSchema = z.object({
  name: z.string().min(2).max(100),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
  expiresInDays: z.number().int().positive().max(730).optional(),
});

async function resolveInstitutionId(userId: string): Promise<string> {
  const db = getDb();
  const membership = await db.query.institutionMembers.findFirst({
    where: eq(schema.institutionMembers.userId, userId),
  });
  if (!membership) throw errors.forbidden('No perteneces a una institucion');
  return membership.institutionId;
}

export default async function apiKeyRoutes(app: FastifyInstance) {
  app.post(
    '/v1/api-keys',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'ApiKeys'],
        description:
          'Crea una API Key para integrar con sistemas externos. La clave se muestra UNA sola vez.',
        body: createSchema,
      },
    },
    async (req, reply) => {
      const body = createSchema.parse(req.body);
      const institutionId = await resolveInstitutionId(req.auth!.userId);

      const secret = randomBytes(24).toString('base64url');
      const prefix = `${API_KEY_PREFIX}${randomBytes(4).toString('hex')}`;
      const fullKey = `${prefix}_${secret}`;
      const hash = await argon2.hash(fullKey, { type: argon2.argon2id });

      const db = getDb();
      const [row] = await db
        .insert(schema.apiKeys)
        .values({
          institutionId,
          name: body.name,
          prefix,
          hash,
          secret: '',
          scopes: body.scopes,
          createdBy: req.auth!.userId,
          expiresAt: body.expiresInDays
            ? new Date(Date.now() + body.expiresInDays * 86_400_000)
            : null,
        })
        .returning();

      reply.status(201);
      return {
        id: row!.id,
        name: row!.name,
        prefix,
        scopes: row!.scopes,
        key: fullKey,
        warning: 'Guarda la clave ahora. No podras verla de nuevo.',
      };
    },
  );

  app.get(
    '/v1/api-keys',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'ApiKeys'],
        description: 'Lista las API Keys activas de la institucion (sin exponer la clave).',
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const rows = await db.query.apiKeys.findMany({
        where: and(
          eq(schema.apiKeys.institutionId, institutionId),
          isNull(schema.apiKeys.revokedAt),
        ),
      });
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        prefix: r.prefix,
        scopes: r.scopes,
        lastUsedAt: r.lastUsedAt,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      }));
    },
  );

  app.delete(
    '/v1/api-keys/:id',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'ApiKeys'],
        description: 'Revoca una API Key. Las requests posteriores con esa clave devuelven 401.',
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const [row] = await db
        .update(schema.apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.institutionId, institutionId)))
        .returning();
      if (!row) throw errors.notFound('API key no encontrada');
      // La revocacion debe surtir efecto ya en este proceso, sin esperar al TTL.
      forgetCachedApiKey(row.id);
      return { revoked: true, id: row.id };
    },
  );
}
