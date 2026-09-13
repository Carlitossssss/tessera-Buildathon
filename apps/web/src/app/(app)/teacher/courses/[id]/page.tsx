import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { TeacherCourseTabs } from './teacher-course-tabs';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeacherCourseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { token } = await requireSession();

  const [detail, enrollmentList, gradingRes] = await Promise.all([
    safeFetch(() => meApi.getCourse(token, id)),
    safeFetch(() => meApi.listCourseEnrollments(token, id)),
    safeFetch(() => meApi.teacherGradingQueue(token, { courseId: id, status: 'submitted' })),
  ]);

  if (!detail) {
    notFound();
  }

  const moduleContents = await Promise.all(
    detail.modules.map(async (module) => {
      const [topicsRes, assessmentsRes] = await Promise.all([
        safeFetch(() => meApi.listTopics(token, module.id)),
        safeFetch(() => meApi.listAssessments(token, module.id)),
      ]);
      const assessments = assessmentsRes?.data ?? [];
      const questionsByAssessment = await Promise.all(
        assessments.map(async (a) => {
          const res = await safeFetch(() => meApi.listQuestions(token, a.id));
          return { assessmentId: a.id, questions: res?.data ?? [] };
        }),
      );
      return {
        moduleId: module.id,
        topics: topicsRes?.data ?? [],
        assessments,
        questions: Object.fromEntries(
          questionsByAssessment.map((q) => [q.assessmentId, q.questions]),
        ),
      };
    }),
  );

  const gradingQueue = gradingRes?.data ?? [];
  const pendingGrading = gradingRes?.totals?.pending ?? gradingQueue.length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/teacher/courses"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a mis cursos
        </Link>
      </div>
      <TeacherCourseTabs
        detail={detail}
        enrollments={
          enrollmentList ?? {
            totals: { totalModules: 0, requiredModules: 0, enrollments: 0 },
            data: [],
          }
        }
        moduleContents={moduleContents}
        gradingQueue={gradingQueue}
        pendingGrading={pendingGrading}
      />
    </div>
  );
}
