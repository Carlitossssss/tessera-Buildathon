import { and, eq, sql } from '@tessera/db';
import { schema } from '@tessera/db';
import { nanoid } from 'nanoid';
import { issueCertificateSchema, type IssueCertificateInput } from '@tessera/shared/schemas';
import { errors } from '@tessera/shared/errors';
import { getDb } from '../lib/db.js';
import { queues } from './queues.js';
import { getCreditBalance } from './credits.js';
import { getTscPerCertificate } from './payments/catalog.js';
import { buildCertificateTrackingResponse } from '../modules/certificates/presenters.js';
import { env } from '../config/env.js';
import { assertInstitutionActive } from './institution-access.js';
import { provisionCustodialWallet } from './custodial-wallet.js';
import { normalizeDeclaredWallet } from './recipient-wallet.js';

export async function enqueueCertificateEmission(input: {
  institutionId: string;
  payload: IssueCertificateInput;
  apiPublicUrl: string;
  issuedBy?: string | null;
}) {
  const payload = issueCertificateSchema.parse(input.payload);
  const db = getDb();
  await assertInstitutionActive(input.institutionId);

  // Wallet que el propio estudiante declara (el portal la toma de la que firmo
  // la prueba de propiedad). Si viene, manda sobre la custodiada: la custodia
  // existe para quien no tiene wallet, no para reemplazar la que ya usa. Sin
  // esto, la credencial del portal caeria en una wallet distinta de la que
  // compro la membresia y el circulo de Unlock quedaria roto.
  const declaredWallet = normalizeDeclaredWallet(payload.student.walletAddress);

  // Provisionar cuesta una escritura en OpenBao, asi que solo ocurre si de
  // verdad hace falta: cuando el estudiante ya trajo su wallet, no hay nada
  // que custodiar.
  const walletForNewProfile = async () => declaredWallet ?? (await provisionCustodialWallet());

  let registeredStudent = await db.query.users.findFirst({
    where: sql`lower(${schema.users.email}) = ${payload.student.email.toLowerCase()}`,
  });
  if (!registeredStudent) {
    const [created] = await db
      .insert(schema.users)
      .values({
        email: payload.student.email.toLowerCase(),
        name: payload.student.name,
        role: 'student',
        walletAddress: await walletForNewProfile(),
      })
      .returning();
    registeredStudent = created!;
  } else if (!registeredStudent.walletAddress) {
    const [updated] = await db
      .update(schema.users)
      .set({ walletAddress: await walletForNewProfile(), updatedAt: new Date() })
      .where(eq(schema.users.id, registeredStudent.id))
      .returning();
    registeredStudent = updated!;
  }

  // La credencial se acuña en la wallet declarada cuando la hay. No pisamos la
  // del perfil: un estudiante puede reclamar desde una wallet distinta a la que
  // tiene guardada, y el destino correcto es la que uso esta vez.
  const recipientWallet = declaredWallet ?? registeredStudent.walletAddress;

  if (payload.achievement.courseId) {
    const course = await db.query.courses.findFirst({
      where: and(
        eq(schema.courses.id, payload.achievement.courseId),
        eq(schema.courses.institutionId, input.institutionId),
      ),
    });
    if (!course) throw errors.notFound('Curso no encontrado');
  }

  if (payload.templateId) {
    const template = await db.query.certificateTemplates.findFirst({
      where: and(
        eq(schema.certificateTemplates.id, payload.templateId),
        eq(schema.certificateTemplates.institutionId, input.institutionId),
      ),
    });
    if (!template) throw errors.notFound('Plantilla no encontrada');
  }

  if (payload.idempotencyKey) {
    const prior = await db.query.certificates.findFirst({
      where: and(
        eq(schema.certificates.institutionId, input.institutionId),
        eq(schema.certificates.idempotencyKey, payload.idempotencyKey),
      ),
    });
    if (prior) {
      return {
        idempotent: true,
        certificateId: prior.id,
        status: prior.status,
      };
    }
  }

  const [balance, certificateCostTsc] = await Promise.all([
    getCreditBalance(input.institutionId),
    getTscPerCertificate(),
  ]);
  if (balance < certificateCostTsc) {
    throw errors.insufficientCredits(balance);
  }

  const [cert] = await db
    .insert(schema.certificates)
    .values({
      institutionId: input.institutionId,
      studentEmail: payload.student.email.toLowerCase(),
      studentName: payload.student.name,
      studentWallet: recipientWallet,
      studentUserId: registeredStudent.id,
      courseId: payload.achievement.courseId ?? null,
      templateId: payload.templateId ?? null,
      achievementName: payload.achievement.name,
      achievementDescription: payload.achievement.description ?? null,
      grade: payload.achievement.grade ?? null,
      externalId: payload.student.externalId ?? null,
      idempotencyKey: payload.idempotencyKey ?? null,
      callbackUrl: payload.callbackUrl ?? null,
      issuedBy: input.issuedBy ?? null,
      metadata: {
        completedAt: payload.achievement.completedAt,
        ...(payload.badgeCollectionId ? { badgeCollectionId: payload.badgeCollectionId } : {}),
      },
      status: 'queued',
    })
    .returning();

  const jobPublicId = `job_${nanoid(16)}`;
  await db.insert(schema.emissionJobs).values({
    publicId: jobPublicId,
    certificateId: cert!.id,
    institutionId: input.institutionId,
    status: 'queued',
    queue: 'certificate',
  });

  await queues.certificate.add(
    'emit-certificate',
    { certificateId: cert!.id, institutionId: input.institutionId, jobPublicId },
    { jobId: jobPublicId },
  );

  return buildCertificateTrackingResponse(input.apiPublicUrl, jobPublicId, cert!.id);
}

export async function autoIssueCourseCertificate(input: {
  courseId: string;
  enrollmentId: string;
  issuedBy?: string | null;
}) {
  const db = getDb();
  const enrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(schema.enrollments.id, input.enrollmentId),
      eq(schema.enrollments.courseId, input.courseId),
    ),
  });
  if (!enrollment?.completedAt) return null;

  const course = await db.query.courses.findFirst({
    where: eq(schema.courses.id, input.courseId),
  });
  if (!course?.autoIssueEnabled) return null;
  if (enrollment.finalScore !== null && enrollment.finalScore < course.passingScore) return null;

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, enrollment.userId) });
  if (!user?.walletAddress) return null;

  const existing = await db.query.certificates.findFirst({
    where: and(
      eq(schema.certificates.institutionId, course.institutionId),
      eq(schema.certificates.courseId, course.id),
      eq(schema.certificates.studentUserId, enrollment.userId),
    ),
  });
  if (existing) return existing;

  const result = await enqueueCertificateEmission({
    institutionId: course.institutionId,
    apiPublicUrl: env.API_PUBLIC_URL,
    issuedBy: input.issuedBy ?? null,
    payload: {
      student: {
        email: user.email,
        name: user.name ?? enrollment.studentName ?? user.email,
        walletAddress: user.walletAddress,
        externalId: enrollment.userId,
      },
      achievement: {
        name: course.title,
        description: course.description ?? undefined,
        grade: enrollment.finalScore ?? undefined,
        courseId: course.id,
        completedAt: enrollment.completedAt.toISOString(),
      },
      templateId: course.templateId ?? undefined,
      idempotencyKey: `course:${course.id}:enrollment:${enrollment.id}`,
    },
  });

  if ('certificateId' in result) {
    await db
      .update(schema.certificates)
      .set({ studentUserId: enrollment.userId })
      .where(eq(schema.certificates.id, result.certificateId));
  }

  return result;
}
