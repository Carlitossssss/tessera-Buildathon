'use client';

import { Coins, CreditCard, Settings2 } from 'lucide-react';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/dashboard/stat-card';
import { formatNumber } from '@/lib/format';
import { OperationalCard } from '../operational-card';
import { updateBillingCatalogAction } from '../actions';
import { SavedStatus } from './saved-status';
import type { adminApi } from '@/lib/api/endpoints/admin';

type Catalog = Awaited<ReturnType<typeof adminApi.billingCatalog>>;

const PLAN_CODES = ['essential', 'growth', 'institutional', 'scale', 'enterprise'] as const;
const PACKAGE_CODES = ['initial', 'growth', 'institutional', 'scale', 'enterprise'] as const;

function usd(cents: number) {
  return (cents / 100).toFixed(2);
}

function pct(bps: number) {
  return (bps / 100).toFixed(2).replace(/\.00$/, '');
}

export function AdminPlansView({ catalog, saved }: { catalog: Catalog; saved: boolean }) {
  const t = useT();
  const copy = t.admin.plans;
  const plansByCode = new Map(catalog.plans.map((plan) => [plan.code, plan]));
  const packagesByCode = new Map(catalog.packages.map((bundle) => [bundle.code, bundle]));
  const monthlyTsc = catalog.plans.reduce((sum, plan) => sum + plan.monthlyTsc, 0);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-4">
        <OperationalCard
          href="/admin/plans"
          value={`${formatNumber(catalog.tscPerCertificate)} TSC`}
          badge={copy.cards.costPerCertificate.badge}
          title={copy.cards.costPerCertificate.title}
          description={copy.cards.costPerCertificate.description}
        />
        <OperationalCard
          href="/admin/plans"
          value={`USD ${usd(catalog.tscNominalValueCents)}`}
          badge={copy.cards.tscValue.badge}
          title={copy.cards.tscValue.title}
          description={copy.cards.tscValue.description}
        />
        <OperationalCard
          href="/admin/plans"
          value={`USD ${usd(catalog.continuityReserveCents)}`}
          badge={copy.cards.continuity.badge}
          title={copy.cards.continuity.title}
          description={copy.cards.continuity.description}
        />
        <OperationalCard
          href="/admin/plans"
          value={formatNumber(monthlyTsc)}
          badge={copy.cards.monthlyTsc.badge}
          title={copy.cards.monthlyTsc.title}
          description={copy.cards.monthlyTsc.description}
        />
      </div>

      <form action={updateBillingCatalogAction} className="space-y-8">
        <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-500)]/15 text-[var(--color-brand-300)]">
              <Settings2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-fg)]">
                {copy.issuingConfig.title}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                {copy.issuingConfig.description}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <Field
              label={copy.fields.tscPerCertificate}
              name="tscPerCertificate"
              type="number"
              step="1"
              defaultValue={catalog.tscPerCertificate}
            />
            <Field
              label={copy.fields.tscNominalValueUsd}
              name="tscNominalValueUsd"
              type="number"
              step="0.01"
              defaultValue={usd(catalog.tscNominalValueCents)}
            />
            <Field
              label={copy.fields.continuityReserveUsd}
              name="continuityReserveUsd"
              type="number"
              step="0.01"
              defaultValue={usd(catalog.continuityReserveCents)}
            />
            <Field
              label={copy.fields.packageValidityMonths}
              name="packageValidityMonths"
              type="number"
              step="1"
              defaultValue={catalog.packageValidityMonths}
            />
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
                {copy.fields.currentVersion}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-[var(--color-fg)]">
                {catalog.pricingVersion}
              </p>
              <p className="mt-1 text-xs normal-case tracking-normal text-[var(--color-fg-subtle)]">
                {copy.fields.autoUpdateOnSave}
              </p>
            </div>
          </div>
        </section>

        <section>
          <SectionHeading
            title={copy.subscriptionPlans.title}
            description={copy.subscriptionPlans.description}
          />
          <div className="grid gap-4">
            {PLAN_CODES.map((code) => {
              const plan = plansByCode.get(code);
              return (
                <article
                  key={code}
                  className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-accent-500)]/15 text-[var(--color-accent-400)]">
                        <CreditCard className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--color-fg)]">
                          {plan?.name ?? code}
                        </h3>
                        <p className="text-xs text-[var(--color-fg-subtle)]">{code}</p>
                      </div>
                    </div>
                    <StatusSwitch
                      name={`plan.${code}.active`}
                      checked={plan?.active !== false}
                      label={copy.fields.status}
                      ariaLabel={copy.fields.toggleActive}
                    />
                  </div>
                  <div className="mt-5 grid gap-4 xl:grid-cols-6">
                    <Field label={copy.fields.name} name={`plan.${code}.name`} defaultValue={plan?.name} />
                    <Field
                      label={copy.fields.monthlyTsc}
                      name={`plan.${code}.monthlyTsc`}
                      type="number"
                      defaultValue={plan?.monthlyTsc}
                    />
                    <Field
                      label={copy.fields.monthlyPriceUsd}
                      name={`plan.${code}.monthlyPriceUsd`}
                      type="number"
                      step="0.01"
                      defaultValue={plan ? usd(plan.monthlyPriceCents) : undefined}
                    />
                    <Field
                      label={copy.fields.discountPct}
                      name={`plan.${code}.launchDiscountPct`}
                      type="number"
                      step="0.01"
                      defaultValue={plan ? pct(plan.launchDiscountBps ?? 0) : undefined}
                    />
                    <Field
                      label={copy.fields.extraTscPriceUsd}
                      name={`plan.${code}.extraTscPriceUsd`}
                      type="number"
                      step="0.001"
                      defaultValue={plan ? (plan.extraTscPriceCents / 100).toFixed(3) : undefined}
                    />
                    <Field
                      label={copy.fields.commitmentMonths}
                      name={`plan.${code}.minimumCommitmentMonths`}
                      type="number"
                      step="1"
                      defaultValue={plan?.minimumCommitmentMonths ?? 12}
                    />
                  </div>
                  <div className="mt-4">
                    <TextAreaField
                      label={copy.fields.description}
                      name={`plan.${code}.description`}
                      defaultValue={plan?.description}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section>
          <SectionHeading
            title={copy.tscPackages.title}
            description={copy.tscPackages.description}
          />
          <div className="grid gap-4">
            {PACKAGE_CODES.map((code) => {
              const bundle = packagesByCode.get(code);
              return (
                <article
                  key={code}
                  className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-brand-500)]/15 text-[var(--color-brand-300)]">
                        <Coins className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--color-fg)]">
                          {bundle?.name ?? code}
                        </h3>
                        <p className="text-xs text-[var(--color-fg-subtle)]">{code}</p>
                      </div>
                    </div>
                    <StatusSwitch
                      name={`package.${code}.active`}
                      checked={bundle?.active !== false}
                      label={copy.fields.status}
                      ariaLabel={copy.fields.toggleActive}
                    />
                  </div>
                  <div className="mt-5 grid gap-4 lg:grid-cols-4">
                    <Field
                      label={copy.fields.name}
                      name={`package.${code}.name`}
                      defaultValue={bundle?.name}
                    />
                    <Field
                      label={copy.fields.tsc}
                      name={`package.${code}.tsc`}
                      type="number"
                      defaultValue={bundle?.tsc}
                    />
                    <Field
                      label={copy.fields.priceUsd}
                      name={`package.${code}.priceUsd`}
                      type="number"
                      step="0.01"
                      defaultValue={bundle ? usd(bundle.priceCents) : undefined}
                    />
                    <Field
                      label={copy.fields.discountPct}
                      name={`package.${code}.discountPct`}
                      type="number"
                      step="0.01"
                      defaultValue={bundle ? pct(bundle.discountBps) : undefined}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <SavedStatus show={saved} label={copy.saved} />
          <Button type="submit">{copy.save}</Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: 'text' | 'number';
  step?: string;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
      {label}
      <input
        name={name}
        type={type}
        step={step}
        min={type === 'number' ? 0 : undefined}
        defaultValue={defaultValue}
        className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm normal-case tracking-normal text-[var(--color-fg)] outline-none focus:border-[var(--color-brand-500)]"
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={3}
        className="mt-2 min-h-[96px] w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-3 text-sm normal-case leading-relaxed tracking-normal text-[var(--color-fg)] outline-none focus:border-[var(--color-brand-500)]"
      />
    </label>
  );
}

function StatusSwitch({
  name,
  checked,
  label,
  ariaLabel,
}: {
  name: string;
  checked: boolean;
  label: string;
  ariaLabel: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-fg-muted)]">
      <span>{label}</span>
      <input
        name={name}
        type="checkbox"
        defaultChecked={checked}
        className="peer sr-only"
        aria-label={ariaLabel}
      />
      <span className="relative h-6 w-11 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-[var(--color-fg-muted)] after:transition-transform peer-checked:border-[var(--color-accent-500)]/60 peer-checked:bg-[var(--color-accent-500)]/90 peer-checked:after:translate-x-5 peer-checked:after:bg-[var(--color-bg)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-accent-400)]" />
    </label>
  );
}
