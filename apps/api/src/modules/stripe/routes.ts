import type { FastifyInstance } from 'fastify';
import { and, eq, schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { queues } from '../../services/queues.js';
import { verifyStripeWebhook } from '../../services/payments/stripe.js';

export default async function stripeWebhookRoutes(app: FastifyInstance) {
  app.post('/v1/webhooks/stripe', {
    config: { rawBody: true },
    schema: { tags: ['Payments'], description: 'Verified Stripe webhook inbox.' },
  }, async (req, reply) => {
    const raw = (req as typeof req & { rawBody?: string }).rawBody;
    const signature = req.headers['stripe-signature'];
    if (!raw || typeof signature !== 'string' || !verifyStripeWebhook(signature, raw)) {
      return reply.status(400).send({ error: { code: 'INVALID_SIGNATURE' } });
    }
    let event: { id?: string; type?: string } & Record<string, unknown>;
    try {
      event = JSON.parse(raw) as typeof event;
    } catch {
      return reply.status(400).send({ error: { code: 'INVALID_PAYLOAD' } });
    }
    if (!event.id || !event.type) return reply.status(400).send({ error: { code: 'INVALID_PAYLOAD' } });

    const db = getDb();
    const prior = await db.query.paymentEvents.findFirst({
      where: and(
        eq(schema.paymentEvents.provider, 'stripe'),
        eq(schema.paymentEvents.providerEventId, event.id),
      ),
    });
    if (prior) {
      if (!prior.processedAt) {
        await queues.paymentSync.add('stripe-event', { provider: 'stripe', eventId: event.id }, { jobId: `stripe:${event.id}` });
      }
      return { received: true, idempotent: true };
    }
    try {
      await db.insert(schema.paymentEvents).values({
        provider: 'stripe',
        providerEventId: event.id,
        eventType: event.type,
        payload: event,
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return { received: true, idempotent: true };
      throw error;
    }
    await queues.paymentSync.add('stripe-event', { provider: 'stripe', eventId: event.id }, { jobId: `stripe:${event.id}` });
    return { received: true };
  });
}
