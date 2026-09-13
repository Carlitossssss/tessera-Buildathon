import 'server-only';
import { auth } from '@/server/auth';
import { apiRequest, ApiError, type ApiRequestOptions } from './client';

/**
 * Llamada server-side al API con el JWT de la sesión NextAuth inyectado
 * automáticamente. Usar dentro de Server Components / Server Actions.
 */
export async function apiServer<T = unknown>(
  path: string,
  opts: ApiRequestOptions = {},
): Promise<T> {
  const session = await auth();
  return apiRequest<T>(path, { ...opts, token: opts.token ?? session?.accessToken ?? null });
}

export { ApiError };
