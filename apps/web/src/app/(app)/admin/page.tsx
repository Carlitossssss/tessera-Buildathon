import { adminApi } from '@/lib/api/endpoints/admin';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { AdminDashboardView } from './admin-dashboard-view';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const { token } = await requireSession();
  const [data, institutionsPayload, usersPayload] = await Promise.all([
    safeFetch(() => adminApi.dashboard(token)),
    safeFetch(() => adminApi.institutions(token)),
    safeFetch(() => adminApi.users(token, { page: 1, limit: 1 })),
  ]);
  const dashboard = data ?? {
    kpis: {
      activeInstitutions: 0,
      activeInstitutionsThisMonth: 0,
      certificates24h: 0,
      certificates24hDeltaPct: 0,
      openAlerts: 0,
      institutionsToReview: 0,
      institutionsToReviewThisMonth: 0,
      rejectedInstitutions: 0,
      rejectedInstitutionsThisWeek: 0,
      suspendedInstitutions: 0,
      suspendedInstitutionsThisMonth: 0,
      suspendedUsers: 0,
      suspendedUsersThisMonth: 0,
      failedCertificates: 0,
      failedCertificates24h: 0,
      failedWebhooks: 0,
      failedWebhooks24h: 0,
      suspensionReviewRequests: 0,
    },
    pendingInstitutions: [],
    suspensionReviewRequests: [],
  };

  return (
    <AdminDashboardView
      dashboard={dashboard}
      institutionsPayload={institutionsPayload}
      usersPayload={usersPayload}
    />
  );
}
