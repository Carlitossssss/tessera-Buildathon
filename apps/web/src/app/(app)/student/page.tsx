import { redirect } from 'next/navigation';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { studentApi } from '@/lib/api/endpoints/student';
import { auth } from '@/server/auth';
import { StudentHomeView } from './student-home-view';

/**
 * Inicio del estudiante.
 *
 * Sigue siendo de servidor porque lee la sesion; el texto, los plurales y el
 * formato de las fechas viven en la vista, que si conoce el idioma activo.
 */
export default async function StudentDashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (session.user.role !== 'student') {
    redirect(session.user.role === 'teacher' ? '/teacher' : '/institution');
  }
  const { token } = await requireSession();

  const dashboard = await safeFetch(() => studentApi.dashboard(token));

  return <StudentHomeView data={dashboard?.data ?? null} />;
}
