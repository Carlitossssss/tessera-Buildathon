import { adminApi } from '@/lib/api/endpoints/admin';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { AdminInstitutionDetailView } from './admin-institution-detail-view';
import { InstitutionNotFound } from './institution-not-found';

export const dynamic = 'force-dynamic';

export default async function AdminInstitutionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; synced?: string }>;
}) {
  const { token } = await requireSession();
  const { id } = await params;
  const { error, synced } = await searchParams;
  const institution = await safeFetch(() => adminApi.institution(token, id));

  if (!institution) {
    return <InstitutionNotFound />;
  }

  return <AdminInstitutionDetailView institution={institution} error={error} synced={synced} />;
}

