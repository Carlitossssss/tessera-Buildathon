import { adminApi } from '@/lib/api/endpoints/admin';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { AdminPlansView } from './admin-plans-view';

export const dynamic = 'force-dynamic';

export default async function AdminPlansPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { token } = await requireSession();
  const catalog = (await safeFetch(() => adminApi.billingCatalog(token))) ?? {
    tscPerCertificate: 2,
    tscNominalValueCents: 100,
    continuityReserveCents: 10,
    packageValidityMonths: 12,
    pricingVersion: '2026-launch-v1',
    plans: [],
    packages: [],
  };

  return <AdminPlansView catalog={catalog} saved={params.saved === '1'} />;
}

