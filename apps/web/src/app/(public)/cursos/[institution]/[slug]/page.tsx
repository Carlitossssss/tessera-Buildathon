import { notFound, redirect } from 'next/navigation';
import { meApi } from '@/lib/api/endpoints/me';
import { ApiError } from '@/lib/api/client';
import { auth } from '@/server/auth';
import { studentApi } from '@/lib/api/endpoints/student';
import { safeFetch } from '@/lib/dashboard';
import { CourseDetailShell } from './course-detail-shell';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ institution: string; slug: string }>;
}

async function enrollFreeCourseAction(formData: FormData) {
  'use server';
  const courseId = String(formData.get('courseId') ?? '');
  const returnTo = String(formData.get('returnTo') ?? '/cursos');
  const session = await auth();
  if (!session?.accessToken) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  if (session.user.role !== 'student') {
    redirect('/student');
  }

  try {
    const result = await meApi.enrollPublicFreeCourse(session.accessToken, courseId);
    redirect(`/student/courses/${result.enrollmentId}`);
  } catch (err) {
    if (err instanceof ApiError) {
      redirect(`${returnTo}?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
}

/**
 * Matrícula por membresía de Unlock.
 *
 * Vive como server action para no exponer el token de sesión al navegador.
 * No decide nada: reenvía la firma y la API vuelve a leer el Lock on-chain
 * antes de conceder la matrícula.
 *
 * Los mensajes de error que devuelve quedan en español a propósito: una
 * Server Action corre en el servidor sin contexto de React, así que no puede
 * leer el idioma activo con useT() (mismo patrón que student/actions.ts).
 */
async function enrollWithMembershipAction(
  courseId: string,
  input: { wallet: string; signature: string; issuedAt: number },
): Promise<{ ok: true; enrollmentId: string } | { ok: false; message: string }> {
  'use server';
  const session = await auth();
  if (!session?.accessToken) {
    return { ok: false, message: 'Iniciá sesión para matricularte.' };
  }
  if (session.user.role !== 'student') {
    return { ok: false, message: 'Sólo una cuenta de estudiante puede matricularse.' };
  }

  try {
    const result = await meApi.enrollCourseWithMembership(session.accessToken, courseId, input);
    return { ok: true, enrollmentId: result.enrollmentId };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, message: err.message };
    }
    return { ok: false, message: 'No pudimos completar la matrícula.' };
  }
}

export default async function PublicCourseDetailPage({ params }: PageProps) {
  const { institution, slug } = await params;
  let detail: Awaited<ReturnType<typeof meApi.publicCourseDetail>>;
  try {
    detail = await meApi.publicCourseDetail(slug, institution);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const isFree = detail.course.visibility === 'public_free';
  const isHybrid = detail.course.visibility === 'hybrid';
  const canRequestFreeEnrollment = isFree || isHybrid;
  const returnTo = `/cursos/${institution}/${slug}`;

  // Un curso token-gated reemplaza el temario plano y el bloque de precio por
  // el recorrido de Unlock: muestra, verificación y desbloqueo.
  const membership = detail.membership;
  const session = await auth();
  const signedInAsStudent = session?.user.role === 'student';
  const courseId = detail.course.id;

  // Si ya se matriculó, el gate ofrece continuar en vez de volver a pedirle
  // que compre. Sólo se consulta cuando hace falta: un visitante sin sesión
  // no tiene matrículas que mirar.
  const existingEnrollmentId =
    membership && signedInAsStudent && session?.accessToken
      ? ((await safeFetch(() => studentApi.courses(session.accessToken!)))?.data.find(
          (row) => row.courseId === courseId,
        )?.enrollmentId ?? null)
      : null;
  const enrollAction = membership
    ? async (input: { wallet: string; signature: string; issuedAt: number }) => {
        'use server';
        return enrollWithMembershipAction(courseId, input);
      }
    : null;

  return (
    <CourseDetailShell
      detail={detail}
      slug={slug}
      returnTo={returnTo}
      isFree={isFree}
      isHybrid={isHybrid}
      canRequestFreeEnrollment={canRequestFreeEnrollment}
      signedInAsStudent={signedInAsStudent}
      existingEnrollmentId={existingEnrollmentId}
      enrollFreeCourseAction={enrollFreeCourseAction}
      enrollAction={enrollAction}
    />
  );
}
