import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  CreditCard,
  RefreshCw,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import { meApi, type CreditBundleDto, type CreditsOverview } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch, formatNumber } from '@/lib/dashboard';
import { SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { CreditBundlesSection } from '@/components/sales/credit-bundles-section';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const REASON_LABEL: Record<string, string> = {
  purchase: 'Compra de bundle',
  emit: 'Emisión de certificado',
  refund: 'Reembolso por error',
  bonus: 'Bonificación',
  adjustment: 'Ajuste manual',
};

interface PageProps {
  searchParams?: Promise<{ stripe_checkout?: string }>;
}

export default async function CreditsPage({ searchParams }: PageProps) {
  const { token } = await requireSession();
  const checkout = (await searchParams)?.stripe_checkout;

  const [overview, bundlesResp] = await Promise.all([
    safeFetch<CreditsOverview>(() => meApi.credits(token)),
    safeFetch<{ bundles: CreditBundleDto[] }>(() => meApi.creditBundles(token)),
  ]);

  // Si la API no responde (todavía arrancando, migración pendiente, etc.)
  // mostramos un estado vacío en lugar de crashear.
  if (!overview || !bundlesResp) {
    return (
      <div className="space-y-6">
        <SectionHeading title="TSC" description="Cada certificado consume el costo TSC vigente." />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[var(--color-border)] py-16 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-fg-subtle)]">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-fg)]">
              Servicio no disponible temporalmente
            </p>
            <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
              La API TSC está inicializándose. Recarga la página en unos segundos.
            </p>
          </div>
          <Link
            href="/institution/credits"
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white/[0.03] px-4 py-2 text-xs font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-border-strong)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </Link>
        </div>
      </div>
    );
  }

  const bundles = bundlesResp.bundles;
  const balance = overview.balance;
  const noBalance = balance <= 0;
  const lowBalance = overview.lowBalance;
  const tscPerCertificate = overview.tscPerCertificate;
  const lowBalanceThreshold = tscPerCertificate * 10;

  return (
    <div className="space-y-8">
      <SectionHeading
        title="TSC"
        description={`TSC es saldo interno no transferible. Cada certificado consume exactamente ${formatNumber(
          tscPerCertificate,
        )} TSC.`}
        actions={
          <Link
            href="#bundles"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-border-strong)]"
          >
            <Coins className="h-3.5 w-3.5" />
            Comprar TSC
          </Link>
        }
      />

      {checkout === 'success' ? (
        <div className="rounded-2xl border border-[var(--color-brand-500)]/35 bg-[var(--color-brand-700)]/10 p-4 text-sm text-[var(--color-fg)]">
          Stripe confirmó tu pago. Estamos acreditando los TSC de forma segura; actualiza esta página
          en unos segundos si el saldo aún no cambió.
        </div>
      ) : checkout === 'cancelled' ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
          Cancelaste el checkout. No se realizó ningún cargo ni se acreditaron TSC.
        </div>
      ) : null}

      {noBalance ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="flex-1">
            <p className="font-medium text-amber-100">Sin saldo TSC</p>
            <p className="mt-1 text-xs text-amber-100/70">
              Tu saldo actual es 0 TSC. Compra un paquete para poder emitir nuevos certificados.
            </p>
          </div>
        </div>
      ) : lowBalance ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="flex-1">
            <p className="font-medium text-amber-100">Saldo bajo: te quedan {balance} TSC</p>
            <p className="mt-1 text-xs text-amber-100/70">
              Este aviso aparece cuando tienes menos de {formatNumber(lowBalanceThreshold)} TSC, el
              equivalente a 10 certificados con el costo vigente. Compra un paquete para evitar
              interrupciones.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Coins}
          label="Saldo disponible"
          value={formatNumber(balance)}
          hint={`${formatNumber(Math.floor(balance / tscPerCertificate))} certificados posibles`}
        />
        <StatCard
          icon={ArrowDownRight}
          label="Emitidos este mes"
          value={formatNumber(overview.emittedThisMonth)}
          hint={`${formatNumber(overview.emittedLast30Days)} en los últimos 30 días`}
        />
        <StatCard
          icon={TrendingDown}
          label="Consumo medio"
          value={`${overview.avgDailyConsumption.toFixed(1)} / día`}
          hint="Promedio últimos 30 días"
        />
        <StatCard
          icon={Sparkles}
          label="Autonomía estimada"
          value={
            overview.daysRemaining === null
              ? '—'
              : overview.daysRemaining > 365
                ? '> 1 año'
                : `${overview.daysRemaining} días`
          }
          hint={
            overview.daysRemaining === null ? 'Sin consumo reciente' : 'Al ritmo actual de emisión'
          }
        />
      </div>

      <CreditBundlesSection bundles={bundles} tscPerCertificate={tscPerCertificate} />

      {/* Última compra ───────────────────────────────────────────────── */}
      {overview.lastPurchase ? (
        <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-200)]">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
                Última compra
              </p>
              <p className="mt-1 text-sm text-[var(--color-fg)]">
                <span className="font-semibold tabular-nums">
                  {formatNumber(overview.lastPurchase.tsc)}
                </span>{' '}
                TSC
                {overview.lastPurchase.unitCostCents && overview.lastPurchase.currency
                  ? ` por ${formatPrice(overview.lastPurchase.unitCostCents, overview.lastPurchase.currency)}`
                  : ''}{' '}
                · {formatDate(overview.lastPurchase.createdAt)}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Movimientos ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--color-fg)]">Movimientos recientes</h2>

        {overview.ledger.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-fg-subtle)]">
            Aún no hay movimientos en tu cuenta TSC.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Concepto</th>
                  <th className="px-4 py-3 text-left font-medium">Detalle</th>
                  <th className="px-4 py-3 text-right font-medium">Movimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {overview.ledger.map((entry) => {
                  const isCredit = entry.delta > 0;
                  return (
                    <tr key={entry.id} className="text-[var(--color-fg)]">
                      <td className="px-4 py-3 text-[var(--color-fg-subtle)] tabular-nums">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3">{REASON_LABEL[entry.reason] ?? entry.reason}</td>
                      <td className="px-4 py-3 text-xs text-[var(--color-fg-subtle)]">
                        {entry.bundleCode
                          ? `Bundle ${entry.bundleCode.replace('bundle_', '')}`
                          : (entry.note ?? entry.referenceType ?? '—')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 font-medium tabular-nums',
                            isCredit ? 'text-emerald-300' : 'text-red-300',
                          )}
                        >
                          {isCredit ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          {isCredit ? '+' : ''}
                          {formatNumber(entry.delta)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
