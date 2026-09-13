import { Queue, type QueueOptions } from 'bullmq';
import { createRedis } from '../lib/redis.js';
import { QUEUE_NAMES } from '@tessera/shared/constants';

const connection = createRedis({ maxRetriesPerRequest: null });

const defaultOpts: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2_000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
};

export const queues = {
  certificate: new Queue(QUEUE_NAMES.CERTIFICATE, defaultOpts),
  badge: new Queue(QUEUE_NAMES.BADGE, defaultOpts),
  webhook: new Queue(QUEUE_NAMES.WEBHOOK, defaultOpts),
  email: new Queue(QUEUE_NAMES.EMAIL, defaultOpts),
  indexer: new Queue(QUEUE_NAMES.INDEXER, defaultOpts),
  gdprExport: new Queue(QUEUE_NAMES.GDPR_EXPORT, defaultOpts),
  gdprDeletion: new Queue(QUEUE_NAMES.GDPR_DELETION, defaultOpts),
  paymentSync: new Queue(QUEUE_NAMES.PAYMENT_SYNC, defaultOpts),
} as const;

export type Queues = typeof queues;

export async function closeQueues() {
  await Promise.all(Object.values(queues).map((q) => q.close()));
  await connection.quit();
}
