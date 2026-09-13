import { meApi } from '@/lib/api/endpoints/me';
import { safeFetch } from '@/lib/dashboard';
import { auth } from '@/server/auth';
import { PublicCoursesView } from './public-courses-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Catálogo de cursos · Tessera' };

/**
 * Catálogo público.
 *
 * Sigue siendo de servidor porque lee la sesión: el texto y el formato de los
 * números viven en la vista, que sí conoce el idioma activo.
 */
export default async function PublicCoursesPage() {
  const [result, session] = await Promise.all([safeFetch(() => meApi.publicCourses()), auth()]);

  return (
    <PublicCoursesView courses={result?.data ?? []} isSignedIn={Boolean(session?.user)} />
  );
}
