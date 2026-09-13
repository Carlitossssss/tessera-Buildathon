import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { meApi } from '@/lib/api/endpoints/me';
import { ApiError } from '@/lib/api/client';
import { RedeemView } from './redeem-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Canjear código · Tessera' };

interface PageProps {
  searchParams: Promise<{ error?: string; ok?: string; slug?: string }>;
}

/**
 * Mensaje de validación en español a propósito: corre en una Server Action,
 * sin contexto de React, así que no puede leer el idioma activo con useT().
 * Ver la nota de RedeemView.
 */
async function redeemAction(formData: FormData) {
  'use server';
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login?next=/cursos/canjear');
  }
  const code = String(formData.get('code') ?? '').trim();
  if (code.length < 4) {
    redirect('/cursos/canjear?error=' + encodeURIComponent('Ingresa un código válido.'));
  }
  try {
    const result = await meApi.redeemCourseCode(session.accessToken, code);
    redirect(`/student/courses?ok=1&slug=${encodeURIComponent(result.courseSlug)}`);
  } catch (err) {
    if (err instanceof ApiError) {
      redirect('/cursos/canjear?error=' + encodeURIComponent(err.message));
    }
    throw err;
  }
}

export default async function RedeemPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login?next=/cursos/canjear');
  }

  return <RedeemView action={redeemAction} error={sp.error} ok={sp.ok} slug={sp.slug} />;
}
