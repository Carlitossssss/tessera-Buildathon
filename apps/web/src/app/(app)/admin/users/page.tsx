import { adminApi } from '@/lib/api/endpoints/admin';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { AdminUsersView } from './admin-users-view';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ role?: string; status?: string; q?: string; page?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { token } = await requireSession();
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const limit = 15;
  const payload = (await safeFetch(() =>
    adminApi.users(token, {
      page,
      limit,
      role: params.role,
      status: params.status,
      q: params.q,
    }),
  )) ?? {
    totals: {
      total: 0,
      institutionAdmins: 0,
      restricted: 0,
      deleted: 0,
      pendingVerification: 0,
      deletionScheduled: 0,
      profilePending: 0,
    },
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

  return <AdminUsersView payload={payload} params={params} />;
}

