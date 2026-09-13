import { adminApi } from '@/lib/api/endpoints/admin';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { AdminSuspensionRequestsView } from './admin-suspension-requests-view';

export const dynamic = 'force-dynamic';

export default async function AdminSuspensionRequestsPage() {
  const { token } = await requireSession();
  const payload = (await safeFetch(() => adminApi.suspensionRequests(token))) ?? {
    totals: { total: 0, open: 0, reviewed: 0 },
    data: [],
  };

  return <AdminSuspensionRequestsView payload={payload} />;
}

