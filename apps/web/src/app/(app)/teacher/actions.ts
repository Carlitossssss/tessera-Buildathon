'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/server/auth';
import { meApi } from '@/lib/api/endpoints/me';
import { ApiError } from '@/lib/api/client';

async function token() {
  const session = await auth();
  if (!session?.accessToken) throw new Error('UNAUTHENTICATED');
  return session.accessToken;
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// ─── Calificación de attempts (essays) ────────────────────────────────────────
export async function gradeAttemptAction(
  attemptId: string,
  formData: FormData,
): Promise<ActionResult<{ score: number }>> {
  try {
    const t = await token();
    const scoreRaw = Number(formData.get('score') ?? NaN);
    if (!Number.isFinite(scoreRaw) || scoreRaw < 0) {
      return { ok: false, error: 'Ingresa una nota válida' };
    }
    const feedback = String(formData.get('feedback') ?? '').trim();
    const result = await meApi.teacherGradeAttempt(t, attemptId, {
      score: Math.round(scoreRaw),
      feedback: feedback || null,
    });
    revalidatePath('/teacher');
    revalidatePath('/teacher/grading');
    revalidatePath(`/teacher/grading/${attemptId}`);
    revalidatePath('/teacher/students');
    if (result.data?.enrollmentId) {
      revalidatePath(`/teacher/students/${result.data.enrollmentId}`);
    }
    return { ok: true, data: { score: result.data.score ?? Math.round(scoreRaw) } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al calificar',
    };
  }
}

// ─── Avance manual de módulos (clases offline, etc.) ─────────────────────────
export async function setModuleProgressAction(
  enrollmentId: string,
  moduleId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const t = await token();
    const status = String(formData.get('status') ?? '');
    if (!['not_started', 'in_progress', 'completed'].includes(status)) {
      return { ok: false, error: 'Estado inválido' };
    }
    const scoreRaw = formData.get('score');
    const score =
      scoreRaw === null || scoreRaw === '' ? null : Math.max(0, Math.min(100, Number(scoreRaw)));
    const note = String(formData.get('note') ?? '').trim();
    await meApi.teacherUpdateModuleProgress(t, enrollmentId, moduleId, {
      status: status as 'not_started' | 'in_progress' | 'completed',
      score,
      note: note || null,
    });
    revalidatePath(`/teacher/students/${enrollmentId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al guardar avance',
    };
  }
}
