import type { Job } from 'bullmq';
import { createHmac } from 'node:crypto';
import { eq } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { WEBHOOK_BACKOFF_SCHEDULE_SECONDS, WEBHOOK_MAX_ATTEMPTS } from '@tessera/shared/constants';
import { queues } from '../services/queues.js';

export async function processWebhookJob(job: Job<{ webhookEventId: string }>) {
  const db = getDb();
  const evt = await db.query.webhookEvents.findFirst({
    where: eq(schema.webhookEvents.id, job.data.webhookEventId),
  });
  if (!evt) return;
  if (evt.status === 'delivered') return;
  if (evt.expiresAt < new Date()) {
    await db
      .update(schema.webhookEvents)
      .set({ status: 'expired' })
      .where(eq(schema.webhookEvents.id, evt.id));
    return;
  }

  const endpoint = evt.endpointId
    ? await db.query.webhookEndpoints.findFirst({
        where: eq(schema.webhookEndpoints.id, evt.endpointId),
      })
    : null;
  if (!endpoint || endpoint.disabledAt) {
    await db
      .update(schema.webhookEvents)
      .set({ status: 'canceled' })
      .where(eq(schema.webhookEvents.id, evt.id));
    return;
  }

  const body = JSON.stringify(evt.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', endpoint.secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  const attempt = evt.attempts + 1;
  let statusCode = 0;
  let error: string | null = null;
  try {
    // Usamos la URL vigente del endpoint, no la copiada al encolar: si la
    // institucion la corrigio (o la desactivo) mientras el evento esperaba en
    // la cola, la entrega debe seguir el destino actual y nunca el antiguo.
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tessera-Event-Id': evt.eventId,
        'X-Tessera-Event-Type': evt.eventType,
        'X-Tessera-Timestamp': timestamp,
        'X-Tessera-Signature': `t=${timestamp},v1=${signature}`,
        'X-Tessera-Delivery-Attempt': String(attempt),
        'User-Agent': 'Tessera-Webhooks/1.0',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    statusCode = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  if (!error) {
    await db
      .update(schema.webhookEvents)
      .set({
        status: 'delivered',
        deliveredAt: new Date(),
        attempts: attempt,
        lastStatusCode: statusCode,
      })
      .where(eq(schema.webhookEvents.id, evt.id));
    return;
  }

  if (attempt >= WEBHOOK_MAX_ATTEMPTS) {
    await db
      .update(schema.webhookEvents)
      .set({ status: 'failed', attempts: attempt, lastError: error, lastAttemptAt: new Date() })
      .where(eq(schema.webhookEvents.id, evt.id));
    logger.warn({ eventId: evt.eventId }, 'Webhook entrega fallida definitivamente');
    return;
  }

  const nextDelay = WEBHOOK_BACKOFF_SCHEDULE_SECONDS[attempt] ?? 86_400;
  await db
    .update(schema.webhookEvents)
    .set({ attempts: attempt, lastError: error, lastAttemptAt: new Date(), status: 'retrying' })
    .where(eq(schema.webhookEvents.id, evt.id));
  await queues.webhook.add('deliver', { webhookEventId: evt.id }, { delay: nextDelay * 1000 });
}
