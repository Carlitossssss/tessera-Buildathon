import { and, eq, inArray, isNull } from '@tessera/db';
import { schema } from '@tessera/db';
import { errors } from '@tessera/shared/errors';
import { getDb } from '../lib/db.js';

export const INSTITUTION_SUSPENDED_MESSAGE = 'Esta institución ha sido suspendida.';
export const INSTITUTION_UNAVAILABLE_MESSAGE = 'Esta institución no está disponible.';

export function institutionAdminRestrictionReason(reason: string): string {
  return `Institución suspendida: ${reason}`;
}

export async function assertInstitutionActive(institutionId: string) {
  const db = getDb();
  const institution = await db.query.institutions.findFirst({
    columns: {
      id: true,
      status: true,
      name: true,
      suspensionReason: true,
    },
    where: eq(schema.institutions.id, institutionId),
  });

  if (!institution) throw errors.notFound('Institución');
  if (institution.status === 'suspended') {
    throw errors.forbidden(INSTITUTION_SUSPENDED_MESSAGE);
  }
  if (institution.status === 'revoked') {
    throw errors.forbidden(INSTITUTION_UNAVAILABLE_MESSAGE);
  }

  return institution;
}

export async function assertCoursesInstitutionActive(courseIds: string[]) {
  if (courseIds.length === 0) return;

  const db = getDb();
  const courses = await db
    .select({ institutionId: schema.courses.institutionId })
    .from(schema.courses)
    .where(inArray(schema.courses.id, courseIds));

  const institutionIds = Array.from(new Set(courses.map((course) => course.institutionId)));
  for (const institutionId of institutionIds) {
    await assertInstitutionActive(institutionId);
  }
}

export async function assertCourseInstitutionActive(courseId: string) {
  const db = getDb();
  const course = await db.query.courses.findFirst({
    columns: { id: true, institutionId: true },
    where: eq(schema.courses.id, courseId),
  });

  if (!course) throw errors.notFound('Curso no encontrado');
  await assertInstitutionActive(course.institutionId);
  return course;
}

export async function restrictInstitutionAdmins(institutionId: string, reason: string) {
  const db = getDb();
  const adminRestrictionReason = institutionAdminRestrictionReason(reason);
  const admins = await db
    .select({ userId: schema.users.id })
    .from(schema.institutionMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.institutionMembers.userId))
    .where(
      and(
        eq(schema.institutionMembers.institutionId, institutionId),
        eq(schema.users.role, 'institution_admin'),
        eq(schema.users.restricted, false),
        isNull(schema.users.deletedAt),
      ),
    );

  const adminIds = admins.map((admin) => admin.userId);
  if (adminIds.length === 0) return 0;

  await db
    .update(schema.users)
    .set({
      restricted: true,
      restrictedAt: new Date(),
      restrictionReason: adminRestrictionReason,
      updatedAt: new Date(),
    })
    .where(inArray(schema.users.id, adminIds));

  return adminIds.length;
}

export async function reactivateInstitutionAdmins(institutionId: string) {
  const db = getDb();
  const admins = await db
    .select({ userId: schema.users.id })
    .from(schema.institutionMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.institutionMembers.userId))
    .where(
      and(
        eq(schema.institutionMembers.institutionId, institutionId),
        eq(schema.users.role, 'institution_admin'),
        eq(schema.users.restricted, true),
        isNull(schema.users.deletedAt),
      ),
    );

  const adminIds = admins.map((admin) => admin.userId);
  if (adminIds.length === 0) return 0;

  await db
    .update(schema.users)
    .set({
      restricted: false,
      restrictedAt: null,
      restrictionReason: null,
      updatedAt: new Date(),
    })
    .where(inArray(schema.users.id, adminIds));

  return adminIds.length;
}
