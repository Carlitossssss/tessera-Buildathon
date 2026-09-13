'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiRequest } from '@/lib/api/client';
import { auth } from '@/server/auth';

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function token() {
  const session = await auth();
  if (!session?.accessToken) throw new Error('UNAUTHENTICATED');
  return session.accessToken;
}

export async function requestDataExportAction(): Promise<ActionResult<{ requestId: string }>> {
  try {
    const t = await token();
    const res = await apiRequest<{ requestId: string; status: string }>('/v1/privacy/export', {
      method: 'POST',
      token: t,
    });
    return { ok: true, data: { requestId: res.requestId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'No se pudo solicitar la exportación.',
    };
  }
}

export async function requestAccountDeletionAction(): Promise<
  ActionResult<{ deletionScheduledAt: string }>
> {
  try {
    const t = await token();
    const res = await apiRequest<{ deletionScheduledAt: string }>('/v1/privacy/delete', {
      method: 'POST',
      token: t,
    });
    revalidatePath('/student');
    revalidatePath('/student/privacy');
    revalidatePath('/teacher');
    revalidatePath('/teacher/profile');
    revalidatePath('/institution');
    revalidatePath('/institution/settings');
    revalidatePath('/admin/users');
    revalidatePath('/admin/institutions');
    return { ok: true, data: { deletionScheduledAt: res.deletionScheduledAt } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'No se pudo iniciar la eliminación.',
    };
  }
}
