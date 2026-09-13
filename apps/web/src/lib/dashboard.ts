import 'server-only';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { ApiError } from '@/lib/api/client';

// Reexportamos los formatters puros para mantener compat con Server Components
// que ya importan desde '@/lib/dashboard'. Los Client Components deben usar
// '@/lib/format' directamente para evitar arrastrar este módulo server-only.
export {
  formatNumber,
  formatMatic,
  formatDateTime,
  formatDate,
  shortAddr,
  relativeTime,
} from '@/lib/format';

/**
 * Garantiza una sesión válida en un Server Component. Devuelve el token y la
 * sesión. Las navegaciones renderizadas en el servidor no siempre pasan por
 * middleware, así que también redirige aquí cuando no hay token.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login?reauth=1');
  }
  return { session, token: session.accessToken };
}

/**
 * Envuelve un fetcher para devolver `null` en lugar de lanzar cuando:
 *  - La API responde errores HTTP recuperables (excepto 401).
 *  - La API está caída (ECONNREFUSED, ENOTFOUND, ETIMEDOUT, fetch failed).
 *
 * Esto permite que los Server Components rendericen estados vacíos/fallback
 * sin romper la página entera. Los errores 401 fuerzan reautenticación porque
 * indican que la sesión de NextAuth existe pero el token Bearer del API ya no sirve.
 */
export async function safeFetch<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        console.warn('[safeFetch] API token rejected, redirecting to login');
        redirect('/login?reauth=1');
      }
      if (err.status >= 500) {
        console.warn(`[safeFetch] Server error ${err.status}:`, err.code ?? err.message);
      }
      return null;
    }
    const nodeErr = err as { cause?: { code?: string }; message?: string } | null;
    const cause = nodeErr?.cause;
    if (
      cause?.code === 'ECONNREFUSED' ||
      cause?.code === 'ENOTFOUND' ||
      cause?.code === 'ETIMEDOUT' ||
      (err instanceof TypeError && /fetch failed/i.test(err.message))
    ) {
      console.warn(
        '[safeFetch] API unreachable, returning null:',
        cause?.code ?? nodeErr?.message ?? String(err),
      );
      return null;
    }
    throw err;
  }
}
