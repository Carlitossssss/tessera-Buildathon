import { redirect } from 'next/navigation';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { authApi } from '@/lib/api/endpoints/auth';
import { studentApi } from '@/lib/api/endpoints/student';
import { auth } from '@/server/auth';
import { ProfileView } from './profile-view';

export const metadata = { title: 'Mi perfil \u00b7 Tessera' };

/**
 * Perfil del estudiante.
 *
 * Sigue siendo de servidor porque lee la sesion; el texto y el formato de las
 * fechas viven en la vista, que si conoce el idioma activo.
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (session.user.role !== 'student') redirect('/');
  const { token } = await requireSession();

  const [res, current] = await Promise.all([
    safeFetch(() => studentApi.profile(token)),
    safeFetch(() => authApi.me(token)),
  ]);

  return <ProfileView data={res?.data ?? null} profile={current?.user.profile ?? null} />;
}
