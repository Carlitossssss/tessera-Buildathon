import { Worker, type Processor } from 'bullmq';
import closeWithGrace from 'close-with-grace';
import { createRedis } from './lib/redis.js';
import { logger } from './lib/logger.js';
import { describeIpfsGateways } from './services/ipfs-readiness.js';
import { QUEUE_NAMES } from '@tessera/shared/constants';
import { processCertificateJob } from './workers/certificate.worker.js';
import { processBadgeJob } from './workers/badge.worker.js';
import { processWebhookJob } from './workers/webhook.worker.js';
import { processEmailJob } from './workers/email.worker.js';
import { processPaymentJob } from './workers/payment.worker.js';
import { processGdprExportJob } from './workers/gdpr-export.worker.js';
import { processGdprDeletionJob } from './workers/gdpr-deletion.worker.js';

function spawn(name: string, processor: Processor, concurrency = 5): Worker {
  const w = new Worker(name, processor, {
    connection: createRedis({ maxRetriesPerRequest: null }),
    concurrency,
  });
  w.on('ready', () => logger.info({ queue: name }, 'Worker listo'));
  w.on('failed', (job, err) => logger.error({ err, jobId: job?.id, queue: name }, 'Job fallo'));
  w.on('completed', (job) => logger.info({ jobId: job.id, queue: name }, 'Job completado'));
  w.on('error', (err) => logger.error({ err, queue: name }, 'Worker error'));
  return w;
}

async function main() {
  logger.info('Arrancando workers...');

  // A gateway pasted without its scheme used to fail only mid-issuance, after
  // the render, the pin and the TSC debit. Surface it at boot instead.
  const gateways = describeIpfsGateways();
  logger.info({ gateways }, 'Gateways IPFS resueltos');
  if (gateways.corrected.length) {
    logger.warn({ corrected: gateways.corrected }, 'Gateways IPFS sin esquema: se asumio https://');
  }
  if (gateways.invalid.length) {
    logger.error({ invalid: gateways.invalid }, 'Gateways IPFS invalidos: se descartaron');
  }

  const workers = [
    // Render e IPFS corren en paralelo; solo el mint se serializa por institucion.
    spawn(QUEUE_NAMES.CERTIFICATE, processCertificateJob, 8),
    spawn(QUEUE_NAMES.BADGE, processBadgeJob, 3),
    spawn(QUEUE_NAMES.WEBHOOK, processWebhookJob, 10),
    spawn(QUEUE_NAMES.EMAIL, processEmailJob, 10),
    spawn(QUEUE_NAMES.PAYMENT_SYNC, processPaymentJob, 5),
    spawn(QUEUE_NAMES.GDPR_EXPORT, processGdprExportJob, 2),
    spawn(QUEUE_NAMES.GDPR_DELETION, processGdprDeletionJob, 2),
  ];

  closeWithGrace({ delay: 15_000 }, async () => {
    logger.info('Cerrando workers...');
    await Promise.all(workers.map((w) => w.close()));
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Workers no iniciaron');
  process.exit(1);
});
