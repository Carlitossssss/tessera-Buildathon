'use server';

import { authApi } from '@/lib/api/endpoints/auth';
import { ApiError } from '@/lib/api/client';
import { auth } from '@/server/auth';

export async function sendRestrictionAppealAction(
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.accessToken) return { ok: false, error: 'Sesión no disponible' };

  const trimmed = message.trim();
  if (trimmed.length < 20) {
    return { ok: false, error: 'Escribí al menos 20 caracteres para solicitar la revisión.' };
  }

  try {
    await authApi.sendRestrictedAppeal(session.accessToken, trimmed);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'No pudimos enviar la solicitud.',
    };
  }
}
