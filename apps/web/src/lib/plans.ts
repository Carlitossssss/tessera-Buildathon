import { Building2, Sparkles, Star, type LucideIcon } from 'lucide-react';

export type PlanId = 'essential' | 'growth' | 'institutional' | 'scale' | 'enterprise';

export interface TesseraPlan {
  id: PlanId;
  name: string;
  price: string;
  priceMonthly: number | null;
  originalPriceMonthly?: number | null;
  discountBps?: number;
  extraTscPriceCents?: number;
  minimumCommitmentMonths?: number;
  quota: number;
  rank: number;
  highlighted?: boolean;
  icon: LucideIcon;
  description: string;
  cta: string;
  href: string;
  features: string[];
}

export interface PublicBillingPlan {
  code: PlanId;
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

export interface PublicTscPackage {
  code: string;
  name: string;
  tsc: number;
  priceCents: number;
  discountBps: number;
  validityMonths: number;
  pricingVersion: string;
  currency: 'USD';
  active?: boolean;
}

export function applyBillingDiscount(priceCents: number, discountBps: number): number {
  const safePrice = Number.isFinite(priceCents) ? Math.max(0, Math.round(priceCents)) : 0;
  const safeDiscount = Number.isFinite(discountBps)
    ? Math.min(10_000, Math.max(0, Math.round(discountBps)))
    : 0;
  return Math.round(safePrice * ((10_000 - safeDiscount) / 10_000));
}

export interface PublicBillingCatalog {
  tscPerCertificate: number;
  tscNominalValueCents?: number;
  continuityReserveCents?: number;
  pricingVersion?: string;
  plans: PublicBillingPlan[];
  packages?: PublicTscPackage[];
}

export const TESSERA_PLANS: TesseraPlan[] = [
  {
    id: 'essential',
    name: 'Essential',
    price: 'USD 129/mes',
    priceMonthly: 129,
    quota: 100,
    rank: 0,
    icon: Sparkles,
    description: 'Para equipos que inician su operación.',
    cta: 'Elegir Essential',
    href: '/register?plan=starter',
    features: [
      '200 TSC/mes',
      '100 certificados estimados',
      'Verificación pública',
      'Soporte por email',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 'USD 279/mes',
    priceMonthly: 279,
    quota: 250,
    rank: 1,
    icon: Star,
    description: 'Para academias en crecimiento y bootcamps.',
    cta: 'Elegir Growth',
    href: '/register?plan=pro',
    highlighted: true,
    features: [
      '500 TSC/mes',
      '250 certificados estimados',
      'Webhooks firmados HMAC',
      'API + SDK TypeScript',
    ],
  },
  {
    id: 'institutional',
    name: 'Institutional',
    price: 'USD 499/mes',
    priceMonthly: 499,
    quota: 500,
    rank: 2,
    icon: Building2,
    description: 'Para instituciones con operación consolidada.',
    cta: 'Elegir Institutional',
    href: '/register?plan=pro_extended',
    features: [
      '1.000 TSC/mes',
      '500 certificados estimados',
      'Branding personalizado',
      'Soporte prioritario',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 'USD 899/mes',
    priceMonthly: 899,
    quota: 1000,
    rank: 3,
    icon: Building2,
    description: 'Para operaciones de emisión de alto volumen.',
    cta: 'Elegir Scale',
    href: '/register?plan=pro_extended',
    features: [
      '2.000 TSC/mes',
      '1.000 certificados estimados',
      'Soporte prioritario',
      'Capacidad ampliada',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Desde USD 1999/mes',
    priceMonthly: 1999,
    quota: 2500,
    rank: 4,
    icon: Building2,
    description: 'Para acuerdos institucionales de alto volumen.',
    cta: 'Contactar ventas',
    href: '/contacto',
    features: [
      'Desde 5.000 TSC/mes',
      'Desde 2.500 certificados estimados',
      'Condiciones contractuales',
      'Acompañamiento dedicado',
    ],
  },
];

export const PLAN_RANK = Object.fromEntries(
  TESSERA_PLANS.map((plan) => [plan.id, plan.rank]),
) as Record<PlanId, number>;

const legacyPlanToCatalog: Record<string, PlanId> = {
  starter: 'essential',
  pro: 'growth',
  pro_extended: 'institutional',
  enterprise: 'enterprise',
};

export function getPlan(planId: string | null | undefined) {
  const id = planId ? (legacyPlanToCatalog[planId] ?? planId) : 'essential';
  return TESSERA_PLANS.find((plan) => plan.id === id) ?? TESSERA_PLANS[0]!;
}

export function plansFromCatalog(catalog: PublicBillingCatalog | null | undefined): TesseraPlan[] {
  if (!catalog?.plans?.length) return TESSERA_PLANS;
  const byId = new Map(TESSERA_PLANS.map((plan) => [plan.id, plan]));
  return catalog.plans
    .filter((plan) => plan.active !== false)
    .map((plan) => {
      const base = byId.get(plan.code) ?? TESSERA_PLANS[0]!;
      const estimated = Math.floor(plan.monthlyTsc / Math.max(1, catalog.tscPerCertificate));
      const discountedPriceCents = applyBillingDiscount(
        plan.monthlyPriceCents,
        plan.launchDiscountBps,
      );
      return {
        ...base,
        id: plan.code,
        name: plan.name,
        price: `USD ${Math.round(discountedPriceCents / 100)}/mes`,
        priceMonthly: Math.round(discountedPriceCents / 100),
        originalPriceMonthly: Math.round(plan.monthlyPriceCents / 100),
        discountBps: plan.launchDiscountBps,
        extraTscPriceCents: plan.extraTscPriceCents,
        minimumCommitmentMonths: plan.minimumCommitmentMonths,
        quota: estimated,
        description: plan.description,
        features: [
          `${plan.monthlyTsc.toLocaleString('es')} TSC/mes`,
          `${estimated.toLocaleString('es')} certificados estimados`,
          `Compromiso mínimo: ${plan.minimumCommitmentMonths} meses`,
          `TSC adicional: USD ${(plan.extraTscPriceCents / 100).toLocaleString('es', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 3,
          })}`,
          ...base.features.slice(2),
        ],
      };
    });
}
