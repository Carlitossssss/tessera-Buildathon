import type { Metadata } from 'next';
import { auth } from '@/server/auth';
import { publicEnv } from '@/lib/env';
import { DevelopersDocs } from './developers-docs';

export const metadata: Metadata = {
  title: 'Documentación para desarrolladores',
  description: 'Referencia de la API de Tessera: autenticación, endpoints y webhooks firmados.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * La referencia vive dentro de /institution, de modo que el layout del
 * workspace ya garantiza sesion: un visitante anonimo es redirigido a /login
 * antes de que esta pagina se renderice.
 */
export default async function DevelopersPage() {
  const session = await auth();
  const baseUrl = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '');

  return <DevelopersDocs baseUrl={baseUrl} canOpenOpenApi={session?.user?.role !== 'student'} />;
}
