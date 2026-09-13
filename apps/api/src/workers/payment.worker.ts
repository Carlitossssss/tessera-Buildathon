import type { Job } from 'bullmq';
import { and, eq, schema } from '@tessera/db';
import { getDb } from '../lib/db.js';
import { fulfillStripePackageCheckout } from '../services/payments/orders.js';
import {
  ensureSubscriptionEntitlement,
  grantSubscriptionPayment,
  stopSubscriptionEntitlement,
} from '../services/payments/subscriptions.js';

type StripeObject = {
  id?: string;
  mode?: 'payment' | 'subscription';
  payment_status?: string;
  metadata?: { paymentOrderId?: string };
  subscription?: string | { id?: string } | null;
  status?: string;
  current_period_end?: number;
  parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
  items?: { data?: Array<{ current_period_end?: number }> };
  lines?: { data?: Array<{ period?: { end?: number } }> };
};

const stripeId = (value: string | { id?: string } | null | undefined) =>
  typeof value === 'string' ? value : value?.id;

const stripeSubscriptionId = (resource: StripeObject) =>
  stripeId(resource.subscription) ?? stripeId(resource.parent?.subscription_details?.subscription);

const stripePeriodEnd = (resource: StripeObject) =>
  resource.current_period_end ?? resource.items?.data?.[0]?.current_period_end;

/** Stripe retries delivery. The persisted inbox plus TSC lot keys make this safe to replay. */
export async function processPaymentJob(job: Job<{ provider: 'stripe'; eventId: string }>) {
  const db = getDb();
  const event = await db.query.paymentEvents.findFirst({
    where: and(
      eq(schema.paymentEvents.provider, job.data.provider),
      eq(schema.paymentEvents.providerEventId, job.data.eventId),
    ),
  });
  if (!event || event.processedAt) return;
  try {
    const resource = (event.payload.data as { object?: StripeObject } | undefined)?.object;
    if (!resource?.id) throw new Error('Stripe event is missing data.object.id');

    if (
      (event.eventType === 'checkout.session.completed' ||
        event.eventType === 'checkout.session.async_payment_succeeded') &&
      resource.mode === 'payment' &&
      resource.payment_status === 'paid'
    ) {
      await fulfillStripePackageCheckout(resource.id);
    } else if (event.eventType === 'checkout.session.async_payment_failed' && resource.mode === 'payment') {
      const paymentOrderId = resource.metadata?.paymentOrderId;
      if (!paymentOrderId) throw new Error('Stripe checkout lacks payment order linkage');
      await db
        .update(schema.paymentOrders)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(
          and(
            eq(schema.paymentOrders.id, paymentOrderId),
            eq(schema.paymentOrders.provider, 'stripe'),
            eq(schema.paymentOrders.kind, 'package'),
          ),
        );
    } else if (event.eventType === 'checkout.session.completed' && resource.mode === 'subscription') {
      const paymentOrderId = resource.metadata?.paymentOrderId;
      const subscriptionId = stripeSubscriptionId(resource);
      if (!paymentOrderId || !subscriptionId) throw new Error('Stripe subscription checkout lacks payment order linkage');
      await db
        .update(schema.paymentOrders)
        .set({ providerOrderId: subscriptionId, status: 'approved_pending', updatedAt: new Date() })
        .where(
          and(
            eq(schema.paymentOrders.id, paymentOrderId),
            eq(schema.paymentOrders.provider, 'stripe'),
            eq(schema.paymentOrders.kind, 'subscription'),
          ),
        );
    } else if (event.eventType === 'invoice.paid') {
      const subscriptionId = stripeSubscriptionId(resource);
      if (!subscriptionId) throw new Error('Stripe invoice is missing subscription');
      const periodEnd = resource.lines?.data?.[0]?.period?.end;
      const result = await grantSubscriptionPayment({
        providerSubscriptionId: subscriptionId,
        paymentId: resource.id,
        nextBillingTime: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
      });
      if (!result.handled) throw new Error(`Stripe subscription ${subscriptionId} is not linked to an order yet`);
    } else if (event.eventType === 'customer.subscription.updated' || event.eventType === 'customer.subscription.created') {
      if (resource.status === 'active') {
        const entitlement = await ensureSubscriptionEntitlement({
          providerSubscriptionId: resource.id,
          currentPeriodEnd: stripePeriodEnd(resource)
            ? new Date(stripePeriodEnd(resource)! * 1000).toISOString()
            : undefined,
        });
        if (!entitlement) throw new Error(`Stripe subscription ${resource.id} is not linked to an order yet`);
      }
    } else if (event.eventType === 'customer.subscription.deleted') {
      const result = await stopSubscriptionEntitlement({ providerSubscriptionId: resource.id, status: 'cancelled' });
      if (!result.handled) throw new Error(`Stripe subscription ${resource.id} is not linked to an order yet`);
    } else if (event.eventType === 'invoice.payment_failed') {
      const subscriptionId = stripeSubscriptionId(resource);
      if (!subscriptionId) throw new Error('Stripe invoice is missing subscription');
      const result = await stopSubscriptionEntitlement({ providerSubscriptionId: subscriptionId, status: 'payment_failed' });
      if (!result.handled) throw new Error(`Stripe subscription ${subscriptionId} is not linked to an order yet`);
    }
    await db.update(schema.paymentEvents).set({ processedAt: new Date(), error: null }).where(eq(schema.paymentEvents.id, event.id));
  } catch (error) {
    await db.update(schema.paymentEvents).set({ error: String(error) }).where(eq(schema.paymentEvents.id, event.id));
    throw error;
  }
}
