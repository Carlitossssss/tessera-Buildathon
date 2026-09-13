import type { FastifyInstance } from 'fastify';
import { and, eq } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { errors } from '@tessera/shared/errors';

/**
 * Alias top-level del lookup de jobs documentado en 09_PublicAPI.md.
 */
export default async function jobsRoutes(app: FastifyInstance) {
  app.get(
    '/v1/jobs/:jobId',
    {
      preHandler: [app.requireApiKey(['certificates:read']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'Jobs'],
        description: 'Estado de un job de emision/revocacion asincrono.',
      },
    },
    async (req) => {
      const { jobId } = req.params as { jobId: string };
      const db = getDb();
      const job = await db.query.emissionJobs.findFirst({
        where: and(
          eq(schema.emissionJobs.publicId, jobId),
          eq(schema.emissionJobs.institutionId, req.apiKey!.institutionId),
        ),
      });
      if (!job) throw errors.notFound('Job');

      const cert = job.certificateId
        ? await db.query.certificates.findFirst({
            where: eq(schema.certificates.id, job.certificateId),
          })
        : null;

      return {
        jobId: job.publicId,
        status: job.status,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        result: cert
          ? {
              certificateId: cert.id,
              tokenId: cert.onchainTokenId?.toString() ?? null,
              txHash: cert.txHash,
              status: cert.status,
            }
          : null,
        error: job.lastError,
      };
    },
  );
}
