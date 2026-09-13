import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Permiso de lectura para la portada de un temario.
 *
 * La portada se pinta con una etiqueta <img>, y un <img> no manda cabecera
 * Authorization: el navegador pide la imagen por su cuenta, sin pasar por el
 * cliente de API. Por eso la ruta protegida con requireAuth respondia 401 a
 * TODA portada, y la previsualizacion no se veia nunca.
 *
 * Tampoco vale abrir la ruta: la portada nitida es material de pago --la
 * caratula de un video suele ser la diapositiva de la clase-- asi que quien no
 * tiene llave debe seguir recibiendo la difuminada.
 *
 * La salida es un permiso firmado que viaja en la URL. No sustituye a la
 * comprobacion de acceso: dice "quien pide" para que la ruta pueda volver a
 * decidir con las mismas reglas de siempre. Un permiso robado sirve para una
 * sola portada, durante una hora, y no autoriza nada mas.
 *
 * Se firma con HMAC-SHA256 en vez de emitir un JWT porque no lleva claims que
 * nadie deba leer y asi no se puede confundir con un token de sesion: no abre
 * ninguna otra ruta ni aunque se presente en la cabecera.
 */

/**
 * Vida del permiso.
 *
 * Una hora cubre de sobra la lectura de un curso --el tiempo que alguien pasa
 * viendo el temario-- y acota la ventana en la que un enlace copiado del
 * inspector seguiria sirviendo. Mas corto obligaria a recargar la pagina a
 * mitad de lectura para que las imagenes volvieran a cargar.
 */
export const COVER_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Separa los campos dentro del mensaje firmado. No aparece en un uuid. */
const FIELD_SEPARATOR = ':';

/**
 * Que abre el permiso.
 *
 * La portada y el archivo completo no valen lo mismo: la primera es el
 * anzuelo --se entrega difuminada a quien no pago-- y el segundo es el
 * material que se vende. Sin este campo, el permiso que la pagina pone en
 * cada <img> serviria tambien para descargar el video, y bastaria copiarlo
 * del inspector.
 */
export type TopicAssetScope = 'cover' | 'material';

export interface CoverTokenInput {
  topicId: string;
  userId: string;
  /** Milisegundos epoch en que caduca. */
  expiresAt: number;
  /** Portada o archivo completo. Por defecto la portada, que es el caso viejo. */
  scope?: TopicAssetScope;
}

/**
 * Mensaje que se firma.
 *
 * Incluye el temario Y el usuario a proposito. Sin el temario, un permiso
 * serviria para cualquier portada del catalogo; sin el usuario, el permiso de
 * un matriculado dejaria ver la portada nitida a cualquiera que lo copiase,
 * porque la ruta resolveria el acceso con la matricula de otro.
 */
function messageFor(input: CoverTokenInput): string {
  // El ambito va dentro de la firma: si viajara suelto, cambiar "cover" por
  // "material" en la URL convertiria el permiso de una miniatura en uno de
  // descarga. Los permisos sin ambito declarado siguen firmando como 'cover',
  // que es lo que eran antes de existir este campo.
  return [input.topicId, input.userId, input.scope ?? 'cover', String(input.expiresAt)].join(
    FIELD_SEPARATOR,
  );
}

/**
 * Firma un permiso de portada.
 *
 * El formato es `<expiracion>.<firma>`: la expiracion viaja en claro porque
 * verificarla es lo primero que hace la ruta, y va dentro del mensaje firmado
 * para que alargarla invalide la firma.
 */
export function signCoverToken(input: CoverTokenInput, secret: string): string {
  const signature = createHmac('sha256', secret).update(messageFor(input)).digest('base64url');
  return `${input.expiresAt}.${signature}`;
}

/**
 * Emite un permiso para el par (temario, usuario) que vence dentro de la
 * ventana por defecto.
 */
export function issueCoverToken(
  input: { topicId: string; userId: string; scope?: TopicAssetScope },
  secret: string,
  now = Date.now(),
): string {
  return signCoverToken({ ...input, expiresAt: now + COVER_TOKEN_TTL_MS }, secret);
}

/**
 * Comprueba un permiso.
 *
 * Devuelve true solo si la firma corresponde exactamente a ese temario, ese
 * usuario y esa expiracion, y la expiracion no ha pasado. Cualquier otra cosa
 * --formato raro, firma de otro temario, fecha estirada-- es false; nunca
 * lanza, porque la entrada viene de la URL y un error no controlado aqui
 * convertiria una portada en un 500.
 */
export function verifyCoverToken(
  token: string,
  input: { topicId: string; userId: string; scope?: TopicAssetScope },
  secret: string,
  now = Date.now(),
): boolean {
  if (typeof token !== 'string' || token.length === 0) return false;

  const separator = token.indexOf('.');
  if (separator <= 0) return false;

  const expiresAtRaw = token.slice(0, separator);
  const presented = token.slice(separator + 1);
  if (presented.length === 0) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) return false;
  if (expiresAt <= now) return false;

  const expected = createHmac('sha256', secret)
    .update(
      messageFor({
        topicId: input.topicId,
        userId: input.userId,
        scope: input.scope,
        expiresAt,
      }),
    )
    .digest('base64url');

  // Comparacion en tiempo constante: comparar con === filtraria, carácter a
  // carácter, cuanto de la firma se acerto. Las longitudes se comparan antes
  // porque timingSafeEqual lanza si difieren.
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
