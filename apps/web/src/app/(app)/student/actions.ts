'use server';

/**
 * Acciones del estudiante.
 *
 * Los mensajes de error de este archivo siguen en espanol y no es un olvido:
 * una server action corre en el servidor, sin contexto de React, asi que no
 * puede leer el idioma activo con useT(). Traducirlos exige resolver el idioma
 * en el servidor --leyendolo del perfil del usuario-- que es la conexion con
 * users.locale pendiente.
 *
 * Las claves ya existen en el diccionario bajo student.actions, listas para
 * cuando esa conexion se haga.
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@/server/auth';
import { meApi } from '@/lib/api/endpoints/me';
import { authApi, type UserProfileInput } from '@/lib/api/endpoints/auth';
import { studentApi, type StudentProfileUpdate } from '@/lib/api/endpoints/student';
import { ApiError, apiRequest } from '@/lib/api/client';

async function token() {
  const session = await auth();
  if (!session?.accessToken) throw new Error('UNAUTHENTICATED');
  return session.accessToken;
}

export async function updateDetailedUserProfileAction(
  input: UserProfileInput,
): Promise<ActionResult> {
  try {
    const t = await token();
    await authApi.updateProfile(t, input);
    revalidatePath('/student/profile');
    revalidatePath('/student');
    revalidatePath('/teacher/profile');
    revalidatePath('/teacher');
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'No se pudo actualizar el perfil.',
    };
  }
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function startAttemptAction(
  enrollmentId: string,
  assessmentId: string,
): Promise<ActionResult<{ attemptId: string }>> {
  try {
    const t = await token();
    const res = await meApi.startAttempt(t, assessmentId);
    revalidatePath(`/student/courses/${enrollmentId}`);
    return { ok: true, data: { attemptId: res.data.id } };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al iniciar intento' };
  }
}

export async function submitAttemptAction(
  enrollmentId: string,
  attemptId: string,
  answers: Record<string, unknown>,
): Promise<ActionResult<{ status: string; score: number | null }>> {
  try {
    const t = await token();
    const res = await meApi.submitAttempt(t, attemptId, answers);
    revalidatePath(`/student/courses/${enrollmentId}`);
    return { ok: true, data: { status: res.data.status, score: res.data.score } };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al enviar intento' };
  }
}

export async function updateLearnModuleProgressAction(
  enrollmentId: string,
  moduleId: string,
  status: 'in_progress' | 'completed',
): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.updateLearnModuleProgress(t, moduleId, { status });
    revalidatePath(`/student/courses/${enrollmentId}`);
    revalidatePath('/student');
    revalidatePath('/student/courses');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'No se pudo registrar el avance.',
    };
  }
}

export async function redeemCodeAction(
  rawCode: string,
): Promise<ActionResult<{ enrollmentId: string; alreadyEnrolled: boolean }>> {
  const code = rawCode.trim().toUpperCase();
  if (code.length < 4 || code.length > 16) {
    return { ok: false, error: 'El código debe tener entre 4 y 16 caracteres.' };
  }
  try {
    const t = await token();
    const res = await studentApi.redeemCode(t, code);
    revalidatePath('/student');
    revalidatePath('/student/courses');
    return {
      ok: true,
      data: { enrollmentId: res.enrollmentId, alreadyEnrolled: res.alreadyEnrolled },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'No se pudo canjear el código.',
    };
  }
}

export async function updateStudentProfileAction(
  input: StudentProfileUpdate,
): Promise<ActionResult> {
  try {
    const t = await token();
    await studentApi.updateProfile(t, input);
    revalidatePath('/student/profile');
    revalidatePath('/student');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'No se pudo actualizar el perfil.',
    };
  }
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
    return { ok: true, data: { deletionScheduledAt: res.deletionScheduledAt } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'No se pudo iniciar la eliminación.',
    };
  }
}

export async function cancelAccountDeletionAction(): Promise<ActionResult> {
  try {
    const t = await token();
    await apiRequest('/v1/privacy/delete/cancel', { method: 'POST', token: t });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'No se pudo cancelar la eliminación.',
    };
  }
}
