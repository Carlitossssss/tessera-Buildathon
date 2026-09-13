import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { authApi } from '@/lib/api/endpoints/auth';
import { safeFetch } from '@/lib/dashboard';
import { AccountRestrictedScreen } from '../account-restricted-screen';
import { AutoRefresh } from '../auto-refresh';
import { ProfileCompletionGate } from '../profile-completion-gate';

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login?next=/teacher');
  const role = session.user.role;
  if (role !== 'teacher') {
    redirect(
      role === 'institution_admin' ? '/institution' : role === 'student' ? '/student' : '/admin',
    );
  }
  const current = session.accessToken ? await safeFetch(() => authApi.me(session.accessToken!)) : null;
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
      role="teacher"
      user={{ name: session.user.name, email: session.user.email ?? '' }}
      title="Espacio del docente"
      description="Calificaciones, contenido y seguimiento de tus estudiantes"
      institutionSuspensionReason={null}
      userProfileStatus={current?.user.profile?.status ?? null}
    >
      <AutoRefresh intervalMs={10000} />
      <ProfileCompletionGate role="teacher" profile={current?.user.profile} />
      {children}
    </DashboardShell>
  );
}
