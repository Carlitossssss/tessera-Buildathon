import type { Job } from 'bullmq';
import { eq } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { nanoid } from 'nanoid';

export async function processGdprExportJob(job: Job<{ requestId: string; userId: string }>) {
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, job.data.userId) });
  const certs = await db.query.certificates.findMany({
    where: eq(schema.certificates.studentUserId, job.data.userId),
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user?.id,
      email: user?.email,
      name: user?.name,
      role: user?.role,
      createdAt: user?.createdAt,
    },
    certificates: certs.map((c) => ({
      id: c.id,
      achievement: c.achievementName,
      issuedAt: c.issuedAt,
      tokenId: c.onchainTokenId?.toString(),
      txHash: c.txHash,
    })),
  };

  const token = nanoid(40);
  const url = `mock://exports/${token}.json`; // reemplazar por R2 signed url
  logger.info(
    { userId: user?.id, size: JSON.stringify(exportData).length },
    'Export GDPR generado',
  );

  await db
    .update(schema.gdprRequests)
    .set({
      status: 'ready',
      downloadToken: token,
      downloadUrl: url,
      downloadExpiresAt: new Date(Date.now() + 7 * 86_400_000),
      completedAt: new Date(),
      metadata: exportData as Record<string, unknown>,
    })
    .where(eq(schema.gdprRequests.id, job.data.requestId));
}
