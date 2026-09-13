import { and, eq, schema, sql } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { logger } from '../../lib/logger.js';
import { grantSubscriptionTsc } from '../credits.js';

interface SubscriptionSnapshot {
  code: string;
  monthlyTsc: number | null;
}

export interface SubscriptionEntitlement {
  id: string;
  institutionId: string;
  providerSubscriptionId: string;
  monthlyTsc: number;
  status: string;
}

/**
 * Reconciles an entitlement from the immutable local subscription order. Both
   * activation and payment webhooks call this because their delivery order is not
   * guaranteed by Stripe.
 */
export async function ensureSubscriptionEntitlement(input: {
  providerSubscriptionId: string;
  currentPeriodEnd?: string;
}): Promise<SubscriptionEntitlement | undefined> {
  const db = getDb();
  const existing = await db.query.subscriptionEntitlements.findFirst({
    where: and(
      eq(schema.subscriptionEntitlements.provider, 'stripe'),
      eq(schema.subscriptionEntitlements.providerSubscriptionId, input.providerSubscriptionId),
    ),
  });
  if (existing) {
    if (existing.status === 'active' && toDate(input.currentPeriodEnd)) {
      await db
        .update(schema.subscriptionEntitlements)
        .set({ currentPeriodEnd: toDate(input.currentPeriodEnd), updatedAt: new Date() })
        .where(eq(schema.subscriptionEntitlements.id, existing.id));
    }
    return existing;
  }

  const order = await db.query.paymentOrders.findFirst({
    where: and(
      eq(schema.paymentOrders.provider, 'stripe'),
      eq(schema.paymentOrders.providerOrderId, input.providerSubscriptionId),
      eq(schema.paymentOrders.kind, 'subscription'),
    ),
  });
  if (!order) return undefined;

  const snapshot = order.snapshot as unknown as SubscriptionSnapshot;
  const monthlyTsc = snapshot.monthlyTsc;
  if (!snapshot.code || typeof monthlyTsc !== 'number' || !Number.isInteger(monthlyTsc) || monthlyTsc <= 0) {
    throw new Error(`Invalid subscription snapshot for payment order ${order.id}`);
  }

  try {
    const [created] = await db
      .insert(schema.subscriptionEntitlements)
      .values({
        institutionId: order.institutionId,
        provider: 'stripe',
        providerSubscriptionId: input.providerSubscriptionId,
        planCode: snapshot.code,
        monthlyTsc,
        status: 'active',
        ...(toDate(input.currentPeriodEnd) ? { currentPeriodEnd: toDate(input.currentPeriodEnd) } : {}),
      })
      .returning({
        id: schema.subscriptionEntitlements.id,
        institutionId: schema.subscriptionEntitlements.institutionId,
        providerSubscriptionId: schema.subscriptionEntitlements.providerSubscriptionId,
        monthlyTsc: schema.subscriptionEntitlements.monthlyTsc,
        status: schema.subscriptionEntitlements.status,
      });
    if (!created) throw new Error(`Entitlement insert returned no row for payment order ${order.id}`);
    await db
      .update(schema.paymentOrders)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(schema.paymentOrders.id, order.id));
    return created;
  } catch (error) {
    if ((error as { code?: string }).code !== '23505') throw error;
    // Concurrent activation/payment workers raced to create the same entitlement.
    const winner = await db.query.subscriptionEntitlements.findFirst({
      where: and(
        eq(schema.subscriptionEntitlements.provider, 'stripe'),
        eq(schema.subscriptionEntitlements.providerSubscriptionId, input.providerSubscriptionId),
      ),
    });
    if (!winner) throw error;
    return winner;
  }
}

export async function grantSubscriptionPayment(input: {
  providerSubscriptionId: string;
  paymentId: string;
  nextBillingTime?: string;
}): Promise<{ handled: boolean; granted: number; alreadyApplied: boolean; blocked?: boolean }> {
  const entitlement = await ensureSubscriptionEntitlement({
    providerSubscriptionId: input.providerSubscriptionId,
    currentPeriodEnd: input.nextBillingTime,
  });
  if (!entitlement) {
    logger.info({ providerSubscriptionId: input.providerSubscriptionId }, 'Ignoring payment for unknown subscription');
    return { handled: false, granted: 0, alreadyApplied: false };
  }
  if (entitlement.status !== 'active') {
    return { handled: true, granted: 0, alreadyApplied: true, blocked: true };
  }
  // The invoice period identifies the subscription period. Payment ID is a safe
  // fallback when Stripe omits it, and remains stable across webhook retries.
  const period = input.nextBillingTime ?? input.paymentId;
  const result = await grantSubscriptionTsc({
    institutionId: entitlement.institutionId,
    subscriptionId: entitlement.providerSubscriptionId,
    period,
    monthlyTsc: entitlement.monthlyTsc,
    entitlementId: entitlement.id,
  });
  if (result.blocked) return { handled: true, ...result };
  const db = getDb();
  await db
    .update(schema.subscriptionEntitlements)
    .set({ lastGrantedPeriod: period, updatedAt: new Date() })
    .where(eq(schema.subscriptionEntitlements.id, entitlement.id));
  return { handled: true, ...result };
}

const stopStatusRank: Record<string, number> = {
  active: 0,
  payment_failed: 1,
  suspended: 2,
  expired: 3,
  cancelled: 4,
};

/** Stops future grants without changing prior lots, ledger entries, or certificates. */
export async function stopSubscriptionEntitlement(input: {
  providerSubscriptionId: string;
  status: 'cancelled' | 'suspended' | 'expired' | 'payment_failed';
}): Promise<{ handled: boolean; status?: string; idempotent: boolean }> {
  const entitlement = await ensureSubscriptionEntitlement({
    providerSubscriptionId: input.providerSubscriptionId,
  });
  if (!entitlement) return { handled: false, idempotent: false };
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${entitlement.institutionId}))`);
    const rows = await tx.execute<{ status: string }>(sql`
      SELECT status FROM ${schema.subscriptionEntitlements} WHERE id = ${entitlement.id} FOR UPDATE
    `);
    const current = (rows as unknown as Array<{ status: string }>)[0]?.status;
    if (!current) throw new Error(`Subscription entitlement ${entitlement.id} disappeared`);
    const nextRank = stopStatusRank[input.status] ?? 0;
    if ((stopStatusRank[current] ?? 0) >= nextRank) {
      return { handled: true, status: current, idempotent: true };
    }
    await tx
      .update(schema.subscriptionEntitlements)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(schema.subscriptionEntitlements.id, entitlement.id));
    return { handled: true, status: input.status, idempotent: false };
  });
}

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}
