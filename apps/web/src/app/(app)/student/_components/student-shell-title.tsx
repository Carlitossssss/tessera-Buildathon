'use client';

import { useT } from '@tessera/i18n';

/**
 * Titulo y descripcion del shell del estudiante.
 *
 * Existe como componente aparte porque el layout es de servidor: convertirlo
 * entero a cliente por dos frases costaria mas de lo que resuelve.
 */
export function StudentShellTitle({ part }: { part: 'title' | 'description' }) {
  const t = useT();
  return <>{part === 'title' ? t.student.layout.title : t.student.layout.description}</>;
}
