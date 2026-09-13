import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  entitlementQueries: vi.fn(),
  orderQueries: vi.fn(),
  insertValues: vi.fn(),
  updateWhere: vi.fn(),
  transactionExecute: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  getDb: () => ({
    query: {
      subscriptionEntitlements: { findFirst: state.entitlementQueries },
      paymentOrders: { findFirst: state.orderQueries },
    },
    insert: () => ({
      values: state.insertValues,
    }),
    update: () => ({
      set: () => ({ where: state.updateWhere }),
    }),
    transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        execute: state.transactionExecute,
        update: () => ({ set: () => ({ where: state.updateWhere }) }),
      }),
  }),
}));

const grantSubscriptionTsc = vi.hoisted(() => vi.fn());
vi.mock('../credits.js', () => ({ grantSubscriptionTsc }));

import { ensureSubscriptionEntitlement, grantSubscriptionPayment, stopSubscriptionEntitlement } from './subscriptions.js';

const order = {
  id: 'order-1',
  institutionId: 'institution-1',
  snapshot: { code: 'growth', monthlyTsc: 500 },
};
const entitlement = {
  id: 'entitlement-1',
  institutionId: 'institution-1',
  providerSubscriptionId: 'subscription-1',
  monthlyTsc: 500,
  status: 'active',
};

function setInsertResult() {
  state.insertValues.mockReturnValue({
    returning: vi.fn().mockResolvedValue([entitlement]),
  });
}

describe('subscription webhook ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setInsertResult();
    state.updateWhere.mockResolvedValue(undefined);
    state.transactionExecute.mockReset();
    grantSubscriptionTsc.mockResolvedValue({ granted: 500, alreadyApplied: false });
  });

  it('creates the entitlement and grants the initial period when payment arrives before activation', async () => {
    state.entitlementQueries.mockResolvedValueOnce(undefined).mockResolvedValueOnce(entitlement);
    state.orderQueries.mockResolvedValueOnce(order);

    await grantSubscriptionPayment({
      providerSubscriptionId: 'subscription-1',
      paymentId: 'payment-1',
      nextBillingTime: '2026-08-01T00:00:00Z',
    });
    await ensureSubscriptionEntitlement({
      providerSubscriptionId: 'subscription-1',
      currentPeriodEnd: '2026-08-01T00:00:00Z',
    });

    expect(state.insertValues).toHaveBeenCalledTimes(1);
    expect(grantSubscriptionTsc).toHaveBeenCalledTimes(1);
    expect(grantSubscriptionTsc).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      subscriptionId: 'subscription-1',
      period: '2026-08-01T00:00:00Z',
      monthlyTsc: 500,
      entitlementId: 'entitlement-1',
    });
  });

  it('grants one initial period when activation arrives before payment', async () => {
    state.entitlementQueries.mockResolvedValueOnce(undefined).mockResolvedValueOnce(entitlement);
    state.orderQueries.mockResolvedValueOnce(order);

    await ensureSubscriptionEntitlement({ providerSubscriptionId: 'subscription-1' });
    await grantSubscriptionPayment({
      providerSubscriptionId: 'subscription-1',
      paymentId: 'payment-1',
      nextBillingTime: '2026-08-01T00:00:00Z',
    });

    expect(state.insertValues).toHaveBeenCalledTimes(1);
    expect(grantSubscriptionTsc).toHaveBeenCalledTimes(1);
  });

  it('does not grant a payment period after the entitlement is cancelled', async () => {
    state.entitlementQueries.mockResolvedValueOnce({ ...entitlement, status: 'cancelled' });

    const result = await grantSubscriptionPayment({
      providerSubscriptionId: 'subscription-1',
      paymentId: 'payment-after-cancel',
      nextBillingTime: '2026-09-01T00:00:00Z',
    });

    expect(result).toMatchObject({ handled: true, blocked: true });
    expect(grantSubscriptionTsc).not.toHaveBeenCalled();
  });

  it('records a cancellation as a stop state without touching existing grants', async () => {
    state.entitlementQueries.mockResolvedValueOnce(entitlement);
    state.transactionExecute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ status: 'active' }]);

    const result = await stopSubscriptionEntitlement({
      providerSubscriptionId: 'subscription-1',
      status: 'cancelled',
    });

    expect(result).toEqual({ handled: true, status: 'cancelled', idempotent: false });
    expect(grantSubscriptionTsc).not.toHaveBeenCalled();
  });
});
