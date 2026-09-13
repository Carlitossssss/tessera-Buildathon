import { adminApi } from '@/lib/api/endpoints/admin';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { AdminUserDetailView } from './admin-user-detail-view';
import { UserNotFound } from './user-not-found';

export const dynamic = 'force-dynamic';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { token } = await requireSession();
  const { id } = await params;
  const user = await safeFetch(() => adminApi.user(token, id));

  if (!user) {
    return <UserNotFound />;
  }

  return <AdminUserDetailView user={user} />;
}

