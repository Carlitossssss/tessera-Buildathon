import { redirect } from 'next/navigation';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { studentApi } from '@/lib/api/endpoints/student';
import { auth } from '@/server/auth';
import { WalletView } from './wallet-view';

export const metadata = { title: 'Mi wallet \u00b7 Tessera' };

/**
 * Wallet del estudiante.
 *
 * Sigue siendo de servidor porque lee la sesion; el texto vive en la vista,
 * que si conoce el idioma activo.
 */
export default async function WalletPage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (session.user.role !== 'student') redirect('/');
  const { token } = await requireSession();

  const res = await safeFetch(() => studentApi.wallet(token));

  return <WalletView data={res?.data ?? null} />;
}
