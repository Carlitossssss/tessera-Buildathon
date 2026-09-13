import { adminApi } from '@/lib/api/endpoints/admin';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { AdminInstitutionsView } from './admin-institutions-view';

export const dynamic = 'force-dynamic';

export default async function AdminInstitutionsPage() {
  const { token } = await requireSession();
  const payload = (await safeFetch(() => adminApi.institutions(token))) ?? {
    totals: { total: 0, approved: 0, pending: 0, certificates: 0 },
    data: [],
  };

  return <AdminInstitutionsView payload={payload} />;
}

