'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getPlan,
  PLAN_RANK,
  plansFromCatalog,
  type PlanId,
  type PublicBillingCatalog,
} from '@/lib/plans';
import {
  cancelSubscriptionAction,
  startSubscriptionCheckoutAction,
} from '../actions';
import type { SubscriptionEntitlementDto } from '@/lib/api/endpoints/me';

interface Props {
  currentPlan: string | null;
  used: number;
  quota: number;
  institutionName: string;
  catalog: PublicBillingCatalog;
  subscription: SubscriptionEntitlementDto | null;
}

export function PlanClient({
  currentPlan,
  used,
  quota,
  institutionName,
  catalog,
  subscription,
}: Props) {
  const usedPct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const [target, setTarget] = useState<PlanId | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancellation, setConfirmCancellation] = useState(false);
  const router = useRouter();

  function handleSubmit(form: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await startSubscriptionCheckoutAction(form);
      if (res.ok && res.data) {
        window.location.assign(res.data.checkoutUrl);
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  }

  const current = currentPlan ? getPlan(currentPlan).id : null;
  const availablePlans = plansFromCatalog(catalog);
  const currentPlanView = current
    ? (availablePlans.find((plan) => plan.id === current) ?? getPlan(current))
    : null;
  const targetPlanView = target
    ? (availablePlans.find((plan) => plan.id === target) ?? getPlan(target))
    : null;
  const targetPlanName = targetPlanView?.name ?? '';

  function cancelSubscription() {
    if (!subscription) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelSubscriptionAction(subscription.providerSubscriptionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmCancellation(false);
      router.refresh();
    });
  }
  return (
    <div className="space-y-8">
      {/* Uso actual */}
      <section className="rounded-2xl border border-[var(--color-brand-500)]/30 bg-gradient-to-br from-[var(--color-brand-700)]/15 to-transparent p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[var(--color-fg)]">Plan actual</h3>
              <Badge variant={currentPlanView ? 'brand' : 'default'}>
                {currentPlanView ? currentPlanView.name.toUpperCase() : 'SIN SUSCRIPCIÓN ACTIVA'}
              </Badge>
            </div>
            {currentPlanView ? (
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                Has emitido {used.toLocaleString('es-PE')} de {quota.toLocaleString('es-PE')}{' '}
                certificados este mes.
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                Contrata una suscripción para activar cuota mensual, facturación y beneficios del
                plan.
              </p>
            )}
          </div>
          <a
            href="mailto:facturacion@tessera.app?subject=Gestión%20de%20facturación%20-%20Tessera"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-white/[0.04] px-4 text-sm font-semibold text-[var(--color-fg)] transition hover:bg-white/[0.07]"
          >
            Gestionar facturación
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
        {currentPlanView ? (
          <>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className={`h-full rounded-full transition-all ${
                  usedPct >= 90 ? 'bg-amber-500' : 'bg-[var(--color-brand-500)]'
                }`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--color-fg-subtle)]">
              {usedPct}% utilizado · Renueva el día 1 de cada mes (UTC).
              {usedPct >= 90 && ' · Considera ampliar tu plan.'}
            </p>
          </>
        ) : (
          <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-4 text-xs text-[var(--color-fg-subtle)]">
            Aún no existe una cuota mensual asociada a tu workspace.
          </div>
        )}
      </section>

      {/* Plans grid */}
      <div>
        <h3 className="text-base font-semibold text-[var(--color-fg)]">Planes disponibles</h3>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          Elige el plan que se ajuste al volumen de certificados que emites cada mes.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {availablePlans.map((p) => {
          const Icon = p.icon;
          const isCurrent = p.id === current;
          const isUpgrade = current ? PLAN_RANK[p.id] > PLAN_RANK[current] : true;
          const discountPct = Math.round((p.discountBps ?? 0) / 100);
          const showDiscount =
            discountPct > 0 &&
            p.originalPriceMonthly !== null &&
            p.originalPriceMonthly !== undefined &&
            p.priceMonthly !== null &&
            p.originalPriceMonthly > p.priceMonthly;
          const ctaLabel = isCurrent
            ? 'Plan actual'
            : current
              ? isUpgrade
                ? 'Cambiar a este plan'
                : 'Bajar a este plan'
              : 'Contratar este plan';
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl border p-6 transition-colors ${
                p.highlighted
                  ? 'border-[var(--color-brand-500)]/50 bg-gradient-to-br from-[var(--color-brand-700)]/10 to-transparent'
                  : 'border-[var(--color-border)] bg-white/[0.02]'
              } ${isCurrent ? 'ring-1 ring-[var(--color-brand-500)]/40' : ''}`}
            >
              {isCurrent && (
                <Badge variant="brand" className="absolute right-4 top-4">
                  Actual
                </Badge>
              )}
              {p.highlighted && !isCurrent ? (
                <Badge variant="accent" className="absolute right-4 top-4">
                  Recomendado
                </Badge>
              ) : null}
              {showDiscount && !isCurrent && !p.highlighted ? (
                <span className="absolute right-4 top-4 rounded-full border border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-400)]">
                  Descuento - {discountPct}%
                </span>
              ) : null}
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
                <Icon className="h-4 w-4" />
              </div>
              <h4 className="mt-3 text-lg font-semibold text-[var(--color-fg)]">{p.name}</h4>
              <div className="mt-1 text-sm text-[var(--color-fg-muted)]">
                {showDiscount ? (
                  <p className="text-xs line-through">USD {p.originalPriceMonthly}/mes</p>
                ) : null}
                <p>{p.price}</p>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-xs text-[var(--color-fg-muted)]">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent-400)]" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                disabled={isCurrent}
                onClick={() => setTarget(p.id)}
                className="mt-6 w-full"
                variant={isCurrent ? 'secondary' : p.highlighted ? 'primary' : 'secondary'}
              >
                {ctaLabel}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Stripe billing */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6 text-sm">
        <h3 className="text-base font-semibold text-[var(--color-fg)]">Sobre la facturación</h3>
        <p className="mt-2 text-[var(--color-fg-muted)]">
          Tessera utiliza{' '}
          <a
            href="https://stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand-300)] hover:underline"
          >
            Stripe
          </a>{' '}
          procesa el pago. Los impuestos y la factura aplicable dependen de la configuración de tu
          cuenta.
        </p>
        {subscription ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
            <div>
              <p className="font-medium text-[var(--color-fg)]">
                Suscripción{' '}
                {availablePlans.find((plan) => plan.id === subscription.planCode)?.name ??
                  getPlan(subscription.planCode).name}
              </p>
              <p className="text-xs text-[var(--color-fg-subtle)]">Estado: activa</p>
            </div>
            <Button variant="secondary" onClick={() => setConfirmCancellation(true)}>
              Cancelar suscripción
            </Button>
          </div>
        ) : null}
      </section>

      {/* Diálogo: confirmar cambio */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-fg)]">
                  Cambiar a {targetPlanName}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                  Abrirás el checkout seguro de Stripe para confirmar la suscripción con tarjeta u
                  otro método disponible para tu país.
                </p>
              </div>
              <button
                onClick={() => {
                  setTarget(null);
                  setError(null);
                }}
                className="rounded-lg p-1 text-[var(--color-fg-subtle)] hover:bg-white/5 hover:text-[var(--color-fg)]"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form action={handleSubmit} className="mt-5 space-y-4">
              <input type="hidden" name="targetPlan" value={target} />
              <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-4 text-xs text-[var(--color-fg-muted)]">
                <div className="flex items-center justify-between">
                  <span>Institución</span>
                  <strong className="text-[var(--color-fg)]">{institutionName}</strong>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span>Plan actual</span>
                  <strong className="text-[var(--color-fg)]">
                    {currentPlanView?.name ?? 'Sin suscripción activa'}
                  </strong>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span>Plan solicitado</span>
                  <strong className="text-[var(--color-brand-300)]">{targetPlanName}</strong>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setTarget(null);
                    setError(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" loading={pending}>
                    Ir al pago seguro
                  </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmCancellation && subscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--color-fg)]">¿Cancelar suscripción?</h3>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
              Se detendrán los próximos abonos mensuales. Tus TSC ya acreditados y certificados
              emitidos se conservarán.
            </p>
            {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmCancellation(false)}>
                Mantener suscripción
              </Button>
              <Button variant="secondary" loading={pending} onClick={cancelSubscription}>
                Confirmar cancelación
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
