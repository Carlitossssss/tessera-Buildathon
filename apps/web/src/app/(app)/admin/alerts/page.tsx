import { adminApi } from '@/lib/api/endpoints/admin';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { AdminAlertsView } from './admin-alerts-view';

export const dynamic = 'force-dynamic';

export default async function AdminAlertsPage() {
  const { token } = await requireSession();
  const payload = (await safeFetch(() => adminApi.alerts(token))) ?? {
    totals: { open: 0, errors: 0, warnings: 0 },
    data: [],
  };

  return <AdminAlertsView payload={payload} />;
}

