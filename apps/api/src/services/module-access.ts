/**
 * Acceso al material de un modulo.
 *
 * Un curso puede cobrar de dos formas, y ambas conviven:
 *
 *   - Lock del CURSO   -> paga la entrada; abre la matricula y con ella todo.
 *   - Lock del MODULO  -> material premium dentro de un curso abierto.
 *
 * Esta es la logica que decide si el archivo sale del servidor. Un fallo aqui
 * no produce un error visible: regala material de pago. Por eso vive aparte,
 * sin base de datos ni red, y se prueba sola.
 */

/** Lo minimo que necesitamos de un modulo para decidir. */
export interface GatedModule {
  lockAddress: string | null;
  lockChainId: number | null;
}

/** Un modulo con Lock exige llave propia; sin el, hereda la del curso. */
export function moduleRequiresKey(mod: GatedModule): boolean {
  return Boolean(mod.lockAddress) && typeof mod.lockChainId === 'number';
}

export type MaterialDecision =
  /** Se entrega el archivo completo. */
  | { access: 'full'; reason: 'enrolled' | 'module-key' }
  /** Solo la muestra: existe material, pero hace falta llave. */
  | { access: 'preview'; reason: 'module-locked' }
  /** Ni muestra ni original: el curso entero esta cerrado. */
  | { access: 'none'; reason: 'course-locked' };

/**
 * Decide que se entrega de un modulo.
 *
 * El orden importa y no es arbitrario:
 *
 *  1. Sin matricula ni muestra del curso, no se entrega nada. La barrera del
 *     curso es la de fuera: si no se paso, el material interno ni se plantea.
 *  2. Un modulo sin Lock propio hereda el acceso del curso. Es el caso normal:
 *     quien esta matriculado ve todos los modulos.
 *  3. Un modulo CON Lock propio exige su llave aunque el visitante ya este
 *     matriculado. Eso es lo que permite vender material avanzado dentro de un
 *     curso gratuito; si la matricula lo abriera igual, el Lock del modulo no
 *     serviria para nada.
 */
export function decideMaterialAccess(input: {
  module: GatedModule;
  /** El visitante tiene matricula en el curso. */
  enrolledInCourse: boolean;
  /** El modulo esta dentro de los que el curso muestra sin membresia. */
  coursePreviewable: boolean;
  /** El visitante presento una llave valida del Lock de ESTE modulo. */
  hasModuleKey: boolean;
}): MaterialDecision {
  const gated = moduleRequiresKey(input.module);

  if (!input.enrolledInCourse && !input.coursePreviewable) {
    return { access: 'none', reason: 'course-locked' };
  }

  if (!gated) {
    // Sin Lock propio: manda el curso. Un modulo de muestra en un curso
    // cerrado se entrega completo, que es justo para lo que sirve la muestra.
    return { access: 'full', reason: 'enrolled' };
  }

  if (input.hasModuleKey) {
    return { access: 'full', reason: 'module-key' };
  }

  return { access: 'preview', reason: 'module-locked' };
}

export interface TopicAsset {
  assetKey: string | null;
  assetPreviewKey: string | null;
  assetMimeType: string | null;
  assetPreviewSeconds: number | null;
}

/**
 * Clave del archivo que corresponde entregar.
 *
 * Devuelve null cuando no hay nada que servir, para que quien llama responda
 * 402 o 404 en vez de leer una clave vacia del storage.
 */
export function assetKeyFor(topic: TopicAsset, decision: MaterialDecision): string | null {
  if (decision.access === 'full') return topic.assetKey;
  if (decision.access === 'preview') return topic.assetPreviewKey;
  return null;
}

/** Tipos de material admitidos y su familia, para elegir como previsualizar. */
export const MATERIAL_KINDS = ['video', 'audio', 'document'] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

/**
 * Clasifica un archivo por su mime type.
 *
 * La familia decide la forma de la muestra: los primeros segundos en audio y
 * video, la primera pagina en documentos. Un tipo desconocido no se acepta,
 * porque no sabriamos como recortarlo y terminariamos sirviendo el original.
 */
export function materialKindFor(mimeType: string | null | undefined): MaterialKind | null {
  if (!mimeType) return null;
  const mime = mimeType.toLowerCase().trim();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'document';
  return null;
}
