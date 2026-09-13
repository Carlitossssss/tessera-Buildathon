import { eq, schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { errors } from '@tessera/shared/errors';
import { grantPaymentTsc } from '../credits.js';
import {
  applyBillingDiscount,
  getPricingVersion,
  getTscNominalValueCents,
  getTscPerCertificate,
} from './catalog.js';
import { getStripeCheckoutSession, type StripeCheckoutSession } from './stripe.js';

type PackageSnapshot = {
  code: string;
  name: string;
  tsc: number;
  priceCents: number;
  currency: 'USD';
  discountBps?: number;
  validityMonths?: number;
  pricingVersion?: string;
};

function assertPaidStripeSession(session: StripeCheckoutSession, snapshot: PackageSnapshot) {
  const expectedAmountCents = applyBillingDiscount(snapshot.priceCents, snapshot.discountBps ?? 0);
  if (
    session.mode !== 'payment' ||
    session.payment_status !== 'paid' ||
    session.currency?.toUpperCase() !== snapshot.currency ||
    session.amount_total !== expectedAmountCents
  ) {
    throw errors.validation({ payment: ['Stripe no confirmó el importe esperado'] });
  }
}

/** Fulfills only Stripe-confirmed Checkout Sessions; browser redirects are never trusted. */
export async function fulfillStripePackageCheckout(sessionId: string) {
  const session = await getStripeCheckoutSession(sessionId);
  const paymentOrderId = session.metadata.paymentOrderId;
  if (!paymentOrderId) throw errors.validation({ payment: ['Checkout Stripe sin orden interna'] });
  const db = getDb();
  const paymentOrder = await db.query.paymentOrders.findFirst({
    where: eq(schema.paymentOrders.id, paymentOrderId),
  });
  if (
    !paymentOrder ||
    paymentOrder.provider !== 'stripe' ||
    paymentOrder.kind !== 'package'
  )
    throw errors.notFound('Orden de pago');
  const snapshot = paymentOrder.snapshot as PackageSnapshot;
  if (paymentOrder.status === 'captured') return { paymentOrder, alreadyCaptured: true };
  if (
    session.client_reference_id !== paymentOrder.id ||
    session.metadata.catalogCode !== paymentOrder.catalogCode ||
    session.metadata.institutionId !== paymentOrder.institutionId
  ) {
    throw errors.validation({ payment: ['Checkout Stripe no corresponde a esta orden'] });
  }
  assertPaidStripeSession(session, snapshot);
  await db
    .update(schema.paymentOrders)
    .set({ providerOrderId: session.id, status: 'captured', capturedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.paymentOrders.id, paymentOrder.id));
  const [tscNominalValueCents, certificateCostTsc, pricingVersion] = await Promise.all([
    getTscNominalValueCents(),
    getTscPerCertificate(),
    getPricingVersion(),
  ]);
  const amountPaidCents = applyBillingDiscount(snapshot.priceCents, snapshot.discountBps ?? 0);
  const nominalValueCents = snapshot.tsc * tscNominalValueCents;
  const discountCents = Math.max(0, nominalValueCents - amountPaidCents);
  const discountBps =
    typeof snapshot.discountBps === 'number'
      ? snapshot.discountBps
      : nominalValueCents > 0
        ? Math.round((discountCents / nominalValueCents) * 10_000)
        : 0;
  const grant = await grantPaymentTsc({
    institutionId: paymentOrder.institutionId,
    paymentOrderId: paymentOrder.id,
    packageCode: snapshot.code,
    tsc: snapshot.tsc,
    amountCents: amountPaidCents,
    currency: snapshot.currency,
    nominalValueCents,
    discountCents,
    discountBps,
    pricingVersion: snapshot.pricingVersion ?? pricingVersion,
    certificateCostTsc,
    validityMonths: snapshot.validityMonths,
  });
  return { paymentOrder, alreadyCaptured: grant.alreadyApplied };
}
