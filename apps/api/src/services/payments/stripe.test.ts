import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyStripeWebhook } from './stripe.js';

describe('verifyStripeWebhook', () => {
  it('accepts the exact signed Stripe payload', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const raw = '{"id":"evt_test","type":"checkout.session.completed"}';
    const signature = createHmac('sha256', 'whsec_test_tessera')
      .update(`${timestamp}.${raw}`, 'utf8')
      .digest('hex');

    expect(verifyStripeWebhook(`t=${timestamp},v1=${signature}`, raw)).toBe(true);
  });

  it('rejects a payload modified after signing', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const raw = '{"id":"evt_test"}';
    const signature = createHmac('sha256', 'whsec_test_tessera')
      .update(`${timestamp}.${raw}`, 'utf8')
      .digest('hex');

    expect(verifyStripeWebhook(`t=${timestamp},v1=${signature}`, '{"id":"evt_other"}')).toBe(false);
  });
});
