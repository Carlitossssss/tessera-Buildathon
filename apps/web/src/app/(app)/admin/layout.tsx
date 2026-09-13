import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { authApi } from '@/lib/api/endpoints/auth';
import { safeFetch } from '@/lib/dashboard';
import { AccountRestrictedScreen } from '../account-restricted-screen';
import { AutoRefresh } from '../auto-refresh';
import { AdminShellTitle } from './_components/admin-shell-title';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login?next=/admin');
  if (session.user.role !== 'admin') {
    redirect(session.user.role === 'student' ? '/student' : '/institution');
  }
  const current = session.accessToken
    ? await safeFetch(() => authApi.me(session.accessToken))
    : null;
  if (current?.user.restricted) {
    return (
      <AccountRestrictedScreen
        email={current.user.email}
        name={session.user.name}
        accountId={current.user.id}
        restrictedAt={current.user.restrictedAt}
        reason={current.user.restrictionReason}
      />
    );
  }
  return (
    <DashboardShell
      role="admin"
      user={{ name: session.user.name, email: session.user.email ?? '' }}
      title={<AdminShellTitle part="title" />}
      description={<AdminShellTitle part="description" />}
    >
      <AutoRefresh intervalMs={10000} />
      {children}
    </DashboardShell>
  );
}
