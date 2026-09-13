import type { Job } from 'bullmq';
import { eq } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export async function processGdprDeletionJob(job: Job<{ requestId: string; userId: string }>) {
  const db = getDb();
  const req = await db.query.gdprRequests.findFirst({
    where: eq(schema.gdprRequests.id, job.data.requestId),
  });
  if (!req || req.canceledAt || req.status !== 'scheduled') return;
  if (req.scheduledFor && req.scheduledFor > new Date()) return;

  await db
    .update(schema.users)
    .set({
      email: `deleted+${req.userId}@tessera.invalid`,
      name: null,
      passwordHash: null,
      avatarUrl: null,
      walletAddress: null,
      twoFactorSecret: null,
      twoFactorEnabled: false,
      deletedAt: new Date(),
    })
    .where(eq(schema.users.id, job.data.userId));

  await db
    .update(schema.gdprRequests)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(schema.gdprRequests.id, req.id));

  logger.info({ userId: job.data.userId }, 'Usuario anonimizado (GDPR)');
}
