import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { LearnCourseView } from './learn-course-view';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ enrollmentId: string }>;
}

export default async function StudentCoursePage({ params }: PageProps) {
  const { enrollmentId } = await params;
  const { token } = await requireSession();

  const result = await safeFetch(() => meApi.learnCourse(token, enrollmentId));
  if (!result) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/student"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver
      </Link>
      <LearnCourseView payload={result.data} />
    </div>
  );
}
