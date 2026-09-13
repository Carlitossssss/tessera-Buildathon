import { adminApi } from '@/lib/api/endpoints/admin';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { AdminCertificatesView } from './admin-certificates-view';

export const dynamic = 'force-dynamic';

export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { token } = await requireSession();
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const limit = 15;
  const payload = (await safeFetch(() => adminApi.certificates(token, { page, limit }))) ?? {
    totals: { total: 0, revoked: 0, issuedToday: 0 },
    summary: { byStatus: [], byInstitution: [] },
    pagination: {
      page: 1,
      limit,
      totalItems: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    data: [],
  };

  return <AdminCertificatesView payload={payload} />;
}

