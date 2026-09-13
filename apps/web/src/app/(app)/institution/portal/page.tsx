import { redirect } from 'next/navigation';

/**
 * El portal de contenido se absorbió dentro de Cursos.
 *
 * Era una sección paralela que competía con el producto central: el material
 * académico —un video de clase, un audio, un PDF— pertenece a un temario de
 * un curso, no a una publicación suelta en otra ventana. Nunca llegó a usarse
 * (cero piezas publicadas) y obligaba a configurar el Lock dos veces.
 *
 * Toda su capacidad vive ahora en Cursos: material subible por temario y
 * membresía de Unlock tanto para la matrícula como para módulos premium.
 *
 * La ruta se conserva como redirección para no romper enlaces guardados.
 */
export default function InstitutionPortalPage() {
  redirect('/institution/courses');
}
