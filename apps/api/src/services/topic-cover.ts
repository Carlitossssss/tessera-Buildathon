import sharp from 'sharp';

/**
 * Portada de un temario, en sus dos versiones.
 *
 * Un vídeo o un audio no se pueden recortar en el servidor: haría falta
 * ffmpeg, un binario de sistema que no está en la imagen. La portada resuelve
 * lo mismo y mejor —es lo que muestran las plataformas de cursos: una imagen
 * con el título y la duración—, porque comunica de qué va la clase sin
 * entregar un solo byte del material de pago.
 *
 * Se derivan dos imágenes del original y ninguna es el original:
 *
 *   nítida      la ve quien tiene llave
 *   difuminada  la ve quien todavía no la tiene
 *
 * El desenfoque se aplica aquí, sobre los píxeles, y no con CSS en el
 * navegador. Un `filter: blur()` es decorativo: se quita desde el inspector y
 * la imagen nítida llega igual. Éste no se puede deshacer, porque la
 * información ya no está en el archivo que se sirve.
 */

/** Formatos que aceptamos como portada. */
const COVER_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/** Ancho al que se normaliza la portada. Suficiente para una tarjeta grande
 *  sin guardar archivos de varios megas por temario. */
const COVER_WIDTH = 1280;

/** Ancho de la difuminada. Más pequeña a propósito: nadie va a ampliarla, pesa
 *  menos y reducir antes de desenfocar destruye todavía más detalle. */
const BLUR_WIDTH = 640;

/**
 * Radio del desenfoque.
 *
 * Alto de forma deliberada. Con un valor suave se adivinan textos y rostros, y
 * en una diapositiva llena de texto eso equivale a regalar la clase.
 */
const BLUR_SIGMA = 22;

export function isSupportedCoverMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return COVER_MIME_TYPES.has(mimeType.toLowerCase().trim());
}

export interface RenderedCover {
  /** Portada nítida, en WebP. */
  full: Buffer;
  /** La misma imagen difuminada, para quien no tiene llave. */
  blurred: Buffer;
  /** Mime de ambas: se normalizan al mismo formato. */
  mimeType: 'image/webp';
  width: number;
  height: number;
}

/**
 * Genera las dos versiones a partir de la imagen que sube el creador.
 *
 * Ambas salen en WebP: pesa bastante menos que JPEG a igual calidad y lo
 * soportan todos los navegadores actuales, así que una sola conversión evita
 * guardar el formato que cada creador tuviera a mano.
 */
export async function renderTopicCover(source: Buffer): Promise<RenderedCover> {
  // `failOn: 'none'` tolera imágenes con metadatos corruptos, que son
  // frecuentes al exportar desde el móvil. Rechazarlas obligaría al creador a
  // reconvertir su archivo sin saber por qué.
  const base = sharp(source, { failOn: 'none' }).rotate();

  const full = await base
    .clone()
    .resize({ width: COVER_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const blurred = await base
    .clone()
    .resize({ width: BLUR_WIDTH, withoutEnlargement: true })
    .blur(BLUR_SIGMA)
    // Bajar saturación y luminosidad separa de un vistazo lo bloqueado de lo
    // abierto, incluso para quien no distingue bien el desenfoque.
    .modulate({ saturation: 0.55, brightness: 0.82 })
    .webp({ quality: 60 })
    .toBuffer();

  return {
    full: full.data,
    blurred,
    mimeType: 'image/webp',
    width: full.info.width,
    height: full.info.height,
  };
}

/**
 * Portada derivada de la primera página de un PDF.
 *
 * Sería lo ideal para un documento —su primera página ya es la carátula, y el
 * enunciado la nombra como previsualización válida para contenido escrito—,
 * pero depende de que libvips traiga soporte de PDF y **en esta imagen no lo
 * trae**. Medido el 2026-09-12: sharp acepta jpeg, png, webp, tiff, gif, svg,
 * heif y raw, y un PDF falla con "unsupported image format".
 *
 * Se conserva porque el intento no cuesta nada y una imagen con poppler
 * disponible lo resolvería sola. Mientras tanto devuelve null, y quien llama
 * sigue sin portada en vez de romper una subida que por lo demás es válida:
 * el creador puede adjuntarla igual que para un vídeo.
 */
export async function renderPdfCover(source: Buffer): Promise<RenderedCover | null> {
  try {
    const page = await sharp(source, { failOn: 'none', pages: 1 })
      .png()
      .toBuffer();
    return await renderTopicCover(page);
  } catch {
    return null;
  }
}

/** Duración legible para mostrar sobre la portada: "12:40", "1:05:30". */
export function formatDuration(totalSeconds: number | null | undefined): string | null {
  if (typeof totalSeconds !== 'number' || !Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return null;
  }
  const seconds = Math.round(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}
