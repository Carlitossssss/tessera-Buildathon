import { Suspense } from 'react';
import { CertificateWizard } from './wizard';
import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { pendingApprovalGate } from '../../approval-gate';

export const dynamic = 'force-dynamic';

export default async function NewCertificatePage({
  searchParams,
}: {
  searchParams?: Promise<{ templateId?: string }>;
}) {
  const params = await searchParams;
  const { token } = await requireSession();
  const approvalGate = await pendingApprovalGate(token);
  if (approvalGate) return approvalGate;
  const [templates, courses, institution, credits] = await Promise.all([
    safeFetch(() => meApi.templates(token)),
    safeFetch(() => meApi.courses(token)),
    safeFetch(() => meApi.institution(token)),
    safeFetch(() => meApi.credits(token)),
  ]);
  const courseRows = courses?.data ?? [];
  const enrollmentResults = await Promise.all(
    courseRows.map(async (course) => ({
      courseId: course.id,
      students: (await safeFetch(() => meApi.listCourseEnrollments(token, course.id)))?.data ?? [],
    })),
  );

  return (
    <Suspense>
      <CertificateWizard
        templates={templates?.data ?? []}
        courses={courseRows}
        courseStudents={enrollmentResults}
        institutionWallet={institution?.institution.walletAddress ?? ''}
        tscPerCertificate={credits?.tscPerCertificate ?? 2}
        initialTemplateId={params?.templateId}
      />
    </Suspense>
  );
}
