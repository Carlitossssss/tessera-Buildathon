import { redirect } from 'next/navigation';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { studentApi } from '@/lib/api/endpoints/student';
import { auth } from '@/server/auth';
import { BadgesView } from './badges-view';

export const metadata = { title: 'Badges \u00b7 Tessera' };

/**
 * Badges del estudiante.
 *
 * Sigue siendo de servidor porque lee la sesion; el texto y el formato de las
 * fechas viven en la vista, que si conoce el idioma activo.
 */
export default async function BadgesPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (session.user.role !== 'student') redirect('/');
  const { token } = await requireSession();

  const res = await safeFetch(() => studentApi.badges(token));

  return <BadgesView items={res?.data ?? []} />;
}
