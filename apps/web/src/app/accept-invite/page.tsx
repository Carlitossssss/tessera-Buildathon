import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { authApi, ApiError } from '@/lib/api/endpoints/auth';

export const dynamic = 'force-dynamic';

function roleHome(role: string | undefined | null) {
  if (role === 'teacher') return '/teacher';
  if (role === 'institution_admin') return '/institution';
  if (role === 'admin') return '/admin';
  return '/student';
}

function invitationDestination(role: string | undefined | null, courseId?: string | null) {
  if (courseId) {
    return role === 'institution_admin'
      ? `/institution/courses/${courseId}`
      : `/teacher/courses/${courseId}`;
  }
  return role === 'institution_admin' ? '/institution' : '/teacher/profile';
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams?: Promise<{ invite?: string; role?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const invite = params.invite;
  const session = await auth();

  if (!invite) {
    redirect(roleHome(session?.user?.role));
  }
  if (!session?.accessToken) {
    redirect(`/login?role=${params.role ?? 'teacher'}&invite=${encodeURIComponent(invite)}`);
  }

  const role = session.user?.role;
  if (role !== 'teacher' && role !== 'institution_admin') {
    redirect(roleHome(role));
  }

  const accepted = await authApi.acceptTeacherInvitation(invite, session.accessToken).catch((err) => {
    const message =
      err instanceof ApiError ? err.message : 'No pudimos aceptar la invitación';
    redirect(
      `/login?role=teacher&invite=${encodeURIComponent(invite)}&reauth=1&error=${encodeURIComponent(
        message,
      )}`,
    );
  });
  redirect(invitationDestination(role, accepted.courseId));
}
