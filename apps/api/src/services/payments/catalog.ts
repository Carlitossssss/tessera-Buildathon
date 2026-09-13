import { asc, eq } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';

export interface TscPackage {
  code: 'initial' | 'growth' | 'institutional' | 'scale' | 'enterprise';
  name: string;
  tsc: number;
  priceCents: number;
  currency: 'USD';
  discountBps: number;
  validityMonths: number;
  pricingVersion: string;
  active?: boolean;
}

export const TSC_PACKAGES: readonly TscPackage[] = [
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
] as const;

export interface SubscriptionPlan {
  code: 'essential' | 'growth' | 'institutional' | 'scale' | 'enterprise';
  name: string;
  description: string;
  monthlyTsc: number;
  monthlyPriceCents: number;
  launchDiscountBps: number;
  extraTscPriceCents: number;
  minimumCommitmentMonths: number;
  pricingVersion: string;
  active?: boolean;
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    code: 'essential',
    name: 'Essential',
    description: 'Para equipos que inician su operación.',
    monthlyTsc: 200,
    monthlyPriceCents: 20_000,
    launchDiscountBps: 5000,
    extraTscPriceCents: 75,
    minimumCommitmentMonths: 12,
    pricingVersion: '2026-launch-v1',
    active: true,
  },
  {
    code: 'growth',
    name: 'Growth',
    description: 'Para academias en crecimiento y bootcamps.',
    monthlyTsc: 500,
    monthlyPriceCents: 50_000,
    launchDiscountBps: 5500,
    extraTscPriceCents: 70,
    minimumCommitmentMonths: 12,
    pricingVersion: '2026-launch-v1',
    active: true,
  },
  {
    code: 'institutional',
    name: 'Institutional',
    description: 'Para instituciones con operación consolidada.',
    monthlyTsc: 1000,
    monthlyPriceCents: 100_000,
    launchDiscountBps: 6000,
    extraTscPriceCents: 62.5,
    minimumCommitmentMonths: 12,
    pricingVersion: '2026-launch-v1',
    active: true,
  },
  {
    code: 'scale',
    name: 'Scale',
    description: 'Para operaciones de emisión de alto volumen.',
    monthlyTsc: 2000,
    monthlyPriceCents: 200_000,
    launchDiscountBps: 6500,
    extraTscPriceCents: 55,
    minimumCommitmentMonths: 12,
    pricingVersion: '2026-launch-v1',
    active: true,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Para acuerdos institucionales de alto volumen.',
    monthlyTsc: 5000,
    monthlyPriceCents: 500_000,
    launchDiscountBps: 7000,
    extraTscPriceCents: 45,
    minimumCommitmentMonths: 12,
    pricingVersion: '2026-launch-v1',
    active: false,
  },
] as const;

export const DEFAULT_TSC_PER_CERTIFICATE = 2;
export const DEFAULT_TSC_NOMINAL_VALUE_CENTS = 100;
export const DEFAULT_CONTINUITY_RESERVE_CENTS = 10;
export const DEFAULT_PACKAGE_VALIDITY_MONTHS = 12;
export const DEFAULT_PRICING_VERSION = '2026-launch-v1';

export function applyBillingDiscount(priceCents: number, discountBps: number): number {
  const safePrice = Number.isFinite(priceCents) ? Math.max(0, Math.round(priceCents)) : 0;
  const safeDiscount = Number.isFinite(discountBps)
    ? Math.min(10_000, Math.max(0, Math.round(discountBps)))
    : 0;
  return Math.round(safePrice * ((10_000 - safeDiscount) / 10_000));
}

function isTscPackageCode(code: string): code is TscPackage['code'] {
  return ['initial', 'growth', 'institutional', 'scale', 'enterprise'].includes(code);
}

function isSubscriptionPlanCode(code: string): code is SubscriptionPlan['code'] {
  return ['essential', 'growth', 'institutional', 'scale', 'enterprise'].includes(code);
}

export async function getTscPackages({ includeInactive = false } = {}): Promise<TscPackage[]> {
  const db = getDb();
  const rows = await db.query.billingTscPackages.findMany({
    orderBy: [asc(schema.billingTscPackages.sortOrder)],
  });
  const mapped = rows
    .filter((row) => includeInactive || row.active === 1)
    .filter((row) => isTscPackageCode(row.code))
    .map((row) => ({
      code: row.code as TscPackage['code'],
      name: row.name,
      tsc: row.tsc,
      priceCents: row.priceCents,
      currency: 'USD' as const,
      discountBps: row.discountBps,
      validityMonths: row.validityMonths,
      pricingVersion: row.pricingVersion,
      active: row.active === 1,
    }));
  return mapped.length > 0
    ? mapped
    : TSC_PACKAGES.filter((item) => includeInactive || item.active !== false).map((item) => ({
        ...item,
      }));
}

export async function getSubscriptionPlans({ includeInactive = false } = {}): Promise<
  SubscriptionPlan[]
> {
  const db = getDb();
  const rows = await db.query.billingPlans.findMany({
    orderBy: [asc(schema.billingPlans.sortOrder)],
  });
  const mapped = rows
    .filter((row) => includeInactive || row.active === 1)
    .filter((row) => isSubscriptionPlanCode(row.code))
    .map((row) => ({
      code: row.code as SubscriptionPlan['code'],
      name: row.name,
      description: row.description,
      monthlyTsc: row.monthlyTsc,
      monthlyPriceCents: row.monthlyPriceCents,
      launchDiscountBps: row.launchDiscountBps,
      extraTscPriceCents: row.extraTscPriceMilliCents / 1000,
      minimumCommitmentMonths: row.minimumCommitmentMonths,
      pricingVersion: row.pricingVersion,
      active: row.active === 1,
    }));
  return mapped.length > 0
    ? mapped
    : SUBSCRIPTION_PLANS.filter((item) => includeInactive || item.active !== false).map((item) => ({
        ...item,
      }));
}

export async function findTscPackage(code: string): Promise<TscPackage | undefined> {
  return (await getTscPackages()).find((item) => item.code === code);
}

export async function findSubscriptionPlan(code: string): Promise<SubscriptionPlan | undefined> {
  return (await getSubscriptionPlans()).find((item) => item.code === code);
}

export function isSelfServeSubscriptionPlan(plan: SubscriptionPlan): boolean {
  return plan.monthlyTsc > 0 && plan.active !== false;
}

export async function getTscPerCertificate(): Promise<number> {
  const db = getDb();
  const row = await db.query.billingSettings.findFirst({
    where: eq(schema.billingSettings.key, 'certificate_tsc_cost'),
  });
  const value = row?.value?.tsc;
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : DEFAULT_TSC_PER_CERTIFICATE;
}

async function getBillingSettingNumber(
  key: string,
  property: string,
  fallback: number,
): Promise<number> {
  const db = getDb();
  const row = await db.query.billingSettings.findFirst({
    where: eq(schema.billingSettings.key, key),
  });
  const value = row?.value?.[property];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export async function getTscNominalValueCents(): Promise<number> {
  return getBillingSettingNumber(
    'tsc_nominal_value_cents',
    'cents',
    DEFAULT_TSC_NOMINAL_VALUE_CENTS,
  );
}

export async function getContinuityReserveCents(): Promise<number> {
  return getBillingSettingNumber(
    'continuity_reserve_cents',
    'cents',
    DEFAULT_CONTINUITY_RESERVE_CENTS,
  );
}

export async function getPackageValidityMonths(): Promise<number> {
  return getBillingSettingNumber(
    'package_validity_months',
    'months',
    DEFAULT_PACKAGE_VALIDITY_MONTHS,
  );
}

export async function getPricingVersion(): Promise<string> {
  const db = getDb();
  const row = await db.query.billingSettings.findFirst({
    where: eq(schema.billingSettings.key, 'pricing_version'),
  });
  const value = row?.value?.version;
  return typeof value === 'string' && value.trim() ? value : DEFAULT_PRICING_VERSION;
}
