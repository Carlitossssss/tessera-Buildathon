import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { getPlan } from '@/lib/plans';
import { InstitutionDashboardView } from './institution-dashboard-view';

export const dynamic = 'force-dynamic';

export default async function InstitutionDashboardPage() {
  const { token } = await requireSession();

  const [stats, credits, certs, me, subscriptionResponse] = await Promise.all([
    safeFetch(() => meApi.stats(token)),
    safeFetch(() => meApi.credits(token)),
    safeFetch(() => meApi.certificates(token, { limit: 5 })),
    safeFetch(() => meApi.institution(token)),
    safeFetch(() => meApi.subscriptions(token)),
  ]);

  const activeSubscription =
    subscriptionResponse?.subscriptions.find((item) => item.status === 'active') ?? null;
  const planLabel = activeSubscription ? getPlan(activeSubscription.planCode).name : null;
  const quota = activeSubscription
    ? Math.floor(activeSubscription.monthlyTsc / (credits?.tscPerCertificate ?? 2))
    : null;
  const usedThisMonth = stats?.certificates.issuedThisMonth ?? 0;
  const quotaPct =
    quota && quota > 0 ? Math.min(100, Math.round((usedThisMonth / quota) * 100)) : 0;

  return (
    <InstitutionDashboardView
      stats={stats}
      credits={credits}
      certs={certs}
      me={me}
      planLabel={planLabel ?? ''}
      quota={quota}
      usedThisMonth={usedThisMonth}
      quotaPct={quotaPct}
      hasActiveSubscription={Boolean(activeSubscription)}
    />
  );
}

