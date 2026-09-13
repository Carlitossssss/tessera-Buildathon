import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { authApi } from '@/lib/api/endpoints/auth';
import { meApi } from '@/lib/api/endpoints/me';
import { safeFetch } from '@/lib/dashboard';
import { AccountRestrictedScreen } from '../account-restricted-screen';
import { AutoRefresh } from '../auto-refresh';
import { InstitutionShellTitle } from './_components/institution-shell-title';

export const dynamic = 'force-dynamic';

export default async function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login?next=/institution');
  const role = session.user.role;
  if (role === 'teacher') redirect('/teacher');
  if (role !== 'institution_admin') {
    redirect(role === 'student' ? '/student' : '/admin');
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
  const me = session.accessToken
    ? await safeFetch(() => meApi.institution(session.accessToken!))
    : null;

  return (
    <DashboardShell
      role={role}
      user={{ name: session.user.name, email: session.user.email ?? '' }}
      title={<InstitutionShellTitle part="title" />}
      description={<InstitutionShellTitle part="description" />}
      institutionStatus={me?.institution.status ?? null}
      institutionAccessToken={session.accessToken}
      institutionProfileSubmittedAt={me?.institution.profileSubmittedAt ?? null}
    >
      <AutoRefresh intervalMs={10000} />
      {children}
    </DashboardShell>
  );
}
