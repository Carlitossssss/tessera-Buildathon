import { publicEnv } from '@/lib/env';
import { buildOwnershipMessage, formatDuration, formatPrice, type LockInfo } from './api';

/**
 * Cliente de los cursos token-gated.
 *
 * Comparte el mensaje de propiedad y los formateadores con el portal de
 * contenido: son el mismo mecanismo de Unlock aplicado a otro objeto, y
 * duplicarlo haria que una correccion en un sitio se olvidara en el otro.
 *
 * Nada de lo que hay aqui concede acceso. La autorizacion la decide el
 * servidor leyendo el Lock on-chain; estas funciones solo preguntan y
 * presentan la respuesta.
 */

const API = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '');

export { formatDuration, formatPrice };
export type { LockInfo };

/**
 * Ambito de la firma para un curso. Debe coincidir exactamente con
 * membershipScope del backend: si difiere, la firma se rechaza y nadie puede
 * matricularse.
 */
export function courseMembershipScope(courseId: string): string {
  return `course:${courseId}`;
}

/** Mensaje que firma el visitante para probar que controla la wallet. */
export function buildCourseOwnershipMessage(input: {
  walletAddress: string;
  courseId: string;
  issuedAt: number;
}): string {
  return buildOwnershipMessage({
    walletAddress: input.walletAddress,
    slug: courseMembershipScope(input.courseId),
    issuedAt: input.issuedAt,
  });
}

export interface CourseMembershipStatus {
  hasAccess: boolean;
  wallet: string;
  network: string;
  expiresAt: string | null;
  keyCount: number;
  lock: { address: string; chainId: number; checkoutUrl: string };
}

/** Consulta on-chain si la wallet puede matricularse. No matricula. */
export async function checkCourseMembership(
  courseId: string,
  wallet: string,
): Promise<CourseMembershipStatus> {
  const res = await fetch(
    `${API}/v1/public/courses/${courseId}/membership?wallet=${encodeURIComponent(wallet)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Error ${res.status}`);
  }
  const body = (await res.json()) as { data: CourseMembershipStatus };
  return body.data;
}

export interface PreviewModule {
  id: string;
  title: string;
  description: string | null;
  contentType: string;
  content: Record<string, unknown> | null;
  topics: Array<{
    id: string;
    title: string;
    description: string | null;
    contentType: string;
    content: Record<string, unknown> | null;
    orderIndex: number;
  }>;
  preview: true;
}

export type PreviewResult =
  | { ok: true; module: PreviewModule }
  | { ok: false; reason: 'membership'; checkoutUrl: string | null }
  | { ok: false; reason: 'error'; message: string };

/**
 * Pide el contenido de un modulo de muestra.
 *
 * Un 402 no es un fallo: es la respuesta correcta para un modulo que exige
 * membresia, y trae el camino de compra. Se distingue del error real para que
 * la pantalla ofrezca el checkout en vez de un mensaje de avería.
 */
export async function fetchPreviewModule(
  courseId: string,
  moduleId: string,
): Promise<PreviewResult> {
  try {
    const res = await fetch(`${API}/v1/public/courses/${courseId}/modules/${moduleId}/preview`, {
      cache: 'no-store',
    });

    if (res.status === 402) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: { checkoutUrl?: string };
      };
      return { ok: false, reason: 'membership', checkoutUrl: body.error?.checkoutUrl ?? null };
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return {
        ok: false,
        reason: 'error',
        message: body.error?.message ?? 'No pudimos cargar la muestra.',
      };
    }

    const body = (await res.json()) as { data: PreviewModule };
    return { ok: true, module: body.data };
  } catch {
    return { ok: false, reason: 'error', message: 'No pudimos conectar con la API.' };
  }
}

/**
 * Extrae el texto legible del contenido de un modulo o temario.
 *
 * El contenido es JSON libre --cada institucion guarda lo suyo-- asi que
 * buscamos las claves habituales en vez de asumir una forma unica, y caemos a
 * null cuando no hay nada que mostrar.
 */
export function readableContent(content: Record<string, unknown> | null): string | null {
  if (!content) return null;
  for (const key of ['body', 'text', 'html', 'markdown', 'content', 'description']) {
    const value = content[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}
