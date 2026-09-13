import type { schema } from '@tessera/db';

/**
 * Reglas de previsualizacion y acceso de los cursos token-gated.
 *
 * Vive aparte de las rutas porque es la logica que decide que ve alguien sin
 * membresia. Un fallo aqui no da error: simplemente regala contenido de pago.
 * Aislada se puede probar sin base de datos, sin red y sin blockchain.
 *
 * La regla de fondo: el temario (titulos, duracion, orden) es catalogo y se
 * muestra siempre --si no, nadie sabria que esta comprando--. El contenido de
 * los modulos es lo que se protege, y solo salen los de previsualizacion.
 */

type Course = typeof schema.courses.$inferSelect;

/** Lo minimo que necesitamos de un curso para decidir. */
export interface GatedCourse {
  visibility: Course['visibility'];
  lockAddress: string | null;
  lockChainId: number | null;
  previewModuleCount: number;
  /**
   * Si el acceso ya concedido caduca con la membresia. Opcional para que las
   * filas anteriores a la columna --y las pruebas que no la declaran-- sigan
   * comportandose como perpetuas, que es el valor por defecto en la base.
   */
  accessMode?: Course['accessMode'];
}

/** Un curso token-gated exige llave; el resto de modos no pasan por Unlock. */
export function requiresMembership(course: Pick<GatedCourse, 'visibility'>): boolean {
  return course.visibility === 'token_gated';
}

/**
 * Un curso token-gated sin Lock no puede abrirse nunca. La base lo impide con
 * un CHECK, pero lo comprobamos igual antes de prometer acceso: si alguna vez
 * entrara una fila asi, preferimos negar el acceso a colgar la matricula.
 */
export function isGateUsable(course: GatedCourse): boolean {
  if (!requiresMembership(course)) return true;
  return Boolean(course.lockAddress) && typeof course.lockChainId === 'number';
}

/**
 * Cuantos modulos se muestran completos sin membresia.
 *
 * Se acota al numero real de modulos para que un valor mal configurado no
 * prometa mas de lo que existe, y nunca baja de cero.
 */
export function previewModuleLimit(course: GatedCourse, totalModules: number): number {
  if (!requiresMembership(course)) return totalModules;
  const configured = Number.isFinite(course.previewModuleCount) ? course.previewModuleCount : 0;
  return Math.max(0, Math.min(configured, totalModules));
}

export interface ModuleLike {
  id: string;
  orderIndex: number;
}

/**
 * Marca cada modulo como previsualizable o bloqueado.
 *
 * Se decide por posicion en el temario, no por el indice guardado: si una
 * institucion numera sus modulos desde 10, o deja huecos al borrar uno, la
 * previsualizacion debe seguir siendo "los primeros N" y no depender de como
 * quedaron los numeros.
 */
export function markPreviewable<T extends ModuleLike>(
  course: GatedCourse,
  modules: T[],
): Array<T & { previewable: boolean }> {
  const ordered = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
  const limit = previewModuleLimit(course, ordered.length);
  return ordered.map((m, position) => ({ ...m, previewable: position < limit }));
}

/**
 * Decide si el contenido de un modulo puede viajar al cliente.
 *
 * Lo que hace la matricula depende del modo de acceso del curso:
 *
 *   perpetual     la matricula basta para siempre. Es un pago unico, y una
 *                 entrada comprada no se invalida al vencer nada.
 *   subscription  la matricula abre la puerta, pero la llave tiene que seguir
 *                 viva. Es lo que convierte a Unlock en una suscripcion de
 *                 verdad: su expirationDuration existe para cortar el acceso,
 *                 y sin esto una membresia mensual se comportaba como pago
 *                 unico --se pagaba un mes y el curso quedaba para siempre--.
 *
 * `keyStillValid` solo se mira en modo suscripcion. Vale `undefined` cuando no
 * se pudo leer el Lock: ante un RPC caido se mantiene el acceso de quien ya
 * estaba matriculado, porque cerrarle el curso por un fallo nuestro es peor
 * que dejarlo abierto un rato de mas.
 */
export function canSeeModuleContent(input: {
  course: GatedCourse;
  enrolled: boolean;
  previewable: boolean;
  keyStillValid?: boolean;
}): boolean {
  if (!requiresMembership(input.course)) return true;

  if (input.enrolled) {
    if (input.course.accessMode !== 'subscription') return true;
    // Una lectura fallida (undefined) no cierra el curso; solo un false, que
    // es una respuesta del contrato diciendo que la llave vencio.
    if (input.keyStillValid === false) return input.previewable;
    return true;
  }

  return input.previewable;
}
