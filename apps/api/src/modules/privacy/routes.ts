import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { eq } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { queues } from '../../services/queues.js';

export default async function privacyRoutes(app: FastifyInstance) {
  const exportHandler = async (req: import('fastify').FastifyRequest) => {
    const db = getDb();
    const [row] = await db
      .insert(schema.gdprRequests)
      .values({ userId: req.auth!.userId, kind: 'export', status: 'pending' })
      .returning();
    await queues.gdprExport.add('gdpr-export', {
      requestId: row!.id,
      userId: req.auth!.userId,
      email: req.auth!.email,
    });
    return { requestId: row!.id, status: 'queued' };
  };

  const deleteHandler = async (req: import('fastify').FastifyRequest) => {
    const db = getDb();
    if (req.auth!.role === 'admin') {
      return app.httpErrors.badRequest(
        'El administrador global no puede eliminar su cuenta desde este flujo',
      );
    }
    const scheduledFor = new Date(Date.now() + 30 * 86_400_000);
    const [row] = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(schema.gdprRequests)
        .values({
          userId: req.auth!.userId,
          kind: 'delete',
          status: 'scheduled',
          scheduledFor,
          downloadToken: nanoid(32),
        })
        .returning();
      await tx
        .update(schema.users)
        .set({
          deletionScheduledAt: scheduledFor,
          restricted: true,
          restrictedAt: new Date(),
          restrictionReason: 'La cuenta tiene una solicitud de eliminación programada.',
        })
        .where(eq(schema.users.id, req.auth!.userId));

      if (req.auth!.role === 'institution_admin') {
        const membership = await tx.query.institutionMembers.findFirst({
          where: eq(schema.institutionMembers.userId, req.auth!.userId),
        });
        if (membership) {
          await tx
            .update(schema.institutions)
            .set({
              status: 'revoked',
              rejectedAt: new Date(),
              rejectionReason:
                'El administrador institucional solicitó la eliminación de su cuenta.',
              updatedAt: new Date(),
            })
            .where(eq(schema.institutions.id, membership.institutionId));
        }
      }

      return inserted;
    });
    return {
      requestId: row!.id,
      deletionScheduledAt: scheduledFor.toISOString(),
      cancelUrl: `${process.env.API_PUBLIC_URL ?? ''}/v1/account/restore?token=${row!.downloadToken}`,
    };
  };

  const cancelHandler = async (req: import('fastify').FastifyRequest) => {
    const db = getDb();
    await db
      .update(schema.users)
      .set({
        deletionScheduledAt: null,
        restricted: false,
        restrictedAt: null,
        restrictionReason: null,
      })
      .where(eq(schema.users.id, req.auth!.userId));
    return { canceled: true };
  };

  // Rutas /v1/privacy/* (compatibles)
  app.post(
    '/v1/privacy/export',
    { preHandler: [app.requireAuth(), app.rateLimit()], schema: { tags: ['Privacy'] } },
    exportHandler,
  );
  app.post(
    '/v1/privacy/delete',
    { preHandler: [app.requireAuth(), app.rateLimit()], schema: { tags: ['Privacy'] } },
    deleteHandler,
  );
  app.post(
    '/v1/privacy/delete/cancel',
    { preHandler: [app.requireAuth(), app.rateLimit()], schema: { tags: ['Privacy'] } },
    cancelHandler,
  );

  // Aliases publicos documentados en 09_PublicAPI.md
  app.get(
    '/v1/account/my-data/export',
    { preHandler: [app.requireAuth(), app.rateLimit()], schema: { tags: ['Privacy'] } },
    exportHandler,
  );
  app.delete(
    '/v1/account',
    { preHandler: [app.requireAuth(), app.rateLimit()], schema: { tags: ['Privacy'] } },
    deleteHandler,
  );
  app.post(
    '/v1/account/restore',
    { preHandler: [app.requireAuth(), app.rateLimit()], schema: { tags: ['Privacy'] } },
    cancelHandler,
  );
}
