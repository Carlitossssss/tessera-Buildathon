import { describe, expect, it } from 'vitest';
import {
  applyBillingDiscount,
  isSelfServeSubscriptionPlan,
  SUBSCRIPTION_PLANS,
  TSC_PACKAGES,
} from './catalog.js';

describe('server-owned TSC catalog', () => {
  it('contains the approved one-time packages and prices', () => {
    expect(TSC_PACKAGES).toEqual([
      {
        code: 'initial',
        name: 'Inicial',
        tsc: 200,
        priceCents: 20_000,
        currency: 'USD',
        discountBps: 1000,
        validityMonths: 12,
        pricingVersion: '2026-launch-v1',
        active: true,
      },
      {
        code: 'growth',
        name: 'Crecimiento',
        tsc: 500,
        priceCents: 50_000,
        currency: 'USD',
        discountBps: 1500,
        validityMonths: 12,
        pricingVersion: '2026-launch-v1',
        active: true,
      },
      {
        code: 'institutional',
        name: 'Institucional',
        tsc: 1000,
        priceCents: 100_000,
        currency: 'USD',
        discountBps: 2000,
        validityMonths: 12,
        pricingVersion: '2026-launch-v1',
        active: true,
      },
      {
        code: 'scale',
        name: 'Escala',
        tsc: 2000,
        priceCents: 200_000,
        currency: 'USD',
        discountBps: 2500,
        validityMonths: 12,
        pricingVersion: '2026-launch-v1',
        active: true,
      },
      {
        code: 'enterprise',
        name: 'Enterprise',
        tsc: 5000,
        priceCents: 500_000,
        currency: 'USD',
        discountBps: 3000,
        validityMonths: 12,
        pricingVersion: '2026-launch-v1',
        active: false,
      },
    ]);
    expect(
      TSC_PACKAGES.some((item: { code: string }) => item.code === 'browser-supplied-price'),
    ).toBe(false);
    expect(
      TSC_PACKAGES.map((bundle) => [
        bundle.code,
        applyBillingDiscount(bundle.priceCents, bundle.discountBps),
      ]),
    ).toEqual([
      ['initial', 18_000],
      ['growth', 42_500],
      ['institutional', 80_000],
      ['scale', 150_000],
      ['enterprise', 350_000],
    ]);
  });

  it('defines launch and normal subscription economics without browser input', () => {
    expect(
      SUBSCRIPTION_PLANS.map((plan) => [plan.code, plan.monthlyTsc, plan.monthlyPriceCents]),
    ).toEqual([
      ['essential', 200, 20_000],
      ['growth', 500, 50_000],
      ['institutional', 1000, 100_000],
      ['scale', 2000, 200_000],
      ['enterprise', 5000, 500_000],
    ]);
    expect(
      SUBSCRIPTION_PLANS.map((plan) => [
        plan.code,
        applyBillingDiscount(plan.monthlyPriceCents, plan.launchDiscountBps),
      ]),
    ).toEqual([
      ['essential', 10_000],
      ['growth', 22_500],
      ['institutional', 40_000],
      ['scale', 70_000],
      ['enterprise', 150_000],
    ]);
    expect(SUBSCRIPTION_PLANS.filter(isSelfServeSubscriptionPlan).map((plan) => plan.code)).toEqual(
      ['essential', 'growth', 'institutional', 'scale'],
    );
    expect(SUBSCRIPTION_PLANS.some((plan: { code: string }) => plan.code === 'enterprise')).toBe(
      true,
    );
    expect(SUBSCRIPTION_PLANS.find((plan) => plan.code === 'enterprise')?.active).toBe(false);
  });
});
