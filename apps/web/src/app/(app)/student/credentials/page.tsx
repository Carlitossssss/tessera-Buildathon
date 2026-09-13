import { redirect } from 'next/navigation';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { studentApi } from '@/lib/api/endpoints/student';
import { auth } from '@/server/auth';
import { CredentialsView } from './credentials-view';

export const metadata = { title: 'Mis credenciales \u00b7 Tessera' };

/**
 * Credenciales del estudiante.
 *
 * Sigue siendo de servidor porque lee la sesion; el texto y el formato de las
 * fechas viven en la vista, que si conoce el idioma activo.
 */
export default async function CredentialsPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (session.user.role !== 'student') redirect('/');
  const { token } = await requireSession();

  const res = await safeFetch(() => studentApi.certificates(token));

  return <CredentialsView items={res?.data ?? []} />;
}
