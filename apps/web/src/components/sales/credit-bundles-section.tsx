import { ArrowRight, Building2, Info } from 'lucide-react';
import { BuyCreditsButton } from '@/components/dashboard/buy-credits-button';
import { formatNumber } from '@/lib/format';
import { applyBillingDiscount } from '@/lib/plans';
import { cn } from '@/lib/utils';
import type { CreditBundleDto } from '@/lib/api/endpoints/me';

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatUnitCost(
  priceCents: number,
  tsc: number,
  currency: string,
  tscPerCertificate: number,
) {
  const perCert = priceCents / (tsc / tscPerCertificate) / 100;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(perCert);
}

export function CreditBundlesSection({
  bundles,
  tscPerCertificate,
}: {
  bundles: CreditBundleDto[];
  tscPerCertificate: number;
}) {
  const validityMonths = Array.from(new Set(bundles.map((bundle) => bundle.validityMonths)));
  const validityText =
    validityMonths.length === 1
      ? `Los paquetes vencen ${validityMonths[0]} meses después de la compra.`
      : 'La vigencia se informa en cada paquete.';

  return (
    <section id="bundles" className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-fg)]">Recargar TSC</h2>
          <p className="mt-1 text-sm text-[var(--color-fg-subtle)]">
            TSC interno no transferible. {validityText}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {bundles.map((bundle) => {
          const isRecommended = bundle.highlight === 'recommended';
          const isBestValue = bundle.highlight === 'best_value';
          const discountedPriceCents = applyBillingDiscount(bundle.priceCents, bundle.discountBps);
          const discountPct = Math.round(bundle.discountBps / 100);
          const showDiscount = bundle.discountBps > 0 && discountedPriceCents < bundle.priceCents;
          return (
            <div
              key={bundle.code}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-white/[0.02] p-6 transition-colors',
                isRecommended
                  ? 'border-[var(--color-brand-400)] shadow-[0_0_0_1px_var(--color-brand-400)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
              )}
            >
              {isRecommended && (
                <span className="absolute -top-2 right-4 rounded-full bg-[var(--color-brand-500)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Recomendado
                </span>
              )}
              {isBestValue && (
                <span className="absolute -top-2 right-4 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Mejor valor
                </span>
              )}

              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-semibold tabular-nums text-[var(--color-fg)]">
                  {formatNumber(bundle.tsc)} TSC
                </p>
                <p className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
                  {bundle.name}
                </p>
              </div>

              <div className="mt-4">
                {showDiscount ? (
                  <div className="mb-1 flex items-center gap-2">
                    <p className="text-sm font-medium tabular-nums text-[var(--color-fg-subtle)] line-through">
                      {formatPrice(bundle.priceCents, bundle.currency)}
                    </p>
                    <span className="rounded-full border border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent-400)]">
                      -{discountPct}%
                    </span>
                  </div>
                ) : null}
                <p className="text-2xl font-semibold tabular-nums text-[var(--color-fg)]">
                  {formatPrice(discountedPriceCents, bundle.currency)}
                </p>
                <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
                  {formatUnitCost(
                    discountedPriceCents,
                    bundle.tsc,
                    bundle.currency,
                    tscPerCertificate,
                  )}{' '}
                  / certificado
                </p>
              </div>

              <ul className="mt-5 flex-1 space-y-2 text-xs text-[var(--color-fg-subtle)]">
                <li className="flex gap-2">
                  <span className="text-[var(--color-brand-300)]">✓</span>
                  {formatNumber(Math.floor(bundle.tsc / tscPerCertificate))} certificados
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--color-brand-300)]">✓</span>
                  Gas y almacenamiento incluidos
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--color-brand-300)]">✓</span>
                  Tu wallet sigue siendo el emisor on-chain
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--color-brand-300)]">✓</span>
                  Vence en {bundle.validityMonths} meses
                </li>
              </ul>

              <div className="mt-6">
                <BuyCreditsButton
                  bundleCode={bundle.code}
                  variant={isRecommended ? 'primary' : 'secondary'}
                  label={`Comprar ${formatNumber(bundle.tsc)} TSC`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-[var(--color-brand-500)]/35 bg-gradient-to-br from-[var(--color-brand-700)]/15 via-white/[0.02] to-transparent p-6">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[var(--color-brand-500)]/10 blur-3xl" />
        <div className="relative flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-brand-400)]/30 bg-[var(--color-brand-500)]/10 text-[var(--color-brand-200)]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-300)]">
                Volumen
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--color-fg)]">
                Volumen y condiciones a medida
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-[var(--color-fg-muted)]">
                Para grandes volúmenes, facturación empresarial, SLA y necesidades de integración
                específicas.
              </p>
            </div>
          </div>
          <a
            href="mailto:info@blokislabs.com?subject=Volumen%20Tessera"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-400)]/45 bg-[var(--color-brand-500)]/15 px-5 text-sm font-semibold text-[var(--color-brand-100)] transition hover:bg-[var(--color-brand-500)]/25"
          >
            Solicitar propuesta
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-3 text-xs text-[var(--color-fg-subtle)]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          1 TSC tiene valor nominal de USD 1 y cada certificado consume exactamente{' '}
          {formatNumber(tscPerCertificate)} TSC. Tessera cubre gas, metadata y reintentos
          operativos.
        </p>
      </div>
    </section>
  );
}
