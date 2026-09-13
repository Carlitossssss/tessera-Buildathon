import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { PrivacyView } from './privacy-view';

export const metadata = { title: 'Privacidad \u00b7 Tessera' };

/**
 * Privacidad y datos del estudiante.
 *
 * Sigue siendo de servidor porque lee la sesion; el texto vive en la vista,
 * que si conoce el idioma activo.
 */
export default async function PrivacyPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (session.user.role !== 'student') redirect('/');

  return (
    <PrivacyView
      selectedName={session.user.name ?? session.user.email ?? ''}
      selectedDetail={session.user.email ?? ''}
    />
  );
}
