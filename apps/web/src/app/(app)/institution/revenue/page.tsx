import Link from 'next/link';
import { DollarSign, Info, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { formatNumber, requireSession, safeFetch } from '@/lib/dashboard';
import { getPlan } from '@/lib/plans';

export const dynamic = 'force-dynamic';

function formatMoney(cents: number, currency: string) {
  const value = cents / 100;
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatMonth(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
}

export default async function RevenuePage() {
  const { token } = await requireSession();
  const data = await safeFetch(() => meApi.revenueSummary(token));

  if (!data) {
    return (
      <EmptyState
        icon={DollarSign}
        title="Ingresos no disponibles"
        description="No pudimos cargar la información de ingresos. Verifica que la API esté disponible."
      />
    );
  }

  const { activePlanCode, monetizationEnabled, splits, currency, currentMonth, periods } = data;
  const activePlanName = activePlanCode ? getPlan(activePlanCode).name : null;

  if (!monetizationEnabled) {
    return (
      <div className="space-y-8">
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div className="text-[var(--color-fg-muted)]">
            <strong className="text-[var(--color-fg)]">Sin suscripción activa:</strong> todavía no
            tienes monetización de cursos habilitada. Contrata un plan para vender cursos en
            plataforma con cobro vía Stripe.
          </div>
        </div>
        <EmptyState
          icon={DollarSign}
          title="Activa la monetización de cursos"
          description="Cuando tengas una suscripción activa, los ingresos de cursos pagos y sus distribuciones aparecerán aquí."
          action={
            <Button asChild>
              <Link href="/institution/plan">Ver planes</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Sin pagos aún
  if (!currentMonth || periods.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div className="text-[var(--color-fg-muted)]">
            <strong className="text-[var(--color-fg)]">
              Cómo funciona{activePlanName ? ` (${activePlanName})` : ''}:
            </strong>{' '}
            El procesador cobra al estudiante y retiene ~{splits.processorFeePct}% de fee. Del neto, Tessera
            retiene {splits.tesseraSharePct}% y tu institución recibe {splits.institutionSharePct}%
            en el payout mensual.
          </div>
        </div>
        <EmptyState
          icon={Wallet}
          title="Aún no hay ventas registradas"
          description="Cuando tus estudiantes paguen cursos, los ingresos y distribuciones aparecerán aquí automáticamente."
          action={
            <Button asChild variant="secondary">
              <Link href="/institution/courses">Gestionar cursos</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const prevMonth = periods[1];
  const grossDelta =
    prevMonth && prevMonth.grossCents > 0
      ? Math.round(((currentMonth.grossCents - prevMonth.grossCents) / prevMonth.grossCents) * 100)
      : null;

  // próximo payout: día 1 del mes siguiente
  const nextPayout = (() => {
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  })();

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Ingresos este mes"
          value={formatMoney(currentMonth.grossCents, currency)}
          icon={DollarSign}
          trend={
            grossDelta !== null
              ? { delta: `${grossDelta >= 0 ? '+' : ''}${grossDelta}%`, positive: grossDelta >= 0 }
              : undefined
          }
          hint={`bruto · ${formatNumber(currentMonth.paidCount)} pagos`}
        />
        <StatCard
          label="Tu payout este mes"
          value={formatMoney(currentMonth.institutionPayoutCents, currency)}
          icon={TrendingUp}
          hint={`${splits.institutionSharePct}% del neto tras el procesador`}
        />
        <StatCard
          label="Próximo payout"
          value={nextPayout}
          icon={Wallet}
          hint="Transferencia o wallet vinculada"
        />
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <div className="text-[var(--color-fg-muted)]">
          <strong className="text-[var(--color-fg)]">
            Cómo se calcula tu payout{activePlanName ? ` (${activePlanName})` : ''}:
          </strong>{' '}
          Stripe procesa el cobro al estudiante y retiene {splits.processorFeePct}%
          de fee. Del monto neto, Tessera retiene {splits.tesseraSharePct}% y tu institución recibe{' '}
          {splits.institutionSharePct}% en el payout mensual.
        </div>
      </div>

      <section>
        <SectionHeading
          title="Historial mensual"
          description="Distribuciones calculadas a partir de pagos confirmados."
        />
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
              <tr>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Pagos</th>
                <th className="px-4 py-3 font-medium text-right">Bruto</th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">
                  Fee procesador
                </th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">
                  Fee Tessera
                </th>
                <th className="px-4 py-3 font-medium text-right">Tu payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
              {periods.map((p) => (
                <tr key={p.month} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-[var(--color-fg)] font-medium capitalize">
                    {formatMonth(p.month)}
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    {formatNumber(p.paidCount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatMoney(p.grossCents, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono hidden sm:table-cell text-red-400">
                    -{formatMoney(p.processorFeeCents, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono hidden md:table-cell text-red-400">
                    -{formatMoney(p.tesseraFeeCents, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400 font-semibold">
                    {formatMoney(p.institutionPayoutCents, p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
