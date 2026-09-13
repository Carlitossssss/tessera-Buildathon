'use client';

import Link from 'next/link';
import { Check, Coins } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ShimmerButton } from '@/components/fx/shimmer-button';
import { BorderBeam } from '@/components/fx/border-beam';
import { AnimatedCounter } from '@/components/fx/animated-counter';
import { cn } from '@/lib/utils';
import { useT } from '@tessera/i18n';
import { applyBillingDiscount, plansFromCatalog, type PublicBillingCatalog } from '@/lib/plans';

interface PricingProps {
  variant?: 'section' | 'page';
  showHeader?: boolean;
  catalog?: PublicBillingCatalog | null;
}

export function Pricing({ variant = 'section', showHeader = true, catalog }: PricingProps) {
  const t = useT();
  const plans = plansFromCatalog(catalog);
  const packages = catalog?.packages?.filter((bundle) => bundle.active !== false) ?? [];
  const tscPerCertificate = catalog?.tscPerCertificate ?? 2;
  return (
    <section
      id="pricing"
      className={cn(
        'relative isolate border-b border-[var(--color-border)]',
        variant === 'section' ? 'py-28' : showHeader ? 'pt-32 pb-20' : 'pt-8 pb-20',
      )}
    >
      <div className="container-page">
        {showHeader ? (
          <header className="mx-auto max-w-2xl text-center">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-brand-200)]">
              {t.marketing.pricing.eyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-5xl">
              {t.marketing.pricing.title}
            </h2>
            <p className="mt-4 text-[var(--color-fg-muted)]">
              {t.marketing.pricing.body.replace('{tsc}', String(tscPerCertificate))}
            </p>
          </header>
        ) : null}

        <div
          className={cn(
            'grid justify-center gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),300px))] xl:grid-cols-4',
            showHeader ? 'mt-16' : 'mt-0',
          )}
        >
          {plans.map((plan, i) => {
            const discountPct = Math.round((plan.discountBps ?? 0) / 100);
            const showDiscount =
              discountPct > 0 &&
              plan.originalPriceMonthly !== null &&
              plan.originalPriceMonthly !== undefined &&
              plan.priceMonthly !== null &&
              plan.originalPriceMonthly > plan.priceMonthly;
            return (
              <motion.article
                key={plan.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
                className={cn(
                  'relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--color-bg-card)]/70 p-7 backdrop-blur',
                  plan.highlighted
                    ? 'border-[var(--color-brand-500)]/60 shadow-[var(--shadow-glow)]'
                    : 'border-[var(--color-border)]',
                )}
              >
                {plan.highlighted ? <BorderBeam duration={9} /> : null}

                <div className="flex items-start justify-between gap-3">
                  {plan.highlighted ? (
                    <span className="rounded-full bg-gradient-to-r from-[var(--color-brand-500)] to-[var(--color-accent-500)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#080d1a]">
                      {t.marketing.pricing.recommended}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                      {plan.name}
                    </span>
                  )}
                  {showDiscount ? (
                    <span className="shrink-0 rounded-full border border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-400)]">
                      {t.marketing.pricing.discount} {discountPct}%
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-4 text-2xl font-semibold text-[var(--color-fg)]">{plan.name}</h3>
                <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{plan.description}</p>

                <div className="mt-6">
                  {showDiscount ? (
                    <p className="mb-1 text-sm font-medium text-[var(--color-fg-subtle)] line-through">
                      USD {plan.originalPriceMonthly}
                      {t.marketing.pricing.perMonth}
                    </p>
                  ) : null}
                  <div className="flex items-baseline gap-1">
                    {plan.priceMonthly !== null ? (
                      <>
                        <span className="text-4xl font-semibold text-[var(--color-fg)]">
                          <AnimatedCounter to={plan.priceMonthly} prefix="USD " />
                        </span>
                        <span className="text-sm text-[var(--color-fg-muted)]">
                          {t.marketing.pricing.perMonth}
                        </span>
                      </>
                    ) : (
                      <span className="text-3xl font-semibold text-[var(--color-fg)]">
                        {t.marketing.pricing.custom}
                      </span>
                    )}
                  </div>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-[var(--color-fg-muted)]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-[var(--color-accent-500)]/15 text-[var(--color-accent-400)]">
                        <Check className="h-3 w-3" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  {plan.highlighted ? (
                    <ShimmerButton asChild className="w-full">
                      <Link href={plan.href as Parameters<typeof Link>[0]['href']}>{plan.cta}</Link>
                    </ShimmerButton>
                  ) : (
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={plan.href as Parameters<typeof Link>[0]['href']}>{plan.cta}</Link>
                    </Button>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>

        {packages.length > 0 ? (
          <section className="mt-14 border-t border-[var(--color-border)] pt-10">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-200)]">
                  {t.marketing.pricing.packages.eyebrow}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--color-fg)]">
                  {t.marketing.pricing.packages.title}
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-[var(--color-fg-muted)]">
                  {t.marketing.pricing.packages.body.replace(
                    '{tsc}',
                    String(tscPerCertificate),
                  )}
                </p>
              </div>
            </div>

            <div className="mt-6 grid justify-center gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),280px))] xl:grid-cols-4">
              {packages.map((bundle) => {
                const discountedPriceCents = applyBillingDiscount(
                  bundle.priceCents,
                  bundle.discountBps,
                );
                const discountPct = Math.round(bundle.discountBps / 100);
                const showDiscount =
                  bundle.discountBps > 0 && discountedPriceCents < bundle.priceCents;
                const estimatedCertificates = Math.floor(
                  bundle.tsc / Math.max(1, tscPerCertificate),
                );
                return (
                  <article
                    key={bundle.code}
                    className="relative flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)]/65 p-5 backdrop-blur"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
                        <Coins className="h-4 w-4" />
                      </span>
                      {showDiscount ? (
                        <span className="rounded-full border border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent-400)]">
                          {t.marketing.pricing.discount} {discountPct}%
                        </span>
                      ) : null}
                    </div>

                    <h4 className="mt-4 text-lg font-semibold text-[var(--color-fg)]">
                      {bundle.name}
                    </h4>
                    <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                      {bundle.tsc.toLocaleString('es')}{' '}
                      {t.marketing.pricing.packages.toIssue}
                    </p>

                    <div className="mt-5">
                      {showDiscount ? (
                        <p className="mb-1 text-sm font-medium text-[var(--color-fg-subtle)] line-through">
                          USD {Math.round(bundle.priceCents / 100)}
                        </p>
                      ) : null}
                      <p className="text-3xl font-semibold text-[var(--color-fg)]">
                        USD {Math.round(discountedPriceCents / 100)}
                      </p>
                    </div>

                    <ul className="mt-5 space-y-2 text-sm text-[var(--color-fg-muted)]">
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent-400)]" />
                        <span>
                          {estimatedCertificates.toLocaleString('es')}{' '}
                          {t.marketing.pricing.packages.estimated}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent-400)]" />
                        <span>
                          {t.marketing.pricing.packages.validity.replace(
                            '{months}',
                            String(bundle.validityMonths),
                          )}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent-400)]" />
                        <span>{t.marketing.pricing.packages.noRenewal}</span>
                      </li>
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
