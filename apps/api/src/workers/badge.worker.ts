import type { Job } from 'bullmq';
import { logger } from '../lib/logger.js';

export async function processBadgeJob(job: Job) {
  logger.info({ jobId: job.id, data: job.data }, 'Badge job (placeholder v1.1)');
  return { skipped: true };
}
