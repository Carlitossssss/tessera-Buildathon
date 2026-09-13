import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, desc } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { errors } from '@tessera/shared/errors';
import { paginationSchema } from '@tessera/shared/schemas';

const createSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  website: z.string().url().optional(),
  country: z.string().length(2).optional(),
});

export default async function institutionRoutes(app: FastifyInstance) {
  app.get(
    '/v1/institutions',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Institutions'], querystring: paginationSchema },
    },
    async (req) => {
      const { page, limit } = paginationSchema.parse(req.query);
      const db = getDb();
      const offset = (page - 1) * limit;
      const rows = await db.query.institutions.findMany({
        limit,
        offset,
        orderBy: [desc(schema.institutions.createdAt)],
      });
      return { data: rows, page, limit };
    },
  );

  app.post(
    '/v1/institutions',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Institutions'], body: createSchema },
    },
    async (req, reply) => {
      const body = createSchema.parse(req.body);
      const db = getDb();
      const [row] = await db
        .insert(schema.institutions)
        .values({ ...body, status: 'pending' })
        .returning();
      reply.status(201);
      return row;
    },
  );

  app.post(
    '/v1/institutions/:id/approve',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Institutions'] },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const db = getDb();
      const [row] = await db
        .update(schema.institutions)
        .set({ status: 'approved', approvedAt: new Date() })
        .where(eq(schema.institutions.id, id))
        .returning();
      if (!row) throw errors.notFound('Institucion no encontrada');
      return row;
    },
  );

  app.get(
    '/v1/me/institution',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'Institutions'],
        description: 'Datos de la institucion del usuario autenticado.',
      },
    },
    async (req) => {
      const db = getDb();
      const membership = await db.query.institutionMembers.findFirst({
        where: eq(schema.institutionMembers.userId, req.auth!.userId),
      });
      if (!membership) throw errors.notFound('No perteneces a ninguna institucion');
      const institution = await db.query.institutions.findFirst({
        where: eq(schema.institutions.id, membership.institutionId),
      });
      return { institution, membership };
    },
  );
  void and;
}
