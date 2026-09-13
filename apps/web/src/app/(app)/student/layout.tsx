import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { authApi } from '@/lib/api/endpoints/auth';
import { safeFetch } from '@/lib/dashboard';
import { AccountRestrictedScreen } from '../account-restricted-screen';
import { AutoRefresh } from '../auto-refresh';
import { ProfileCompletionGate } from '../profile-completion-gate';
import { StudentShellTitle } from './_components/student-shell-title';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login?next=/student');
  if (session.user.role !== 'student') {
    redirect(session.user.role === 'admin' ? '/admin' : '/institution');
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
      role="student"
      user={{ name: session.user.name, email: session.user.email ?? '' }}
      title={<StudentShellTitle part="title" />}
      description={<StudentShellTitle part="description" />}
      userProfileStatus={current?.user.profile?.status ?? null}
    >
      <AutoRefresh intervalMs={10000} />
      <ProfileCompletionGate role="student" profile={current?.user.profile} />
      {children}
    </DashboardShell>
  );
}
