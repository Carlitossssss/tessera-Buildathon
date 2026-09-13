import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

const stripeUrl = 'https://api.stripe.com/v1';

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
  mode: 'payment' | 'subscription';
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string>;
  client_reference_id: string | null;
  payment_intent: string | null;
  subscription: string | null;
}

export interface StripeSubscription {
  id: string;
  status: string;
  current_period_end?: number;
}

export interface StripePrice {
  id: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  recurring: { interval: string; interval_count: number } | null;
}

interface StripeProduct {
  id: string;
  active: boolean;
  default_price: string | StripePrice | null;
}

function authorization() {
  return `Bearer ${env.STRIPE_SECRET_KEY}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${stripeUrl}${path}`, {
    ...init,
    headers: { Authorization: authorization(), ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Stripe ${response.status}: ${await response.text()}`);
  return (await response.json()) as T;
}

export async function createStripeCheckoutSession(input: {
  mode: 'payment' | 'subscription';
  priceId: string;
  paymentOrderId: string;
  catalogCode: string;
  institutionId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeCheckoutSession> {
  const body = new URLSearchParams({
    mode: input.mode,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    locale: 'es-419',
    client_reference_id: input.paymentOrderId,
    'line_items[0][price]': input.priceId,
    'line_items[0][quantity]': '1',
    'metadata[paymentOrderId]': input.paymentOrderId,
    'metadata[catalogCode]': input.catalogCode,
    'metadata[institutionId]': input.institutionId,
  });
  if (input.mode === 'payment') {
    body.set('payment_intent_data[metadata][paymentOrderId]', input.paymentOrderId);
  } else {
    body.set('subscription_data[metadata][paymentOrderId]', input.paymentOrderId);
    body.set('subscription_data[metadata][catalogCode]', input.catalogCode);
    body.set('subscription_data[metadata][institutionId]', input.institutionId);
  }
  return request('/checkout/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

export const getStripeCheckoutSession = (sessionId: string) =>
  request<StripeCheckoutSession>(`/checkout/sessions/${encodeURIComponent(sessionId)}`);

export const getStripePrice = (priceId: string) =>
  request<StripePrice>(`/prices/${encodeURIComponent(priceId)}`);

/** Accept a Price ID directly, or resolve a Product ID to its active default Price. */
export async function resolveStripePrice(priceOrProductId: string): Promise<StripePrice> {
  if (priceOrProductId.startsWith('price_')) return getStripePrice(priceOrProductId);
  if (!priceOrProductId.startsWith('prod_')) {
    throw new Error('Stripe price configuration must start with price_ or prod_');
  }
  const product = await request<StripeProduct>(`/products/${encodeURIComponent(priceOrProductId)}`);
  const defaultPrice = typeof product.default_price === 'string' ? product.default_price : product.default_price?.id;
  if (!product.active || !defaultPrice) {
    throw new Error(`Stripe product ${product.id} has no active default Price`);
  }
  return getStripePrice(defaultPrice);
}

export const cancelStripeSubscription = (subscriptionId: string) =>
  request<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: 'DELETE' });

/** Stripe signs the unmodified UTF-8 payload as `${timestamp}.${payload}`. */
export function verifyStripeWebhook(signature: string | undefined, rawBody: string): boolean {
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) return false;
  const values = signature.split(',').reduce<Record<string, string[]>>((result, value) => {
    const [key, candidate] = value.split('=', 2);
    if (key && candidate) (result[key] ??= []).push(candidate);
    return result;
  }, {});
  const timestamp = values.t?.[0];
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
  return (values.v1 ?? []).some((candidate) => {
    const received = Buffer.from(candidate, 'hex');
    const local = Buffer.from(expected, 'hex');
    return received.length === local.length && timingSafeEqual(received, local);
  });
}
