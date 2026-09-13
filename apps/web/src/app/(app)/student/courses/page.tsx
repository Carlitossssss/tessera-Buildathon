import { redirect } from 'next/navigation';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { studentApi } from '@/lib/api/endpoints/student';
import { auth } from '@/server/auth';
import { StudentCoursesView } from './student-courses-view';

export const metadata = { title: 'Mis cursos \u00b7 Tessera' };

/**
 * Cursos del estudiante.
 *
 * Sigue siendo de servidor porque lee la sesion; el texto, los plurales y el
 * formato de las fechas viven en la vista, que si conoce el idioma activo.
 */
export default async function StudentCoursesPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (session.user.role !== 'student') {
    redirect(session.user.role === 'teacher' ? '/teacher' : '/institution');
  }
  const { token } = await requireSession();

  const res = await safeFetch(() => studentApi.courses(token));

  return (
    <StudentCoursesView
      courses={res?.data ?? []}
      totals={res?.totals ?? { total: 0, inProgress: 0, completed: 0, notStarted: 0 }}
    />
  );
}
