import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { pendingApprovalGate } from '../../approval-gate';
import { CourseDetailTabs } from './course-detail-tabs';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { session, token } = await requireSession();
  const approvalGate = await pendingApprovalGate(token);
  if (approvalGate) return approvalGate;

  const [detail, enrollmentList, team, templates] = await Promise.all([
    safeFetch(() => meApi.getCourse(token, id)),
    safeFetch(() => meApi.listCourseEnrollments(token, id)),
    safeFetch(() => meApi.team(token)),
    safeFetch(() => meApi.templates(token)),
  ]);

  if (!detail) {
    notFound();
  }

  // Carga de temarios + evaluaciones por módulo en paralelo
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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/institution/courses"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a cursos
        </Link>
      </div>
      <CourseDetailTabs
        detail={detail}
        enrollments={
          enrollmentList ?? {
            totals: { totalModules: 0, requiredModules: 0, enrollments: 0 },
            data: [],
          }
        }
        teamMembers={team?.data ?? []}
        currentUserId={session.user.id}
        templates={templates?.data ?? []}
        moduleContents={moduleContents}
      />
    </div>
  );
}
