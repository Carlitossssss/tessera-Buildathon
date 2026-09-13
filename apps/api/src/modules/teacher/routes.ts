import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, count, desc, eq, inArray, isNotNull } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { errors } from '@tessera/shared/errors';
import {
  assertCoursesInstitutionActive,
  assertCourseInstitutionActive,
} from '../../services/institution-access.js';
import { recalculateFinalScore, recalculateModuleScore } from '../learn/routes.js';

/**
 * Endpoints exclusivos del rol docente. Todos restringen el universo de datos
 * a los cursos donde el usuario está asignado en `course_teachers`.
 */

async function listTeacherCourseIds(
  userId: string,
  options: { includeSuspended?: boolean } = {},
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ courseId: schema.courseTeachers.courseId })
    .from(schema.courseTeachers)
    .where(eq(schema.courseTeachers.userId, userId));
  const courseIds = rows.map((r) => r.courseId);
  if (!options.includeSuspended) {
    await assertCoursesInstitutionActive(courseIds);
  }
  return courseIds;
}

async function assertTeacherCourse(userId: string, courseId: string) {
  const db = getDb();
  const a = await db.query.courseTeachers.findFirst({
    where: and(
      eq(schema.courseTeachers.courseId, courseId),
      eq(schema.courseTeachers.userId, userId),
    ),
  });
  if (!a) throw errors.notFound('Curso no encontrado');
  const c = await db.query.courses.findFirst({
    where: eq(schema.courses.id, courseId),
  });
  if (!c) throw errors.notFound('Curso no encontrado');
  await assertCourseInstitutionActive(courseId);
  return { course: c, assignment: a };
}

const gradeSchema = z.object({
  score: z.number().int().min(0).max(1000),
  feedback: z.string().max(4000).optional().nullable(),
});

export default async function teacherRoutes(app: FastifyInstance) {
  // ─── Dashboard agregado ─────────────────────────────────────────────────────
  app.get(
    '/v1/me/teacher/dashboard',
    {
      preHandler: [app.requireAuth(['teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'], description: 'KPIs del docente.' },
    },
    async (req) => {
      const userId = req.auth!.userId;
      const db = getDb();
      const courseIds = await listTeacherCourseIds(userId);
      if (courseIds.length === 0) {
        return {
          data: {
            counts: {
              courses: 0,
              publishedCourses: 0,
              students: 0,
              activeStudents: 0,
              completedStudents: 0,
              pendingGrading: 0,
              modules: 0,
              assessments: 0,
            },
            avgFinalScore: null as number | null,
            avgPassingRate: null as number | null,
            recentActivity: [],
          },
        };
      }

      // Cursos
      const courses = await db
        .select()
        .from(schema.courses)
        .where(inArray(schema.courses.id, courseIds));
      const publishedCourses = courses.filter((c) => c.status === 'published').length;

      // Enrollments
      const enrollments = await db
        .select()
        .from(schema.enrollments)
        .where(inArray(schema.enrollments.courseId, courseIds));
      const enrollmentIds = enrollments.map((e) => e.id);
      const completedStudents = enrollments.filter((e) => e.completedAt != null).length;
      const activeStudents = enrollments.filter(
        (e) => e.startedAt != null && e.completedAt == null,
      ).length;

      // Modules / assessments counts
      const modulesAll = await db
        .select()
        .from(schema.modules)
        .where(inArray(schema.modules.courseId, courseIds));
      const moduleIds = modulesAll.map((m) => m.id);
      const assessmentsAll = moduleIds.length
        ? await db
            .select()
            .from(schema.assessments)
            .where(inArray(schema.assessments.moduleId, moduleIds))
        : [];
      const assessmentIds = assessmentsAll.map((a) => a.id);

      // Pendientes de calificar (essays submitted)
      const essayAssessmentIds = assessmentsAll.filter((a) => a.type === 'essay').map((a) => a.id);
      let pendingGrading = 0;
      if (essayAssessmentIds.length) {
        const r = await db
          .select({ n: count() })
          .from(schema.assessmentAttempts)
          .where(
            and(
              inArray(schema.assessmentAttempts.assessmentId, essayAssessmentIds),
              eq(schema.assessmentAttempts.status, 'submitted'),
            ),
          );
        pendingGrading = Number(r[0]?.n ?? 0);
      }

      // Promedios
      const finalScores = enrollments
        .map((e) => e.finalScore)
        .filter((s): s is number => typeof s === 'number');
      const avgFinalScore = finalScores.length
        ? Math.round(finalScores.reduce((a, b) => a + b, 0) / finalScores.length)
        : null;
      const passing = finalScores.length
        ? Math.round((finalScores.filter((s) => s >= 60).length / finalScores.length) * 100)
        : null;

      // Actividad reciente: últimos 8 attempts (graded + submitted) en cursos del docente.
      const recent = assessmentIds.length
        ? await db
            .select()
            .from(schema.assessmentAttempts)
            .where(inArray(schema.assessmentAttempts.assessmentId, assessmentIds))
            .orderBy(desc(schema.assessmentAttempts.submittedAt))
            .limit(8)
        : [];
      const enrollById = new Map(enrollments.map((e) => [e.id, e]));
      const assessmentById = new Map(assessmentsAll.map((a) => [a.id, a]));
      const courseById = new Map(courses.map((c) => [c.id, c]));
      const moduleById = new Map(modulesAll.map((m) => [m.id, m]));
      const recentActivity = recent
        .filter((at) => at.submittedAt)
        .map((at) => {
          const a = assessmentById.get(at.assessmentId);
          const m = a ? moduleById.get(a.moduleId) : null;
          const e = enrollById.get(at.enrollmentId);
          const c = m ? courseById.get(m.courseId) : null;
          return {
            attemptId: at.id,
            status: at.status,
            score: at.score,
            submittedAt: at.submittedAt,
            assessmentTitle: a?.title ?? '—',
            assessmentType: a?.type ?? null,
            courseTitle: c?.title ?? '—',
            courseId: c?.id ?? null,
            studentEmail: e?.studentEmail ?? null,
            studentName: e?.studentName ?? null,
            enrollmentId: e?.id ?? null,
          };
        });

      return {
        data: {
          counts: {
            courses: courses.length,
            publishedCourses,
            students: enrollmentIds.length,
            activeStudents,
            completedStudents,
            pendingGrading,
            modules: modulesAll.length,
            assessments: assessmentsAll.length,
          },
          avgFinalScore,
          avgPassingRate: passing,
          recentActivity,
        },
      };
    },
  );

  // ─── Instituciones vinculadas al docente ───────────────────────────────────
  app.get(
    '/v1/me/teacher/institutions',
    {
      preHandler: [app.requireAuth(['teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'], description: 'Instituciones donde participa el docente.' },
    },
    async (req) => {
      const userId = req.auth!.userId;
      const db = getDb();

      const memberships = await db
        .select({
          id: schema.institutionMembers.id,
          institutionId: schema.institutionMembers.institutionId,
          memberRole: schema.institutionMembers.memberRole,
          createdAt: schema.institutionMembers.createdAt,
          name: schema.institutions.name,
          slug: schema.institutions.slug,
          status: schema.institutions.status,
          country: schema.institutions.country,
          website: schema.institutions.website,
        })
        .from(schema.institutionMembers)
        .innerJoin(
          schema.institutions,
          eq(schema.institutions.id, schema.institutionMembers.institutionId),
        )
        .where(eq(schema.institutionMembers.userId, userId))
        .orderBy(desc(schema.institutionMembers.createdAt));

      if (memberships.length === 0) return { data: [] };

      const assignments = await db
        .select({ institutionId: schema.courses.institutionId })
        .from(schema.courseTeachers)
        .innerJoin(schema.courses, eq(schema.courses.id, schema.courseTeachers.courseId))
        .where(eq(schema.courseTeachers.userId, userId));

      const courseCountByInstitution = new Map<string, number>();
      for (const assignment of assignments) {
        courseCountByInstitution.set(
          assignment.institutionId,
          (courseCountByInstitution.get(assignment.institutionId) ?? 0) + 1,
        );
      }

      return {
        data: memberships.map((membership) => ({
          ...membership,
          courseCount: courseCountByInstitution.get(membership.institutionId) ?? 0,
        })),
      };
    },
  );

  // ─── Cursos asignados al docente ────────────────────────────────────────────
  app.get(
    '/v1/me/teacher/courses',
    {
      preHandler: [app.requireAuth(['teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req) => {
      const userId = req.auth!.userId;
      const db = getDb();
      const courseIds = await listTeacherCourseIds(userId, { includeSuspended: true });
      if (courseIds.length === 0) return { data: [] };

      const courses = await db
        .select({
          id: schema.courses.id,
          institutionId: schema.courses.institutionId,
          title: schema.courses.title,
          slug: schema.courses.slug,
          description: schema.courses.description,
          status: schema.courses.status,
          visibility: schema.courses.visibility,
          priceCents: schema.courses.priceCents,
          currency: schema.courses.currency,
          passingScore: schema.courses.passingScore,
          autoIssueEnabled: schema.courses.autoIssueEnabled,
          createdAt: schema.courses.createdAt,
          updatedAt: schema.courses.updatedAt,
          institutionName: schema.institutions.name,
          institutionStatus: schema.institutions.status,
        })
        .from(schema.courses)
        .innerJoin(schema.institutions, eq(schema.institutions.id, schema.courses.institutionId))
        .where(inArray(schema.courses.id, courseIds))
        .orderBy(desc(schema.courses.updatedAt));

      const enrollments = await db
        .select()
        .from(schema.enrollments)
        .where(inArray(schema.enrollments.courseId, courseIds));

      // pending grading por curso
      const modulesAll = await db
        .select()
        .from(schema.modules)
        .where(inArray(schema.modules.courseId, courseIds));
      const moduleByCourse = new Map<string, string[]>();
      for (const m of modulesAll) {
        const arr = moduleByCourse.get(m.courseId) ?? [];
        arr.push(m.id);
        moduleByCourse.set(m.courseId, arr);
      }
      const moduleIds = modulesAll.map((m) => m.id);
      const assessmentsAll = moduleIds.length
        ? await db
            .select()
            .from(schema.assessments)
            .where(inArray(schema.assessments.moduleId, moduleIds))
        : [];
      const essayByModule = new Map<string, string[]>();
      for (const a of assessmentsAll) {
        if (a.type !== 'essay') continue;
        const arr = essayByModule.get(a.moduleId) ?? [];
        arr.push(a.id);
        essayByModule.set(a.moduleId, arr);
      }
      const essayIds = assessmentsAll.filter((a) => a.type === 'essay').map((a) => a.id);
      const submittedAttempts = essayIds.length
        ? await db
            .select()
            .from(schema.assessmentAttempts)
            .where(
              and(
                inArray(schema.assessmentAttempts.assessmentId, essayIds),
                eq(schema.assessmentAttempts.status, 'submitted'),
              ),
            )
        : [];
      const assessmentToCourse = new Map<string, string>();
      for (const a of assessmentsAll) {
        const m = modulesAll.find((mm) => mm.id === a.moduleId);
        if (m) assessmentToCourse.set(a.id, m.courseId);
      }
      const pendingByCourse = new Map<string, number>();
      for (const at of submittedAttempts) {
        const c = assessmentToCourse.get(at.assessmentId);
        if (!c) continue;
        pendingByCourse.set(c, (pendingByCourse.get(c) ?? 0) + 1);
      }

      const data = courses.map((c) => {
        const cEnrolls = enrollments.filter((e) => e.courseId === c.id);
        const completed = cEnrolls.filter((e) => e.completedAt != null).length;
        const inProgress = cEnrolls.filter(
          (e) => e.startedAt != null && e.completedAt == null,
        ).length;
        const finalScores = cEnrolls
          .map((e) => e.finalScore)
          .filter((s): s is number => typeof s === 'number');
        const avgScore = finalScores.length
          ? Math.round(finalScores.reduce((a, b) => a + b, 0) / finalScores.length)
          : null;

        return {
          id: c.id,
          title: c.title,
          slug: c.slug,
          description: c.description,
          status: c.status,
          visibility: c.visibility,
          priceCents: c.priceCents,
          currency: c.currency,
          passingScore: c.passingScore,
          autoIssueEnabled: c.autoIssueEnabled,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          institutionName: c.institutionName,
          institutionStatus: c.institutionStatus,
          institutionSuspensionReason: null,
          modules: (moduleByCourse.get(c.id) ?? []).length,
          enrollments: cEnrolls.length,
          completed,
          inProgress,
          avgScore,
          pendingGrading: pendingByCourse.get(c.id) ?? 0,
        };
      });

      return { data };
    },
  );

  // ─── Estudiantes (a través de cursos del docente) ───────────────────────────
  app.get(
    '/v1/me/teacher/students',
    {
      preHandler: [app.requireAuth(['teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        querystring: z.object({
          courseId: z.string().uuid().optional(),
          search: z.string().max(120).optional(),
        }),
      },
    },
    async (req) => {
      const userId = req.auth!.userId;
      const q = req.query as { courseId?: string; search?: string };
      const db = getDb();
      const courseIds = await listTeacherCourseIds(userId);
      if (courseIds.length === 0) return { data: [], totals: { enrollments: 0, students: 0 } };

      let allowedCourseIds = courseIds;
      if (q.courseId) {
        if (!courseIds.includes(q.courseId)) throw errors.notFound('Curso no encontrado');
        allowedCourseIds = [q.courseId];
      }

      const enrollments = await db
        .select()
        .from(schema.enrollments)
        .where(inArray(schema.enrollments.courseId, allowedCourseIds))
        .orderBy(desc(schema.enrollments.createdAt));

      const userIds = Array.from(new Set(enrollments.map((e) => e.userId)));
      const users = userIds.length
        ? await db
            .select({
              id: schema.users.id,
              email: schema.users.email,
              name: schema.users.name,
              avatarUrl: schema.users.avatarUrl,
            })
            .from(schema.users)
            .where(inArray(schema.users.id, userIds))
        : [];
      const userById = new Map(users.map((u) => [u.id, u]));

      const courses = await db
        .select({
          id: schema.courses.id,
          title: schema.courses.title,
          slug: schema.courses.slug,
        })
        .from(schema.courses)
        .where(inArray(schema.courses.id, allowedCourseIds));
      const courseById = new Map(courses.map((c) => [c.id, c]));

      // Pending grading por enrollment
      const enrollmentIds = enrollments.map((e) => e.id);
      const allModules = await db
        .select()
        .from(schema.modules)
        .where(inArray(schema.modules.courseId, allowedCourseIds));
      const moduleIds = allModules.map((m) => m.id);
      const allAssessments = moduleIds.length
        ? await db
            .select()
            .from(schema.assessments)
            .where(inArray(schema.assessments.moduleId, moduleIds))
        : [];
      const essayIds = allAssessments.filter((a) => a.type === 'essay').map((a) => a.id);
      const submitted =
        enrollmentIds.length && essayIds.length
          ? await db
              .select()
              .from(schema.assessmentAttempts)
              .where(
                and(
                  inArray(schema.assessmentAttempts.enrollmentId, enrollmentIds),
                  inArray(schema.assessmentAttempts.assessmentId, essayIds),
                  eq(schema.assessmentAttempts.status, 'submitted'),
                ),
              )
          : [];
      const pendingByEnrollment = new Map<string, number>();
      for (const at of submitted) {
        pendingByEnrollment.set(
          at.enrollmentId,
          (pendingByEnrollment.get(at.enrollmentId) ?? 0) + 1,
        );
      }

      // Filtro por búsqueda (email o nombre)
      const search = (q.search ?? '').trim().toLowerCase();
      const filtered = enrollments.filter((e) => {
        if (!search) return true;
        const u = userById.get(e.userId);
        const email = (u?.email ?? e.studentEmail ?? '').toLowerCase();
        const name = (u?.name ?? e.studentName ?? '').toLowerCase();
        return email.includes(search) || name.includes(search);
      });

      const data = filtered.map((e) => {
        const u = userById.get(e.userId);
        const c = courseById.get(e.courseId);
        return {
          enrollmentId: e.id,
          courseId: e.courseId,
          courseTitle: c?.title ?? '—',
          courseSlug: c?.slug ?? null,
          userId: e.userId,
          email: u?.email ?? e.studentEmail ?? null,
          name: u?.name ?? e.studentName ?? null,
          avatarUrl: u?.avatarUrl ?? null,
          source: e.enrollmentSource,
          startedAt: e.startedAt,
          completedAt: e.completedAt,
          finalScore: e.finalScore,
          createdAt: e.createdAt,
          pendingGrading: pendingByEnrollment.get(e.id) ?? 0,
        };
      });

      return {
        data,
        totals: {
          enrollments: enrollments.length,
          students: new Set(enrollments.map((e) => e.userId)).size,
        },
      };
    },
  );

  // ─── Detalle de progreso de una inscripción ─────────────────────────────────
  app.get(
    '/v1/me/teacher/students/:enrollmentId',
    {
      preHandler: [app.requireAuth(['teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req) => {
      const { enrollmentId } = req.params as { enrollmentId: string };
      const userId = req.auth!.userId;
      const db = getDb();
      const enrollment = await db.query.enrollments.findFirst({
        where: eq(schema.enrollments.id, enrollmentId),
      });
      if (!enrollment) throw errors.notFound('Inscripción no encontrada');
      await assertTeacherCourse(userId, enrollment.courseId);
      const course = await db.query.courses.findFirst({
        where: eq(schema.courses.id, enrollment.courseId),
      });
      if (!course) throw errors.notFound('Curso no encontrado');
      const u = await db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
          avatarUrl: schema.users.avatarUrl,
        })
        .from(schema.users)
        .where(eq(schema.users.id, enrollment.userId))
        .limit(1);
      const user = u[0] ?? null;

      const modules = await db
        .select()
        .from(schema.modules)
        .where(eq(schema.modules.courseId, course.id))
        .orderBy(asc(schema.modules.orderIndex));
      const moduleIds = modules.map((m) => m.id);

      const assessments = moduleIds.length
        ? await db
            .select()
            .from(schema.assessments)
            .where(inArray(schema.assessments.moduleId, moduleIds))
            .orderBy(asc(schema.assessments.orderIndex))
        : [];
      const assessmentIds = assessments.map((a) => a.id);

      const attempts = assessmentIds.length
        ? await db
            .select()
            .from(schema.assessmentAttempts)
            .where(
              and(
                eq(schema.assessmentAttempts.enrollmentId, enrollment.id),
                inArray(schema.assessmentAttempts.assessmentId, assessmentIds),
              ),
            )
            .orderBy(desc(schema.assessmentAttempts.attemptNumber))
        : [];

      const progress = await db
        .select()
        .from(schema.moduleProgress)
        .where(eq(schema.moduleProgress.enrollmentId, enrollment.id));

      return {
        data: {
          enrollment: {
            id: enrollment.id,
            courseId: enrollment.courseId,
            userId: enrollment.userId,
            email: user?.email ?? enrollment.studentEmail,
            name: user?.name ?? enrollment.studentName,
            avatarUrl: user?.avatarUrl ?? null,
            source: enrollment.enrollmentSource,
            startedAt: enrollment.startedAt,
            completedAt: enrollment.completedAt,
            finalScore: enrollment.finalScore,
            createdAt: enrollment.createdAt,
          },
          course: {
            id: course.id,
            title: course.title,
            slug: course.slug,
            passingScore: course.passingScore,
          },
          modules: modules.map((m) => {
            const ma = assessments.filter((a) => a.moduleId === m.id);
            return {
              id: m.id,
              title: m.title,
              orderIndex: m.orderIndex,
              weight: m.weight,
              isRequired: m.isRequired,
              progress: progress.find((p) => p.moduleId === m.id) ?? null,
              assessments: ma.map((a) => ({
                id: a.id,
                title: a.title,
                type: a.type,
                weight: a.weight,
                maxScore: a.maxScore,
                passingScore: a.passingScore,
                attempts: attempts
                  .filter((at) => at.assessmentId === a.id)
                  .map((at) => ({
                    id: at.id,
                    attemptNumber: at.attemptNumber,
                    status: at.status,
                    score: at.score,
                    submittedAt: at.submittedAt,
                    gradedAt: at.gradedAt,
                  })),
              })),
            };
          }),
        },
      };
    },
  );

  // ─── Cola de grading manual (essays submitted) ──────────────────────────────
  app.get(
    '/v1/me/teacher/grading-queue',
    {
      preHandler: [app.requireAuth(['teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        querystring: z.object({
          courseId: z.string().uuid().optional(),
          status: z.enum(['submitted', 'graded', 'all']).default('submitted'),
        }),
      },
    },
    async (req) => {
      const userId = req.auth!.userId;
      const q = req.query as { courseId?: string; status?: 'submitted' | 'graded' | 'all' };
      const status = q.status ?? 'submitted';
      const db = getDb();
      const courseIds = await listTeacherCourseIds(userId);
      if (courseIds.length === 0) return { data: [], totals: { pending: 0, graded: 0 } };

      let allowedCourseIds = courseIds;
      if (q.courseId) {
        if (!courseIds.includes(q.courseId)) throw errors.notFound('Curso no encontrado');
        allowedCourseIds = [q.courseId];
      }

      const modules = await db
        .select()
        .from(schema.modules)
        .where(inArray(schema.modules.courseId, allowedCourseIds));
      const moduleIds = modules.map((m) => m.id);
      if (moduleIds.length === 0) return { data: [], totals: { pending: 0, graded: 0 } };

      const assessments = await db
        .select()
        .from(schema.assessments)
        .where(
          and(
            inArray(schema.assessments.moduleId, moduleIds),
            eq(schema.assessments.type, 'essay'),
          ),
        );
      const assessmentIds = assessments.map((a) => a.id);
      if (assessmentIds.length === 0) return { data: [], totals: { pending: 0, graded: 0 } };

      const baseAttempts = await db
        .select()
        .from(schema.assessmentAttempts)
        .where(
          and(
            inArray(schema.assessmentAttempts.assessmentId, assessmentIds),
            isNotNull(schema.assessmentAttempts.submittedAt),
          ),
        )
        .orderBy(desc(schema.assessmentAttempts.submittedAt));

      const totals = {
        pending: baseAttempts.filter((a) => a.status === 'submitted').length,
        graded: baseAttempts.filter((a) => a.status === 'graded').length,
      };

      const filtered =
        status === 'all' ? baseAttempts : baseAttempts.filter((a) => a.status === status);

      const enrollmentIds = Array.from(new Set(filtered.map((a) => a.enrollmentId)));
      const enrollments = enrollmentIds.length
        ? await db
            .select()
            .from(schema.enrollments)
            .where(inArray(schema.enrollments.id, enrollmentIds))
        : [];
      const enrollById = new Map(enrollments.map((e) => [e.id, e]));
      const userIds = Array.from(new Set(enrollments.map((e) => e.userId)));
      const users = userIds.length
        ? await db
            .select({
              id: schema.users.id,
              email: schema.users.email,
              name: schema.users.name,
              avatarUrl: schema.users.avatarUrl,
            })
            .from(schema.users)
            .where(inArray(schema.users.id, userIds))
        : [];
      const userById = new Map(users.map((u) => [u.id, u]));
      const assessmentById = new Map(assessments.map((a) => [a.id, a]));
      const moduleById = new Map(modules.map((m) => [m.id, m]));
      const courses = await db
        .select({
          id: schema.courses.id,
          title: schema.courses.title,
          slug: schema.courses.slug,
        })
        .from(schema.courses)
        .where(inArray(schema.courses.id, allowedCourseIds));
      const courseById = new Map(courses.map((c) => [c.id, c]));

      const data = filtered.map((at) => {
        const e = enrollById.get(at.enrollmentId);
        const u = e ? userById.get(e.userId) : null;
        const a = assessmentById.get(at.assessmentId);
        const m = a ? moduleById.get(a.moduleId) : null;
        const c = m ? courseById.get(m.courseId) : null;
        return {
          attemptId: at.id,
          enrollmentId: at.enrollmentId,
          status: at.status,
          score: at.score,
          submittedAt: at.submittedAt,
          gradedAt: at.gradedAt,
          attemptNumber: at.attemptNumber,
          assessment: a
            ? {
                id: a.id,
                title: a.title,
                maxScore: a.maxScore,
                passingScore: a.passingScore,
                weight: a.weight,
              }
            : null,
          module: m ? { id: m.id, title: m.title } : null,
          course: c ? { id: c.id, title: c.title, slug: c.slug } : null,
          student: {
            email: u?.email ?? e?.studentEmail ?? null,
            name: u?.name ?? e?.studentName ?? null,
            avatarUrl: u?.avatarUrl ?? null,
          },
        };
      });

      return { data, totals };
    },
  );

  // ─── Detalle de attempt para grading ────────────────────────────────────────
  app.get(
    '/v1/me/teacher/attempts/:attemptId',
    {
      preHandler: [app.requireAuth(['teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req) => {
      const { attemptId } = req.params as { attemptId: string };
      const userId = req.auth!.userId;
      const db = getDb();
      const attempt = await db.query.assessmentAttempts.findFirst({
        where: eq(schema.assessmentAttempts.id, attemptId),
      });
      if (!attempt) throw errors.notFound('Intento no encontrado');
      const assessment = await db.query.assessments.findFirst({
        where: eq(schema.assessments.id, attempt.assessmentId),
      });
      if (!assessment) throw errors.notFound('Evaluación no encontrada');
      const m = await db.query.modules.findFirst({
        where: eq(schema.modules.id, assessment.moduleId),
      });
      if (!m) throw errors.notFound('Módulo no encontrado');
      await assertTeacherCourse(userId, m.courseId);

      const course = await db.query.courses.findFirst({ where: eq(schema.courses.id, m.courseId) });
      const enrollment = await db.query.enrollments.findFirst({
        where: eq(schema.enrollments.id, attempt.enrollmentId),
      });
      const user = enrollment
        ? ((
            await db
              .select({
                id: schema.users.id,
                email: schema.users.email,
                name: schema.users.name,
                avatarUrl: schema.users.avatarUrl,
              })
              .from(schema.users)
              .where(eq(schema.users.id, enrollment.userId))
              .limit(1)
          )[0] ?? null)
        : null;

      const questions = await db
        .select()
        .from(schema.assessmentQuestions)
        .where(eq(schema.assessmentQuestions.assessmentId, assessment.id))
        .orderBy(asc(schema.assessmentQuestions.orderIndex));

      const answers = (attempt.answers ?? {}) as Record<string, unknown>;

      // Otros intentos de este enrollment+assessment.
      const otherAttempts = await db
        .select()
        .from(schema.assessmentAttempts)
        .where(
          and(
            eq(schema.assessmentAttempts.enrollmentId, attempt.enrollmentId),
            eq(schema.assessmentAttempts.assessmentId, assessment.id),
          ),
        )
        .orderBy(desc(schema.assessmentAttempts.attemptNumber));

      return {
        data: {
          attempt: {
            id: attempt.id,
            attemptNumber: attempt.attemptNumber,
            status: attempt.status,
            score: attempt.score,
            feedback: attempt.feedback,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            gradedAt: attempt.gradedAt,
            gradedBy: attempt.gradedBy,
          },
          assessment: {
            id: assessment.id,
            title: assessment.title,
            type: assessment.type,
            description: assessment.description,
            weight: assessment.weight,
            maxScore: assessment.maxScore,
            passingScore: assessment.passingScore,
          },
          module: { id: m.id, title: m.title },
          course: course ? { id: course.id, title: course.title, slug: course.slug } : null,
          enrollment: enrollment
            ? {
                id: enrollment.id,
                userId: enrollment.userId,
                email: user?.email ?? enrollment.studentEmail,
                name: user?.name ?? enrollment.studentName,
                avatarUrl: user?.avatarUrl ?? null,
              }
            : null,
          questions: questions.map((q) => ({
            id: q.id,
            prompt: q.prompt,
            kind: q.kind,
            options: q.options,
            points: q.points,
            orderIndex: q.orderIndex,
            // Para essays no hay correctAnswer; para mc/tf sí.
            correctAnswer: assessment.type === 'essay' ? null : q.correctAnswer,
            studentAnswer: answers[q.id] ?? null,
          })),
          history: otherAttempts.map((at) => ({
            id: at.id,
            attemptNumber: at.attemptNumber,
            status: at.status,
            score: at.score,
            submittedAt: at.submittedAt,
            gradedAt: at.gradedAt,
          })),
        },
      };
    },
  );

  // ─── Calificar un attempt manualmente ───────────────────────────────────────
  app.post(
    '/v1/me/teacher/attempts/:attemptId/grade',
    {
      preHandler: [app.requireAuth(['teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: gradeSchema },
    },
    async (req) => {
      const { attemptId } = req.params as { attemptId: string };
      const body = gradeSchema.parse(req.body);
      const userId = req.auth!.userId;
      const db = getDb();

      const attempt = await db.query.assessmentAttempts.findFirst({
        where: eq(schema.assessmentAttempts.id, attemptId),
      });
      if (!attempt) throw errors.notFound('Intento no encontrado');
      if (attempt.status === 'graded' || attempt.score != null || attempt.gradedAt) {
        throw errors.forbidden('Sólo la institución puede editar notas ya calificadas.');
      }
      if (attempt.status !== 'submitted') {
        throw errors.conflict('Sólo se pueden calificar intentos enviados.');
      }

      const assessment = await db.query.assessments.findFirst({
        where: eq(schema.assessments.id, attempt.assessmentId),
      });
      if (!assessment) throw errors.notFound('Evaluación no encontrada');

      const moduleRow = await db.query.modules.findFirst({
        where: eq(schema.modules.id, assessment.moduleId),
      });
      if (!moduleRow) throw errors.notFound('Módulo no encontrado');

      await assertTeacherCourse(userId, moduleRow.courseId);

      const enrollment = await db.query.enrollments.findFirst({
        where: and(
          eq(schema.enrollments.id, attempt.enrollmentId),
          eq(schema.enrollments.courseId, moduleRow.courseId),
        ),
      });
      if (!enrollment) throw errors.notFound('Inscripción no encontrada');

      const [updated] = await db
        .update(schema.assessmentAttempts)
        .set({
          status: 'graded',
          score: body.score,
          feedback: body.feedback ?? null,
          gradedBy: userId,
          gradedAt: new Date(),
        })
        .where(eq(schema.assessmentAttempts.id, attempt.id))
        .returning();

      await recalculateModuleScore(enrollment.id, moduleRow.id);
      await recalculateFinalScore(enrollment.id);

      return { data: updated };
    },
  );

  // ─── Marcar progreso de módulo manualmente (para clases offline) ────────────
  const progressSchema = z.object({
    status: z.enum(['not_started', 'in_progress', 'completed']),
    score: z.number().int().min(0).max(100).optional().nullable(),
    note: z.string().max(2000).optional().nullable(),
  });
  app.patch(
    '/v1/me/teacher/enrollments/:enrollmentId/modules/:moduleId/progress',
    {
      preHandler: [app.requireAuth(['teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: progressSchema },
    },
    async (req) => {
      const { enrollmentId, moduleId } = req.params as {
        enrollmentId: string;
        moduleId: string;
      };
      const body = progressSchema.parse(req.body);
      const userId = req.auth!.userId;
      const db = getDb();

      const enrollment = await db.query.enrollments.findFirst({
        where: eq(schema.enrollments.id, enrollmentId),
      });
      if (!enrollment) throw errors.notFound('Inscripción no encontrada');

      const moduleRow = await db.query.modules.findFirst({
        where: and(
          eq(schema.modules.id, moduleId),
          eq(schema.modules.courseId, enrollment.courseId),
        ),
      });
      if (!moduleRow) throw errors.notFound('Módulo no encontrado');

      await assertTeacherCourse(userId, enrollment.courseId);

      const existing = await db.query.moduleProgress.findFirst({
        where: and(
          eq(schema.moduleProgress.enrollmentId, enrollment.id),
          eq(schema.moduleProgress.moduleId, moduleRow.id),
        ),
      });
      const hasExistingGrade =
        existing?.score != null || Boolean(existing?.note) || existing?.status === 'completed';
      if (existing && hasExistingGrade) {
        const nextNote = body.note ?? null;
        const changesExistingGrade =
          body.status !== existing.status ||
          (body.score != null && body.score !== existing.score) ||
          (nextNote != null && nextNote !== existing.note);
        if (changesExistingGrade) {
          throw errors.forbidden('Sólo la institución puede editar notas ya calificadas.');
        }
      }

      if (body.status === 'completed' && body.score == null && existing?.score == null) {
        throw errors.badRequest('Debes ingresar un score para completar el módulo.');
      }

      const now = new Date();
      const nextScore =
        body.status === 'not_started'
          ? null
          : body.score != null
            ? body.score
            : body.status === 'completed'
              ? (existing?.score ?? null)
              : null;

      if (existing) {
        await db
          .update(schema.moduleProgress)
          .set({
            status: body.status,
            score: nextScore,
            note: body.note ?? null,
            startedAt: body.status === 'not_started' ? null : (existing.startedAt ?? now),
            completedAt: body.status === 'completed' ? now : null,
            updatedBy: userId,
            updatedAt: now,
          })
          .where(eq(schema.moduleProgress.id, existing.id));
      } else {
        await db.insert(schema.moduleProgress).values({
          enrollmentId: enrollment.id,
          moduleId: moduleRow.id,
          status: body.status,
          score: nextScore,
          note: body.note ?? null,
          startedAt: body.status === 'not_started' ? null : now,
          completedAt: body.status === 'completed' ? now : null,
          updatedBy: userId,
        });
      }

      await recalculateFinalScore(enrollment.id);
      return { ok: true };
    },
  );
}
