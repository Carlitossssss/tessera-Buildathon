import { redirect } from 'next/navigation';

/**
 * El portal público se absorbió dentro del catálogo de cursos.
 *
 * El recorrido token-gated —descubrir, previsualizar, verificar la membresía,
 * desbloquear— vive ahora en cada curso, que es donde el material académico
 * tiene sentido. Se conserva la ruta como redirección para no romper enlaces
 * ya compartidos.
 */
export default function PublicPortalPage() {
  redirect('/cursos');
}
