import { SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { formatNumber, requireSession, safeFetch } from '@/lib/dashboard';
import { PlanClient } from './plan-client';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const { token } = await requireSession();
  const [me, subscriptionResponse, catalogResponse, credits, stats] = await Promise.all([
    safeFetch(() => meApi.institution(token)),
    safeFetch(() => meApi.subscriptions(token)),
    safeFetch(() => meApi.subscriptionCatalog(token)),
    safeFetch(() => meApi.credits(token)),
    safeFetch(() => meApi.stats(token)),
  ]);

  const activeSubscription =
    subscriptionResponse?.subscriptions.find((item) => item.status === 'active') ?? null;
  const currentPlan = activeSubscription?.planCode ?? null;
  const used = stats?.certificates.issuedThisMonth ?? 0;
  const quota = activeSubscription
    ? Math.floor(activeSubscription.monthlyTsc / (credits?.tscPerCertificate ?? 2))
    : 0;
  const remaining = activeSubscription ? Math.max(0, quota - used) : 0;

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Plan & facturación"
        description="Tessera procesa pagos mediante Stripe."
      />

      {activeSubscription ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Cuota disponible" value={formatNumber(remaining)} />
          <StatCard label="Emitidos este mes" value={formatNumber(used)} />
          <StatCard label="Cuota mensual" value={formatNumber(quota)} />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5 text-sm text-[var(--color-fg-muted)]">
          No hay una suscripción activa. Contrata un plan para habilitar cuota mensual y beneficios
          de facturación.
        </div>
      )}

      <PlanClient
        currentPlan={currentPlan}
        used={used}
        quota={quota}
        institutionName={me?.institution.name ?? ''}
        catalog={{
          tscPerCertificate: credits?.tscPerCertificate ?? 2,
          plans: catalogResponse?.plans ?? [],
        }}
        subscription={activeSubscription}
      />
    </div>
  );
}
