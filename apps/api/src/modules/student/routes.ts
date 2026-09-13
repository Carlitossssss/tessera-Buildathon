import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, count, desc, eq, inArray, or, sql } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { errors } from '@tessera/shared/errors';
import { env } from '../../config/env.js';
import { explorerFor, networkFor, nftUrlFor } from '../../config/networks.js';
import { contractAddresses } from '../../services/nonce.js';

/**
 * Endpoints exclusivos del rol estudiante. Todo lo que devuelven se filtra
 * por el `userId` (o por `email` para certificados emitidos antes de que el
 * estudiante existiera como usuario) — un estudiante NUNCA puede ver datos
 * de otro estudiante.
 */
export default async function studentRoutes(app: FastifyInstance) {
  // ─── Dashboard ──────────────────────────────────────────────────────────────
  app.get(
    '/v1/me/student/dashboard',
    {
      preHandler: [app.requireAuth(['student']), app.rateLimit()],
      schema: { tags: ['Student'], description: 'KPIs del estudiante.' },
    },
    async (req) => {
      const userId = req.auth!.userId;
      const db = getDb();

      const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
      if (!user) throw errors.notFound('Usuario');

      const enrollments = await db
        .select()
        .from(schema.enrollments)
        .where(eq(schema.enrollments.userId, userId));
      const enrollmentIds = enrollments.map((e) => e.id);

      const inProgress = enrollments.filter((e) => e.startedAt && !e.completedAt).length;
      const completed = enrollments.filter((e) => !!e.completedAt).length;
      const notStarted = enrollments.filter((e) => !e.startedAt && !e.completedAt).length;

      // Certificados emitidos a este usuario (o a su email).
      const certs = await db
        .select()
        .from(schema.certificates)
        .where(
          or(
            eq(schema.certificates.studentUserId, userId),
            eq(schema.certificates.studentEmail, user.email),
          )!,
        );
      const issued = certs.filter((c) => c.status === 'issued').length;

      // Badges propios (los que hayan sido vinculados a su userId).
      const badgesRows = await db
        .select({ n: count() })
        .from(schema.badges)
        .where(eq(schema.badges.studentUserId, userId));
      const badgesCount = Number(badgesRows[0]?.n ?? 0);

      // Pendientes de calificar (essays submitted del propio estudiante).
      let pendingGrading = 0;
      if (enrollmentIds.length) {
        const r = await db
          .select({ n: count() })
          .from(schema.assessmentAttempts)
          .where(
            and(
              inArray(schema.assessmentAttempts.enrollmentId, enrollmentIds),
              eq(schema.assessmentAttempts.status, 'submitted'),
            ),
          );
        pendingGrading = Number(r[0]?.n ?? 0);
      }

      // Promedio de notas finales (sólo cursos completados con score).
      const finalScores = enrollments
        .map((e) => e.finalScore)
        .filter((s): s is number => typeof s === 'number');
      const avgFinalScore = finalScores.length
        ? Math.round(finalScores.reduce((a, b) => a + b, 0) / finalScores.length)
        : null;

      // Cursos activos con info para mostrar en el dashboard.
      const activeEnrollments = enrollments
        .filter((e) => !e.completedAt)
        .sort((a, b) => {
          const ta = (a.startedAt ?? a.createdAt).valueOf();
          const tb = (b.startedAt ?? b.createdAt).valueOf();
          return tb - ta;
        })
        .slice(0, 4);

      const activeCourseIds = activeEnrollments.map((e) => e.courseId);
      const activeCourses = activeCourseIds.length
        ? await db.select().from(schema.courses).where(inArray(schema.courses.id, activeCourseIds))
        : [];
      const activeCoursesById = new Map(activeCourses.map((c) => [c.id, c]));
      const activeInstitutionIds = Array.from(new Set(activeCourses.map((c) => c.institutionId)));
      const activeInstitutions = activeInstitutionIds.length
        ? await db
            .select()
            .from(schema.institutions)
            .where(inArray(schema.institutions.id, activeInstitutionIds))
        : [];
      const activeInstitutionsById = new Map(activeInstitutions.map((i) => [i.id, i]));

      // Conteo de módulos por curso y avance.
      const allCourseIds = enrollments.map((e) => e.courseId);
      const moduleCounts = allCourseIds.length
        ? await db
            .select({
              courseId: schema.modules.courseId,
              total: count(),
            })
            .from(schema.modules)
            .where(inArray(schema.modules.courseId, allCourseIds))
            .groupBy(schema.modules.courseId)
        : [];
      const totalModulesByCourse = new Map(moduleCounts.map((r) => [r.courseId, Number(r.total)]));

      const completedModulesByEnrollment = enrollmentIds.length
        ? await db
            .select({
              enrollmentId: schema.moduleProgress.enrollmentId,
              completed: count(),
            })
            .from(schema.moduleProgress)
            .where(
              and(
                inArray(schema.moduleProgress.enrollmentId, enrollmentIds),
                eq(schema.moduleProgress.status, 'completed'),
              ),
            )
            .groupBy(schema.moduleProgress.enrollmentId)
        : [];
      const completedModulesById = new Map(
        completedModulesByEnrollment.map((r) => [r.enrollmentId, Number(r.completed)]),
      );

      const activeCoursesPayload = activeEnrollments.map((e) => {
        const c = activeCoursesById.get(e.courseId);
        const inst = c ? activeInstitutionsById.get(c.institutionId) : null;
        const total = totalModulesByCourse.get(e.courseId) ?? 0;
        const done = completedModulesById.get(e.id) ?? 0;
        return {
          enrollmentId: e.id,
          courseId: e.courseId,
          courseTitle: c?.title ?? 'Curso',
          courseSlug: c?.slug ?? null,
          thumbnailUrl: c?.thumbnailUrl ?? null,
          institutionName: inst?.name ?? null,
          institutionSlug: inst?.slug ?? null,
          institutionLogoUrl: inst?.logoUrl ?? null,
          institutionStatus: inst?.status ?? null,
          institutionSuspensionReason: null,
          status: e.completedAt ? 'completed' : e.startedAt ? 'in_progress' : 'not_started',
          startedAt: e.startedAt,
          totalModules: total,
          completedModules: done,
          progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
        };
      });

      // Actividad reciente: últimos 6 attempts del estudiante.
      let recentActivity: Array<{
        attemptId: string;
        status: string;
        score: number | null;
        submittedAt: Date | null;
        assessmentTitle: string;
        moduleTitle: string;
        courseTitle: string;
        enrollmentId: string;
      }> = [];
      if (enrollmentIds.length) {
        const recent = await db
          .select()
          .from(schema.assessmentAttempts)
          .where(inArray(schema.assessmentAttempts.enrollmentId, enrollmentIds))
          .orderBy(desc(schema.assessmentAttempts.submittedAt))
          .limit(6);
        const aIds = recent.map((r) => r.assessmentId);
        const assessments = aIds.length
          ? await db.select().from(schema.assessments).where(inArray(schema.assessments.id, aIds))
          : [];
        const moduleIdsSet = Array.from(new Set(assessments.map((a) => a.moduleId)));
        const modules = moduleIdsSet.length
          ? await db.select().from(schema.modules).where(inArray(schema.modules.id, moduleIdsSet))
          : [];
        const courseIdsSet = Array.from(new Set(modules.map((m) => m.courseId)));
        const courses = courseIdsSet.length
          ? await db.select().from(schema.courses).where(inArray(schema.courses.id, courseIdsSet))
          : [];
        const aBy = new Map(assessments.map((a) => [a.id, a]));
        const mBy = new Map(modules.map((m) => [m.id, m]));
        const cBy = new Map(courses.map((c) => [c.id, c]));
        recentActivity = recent
          .filter((r) => r.submittedAt)
          .map((r) => {
            const a = aBy.get(r.assessmentId);
            const m = a ? mBy.get(a.moduleId) : null;
            const c = m ? cBy.get(m.courseId) : null;
            return {
              attemptId: r.id,
              status: r.status,
              score: r.score,
              submittedAt: r.submittedAt,
              assessmentTitle: a?.title ?? 'Evaluación',
              moduleTitle: m?.title ?? 'Módulo',
              courseTitle: c?.title ?? 'Curso',
              enrollmentId: r.enrollmentId,
            };
          });
      }

      return {
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            walletAddress: user.walletAddress,
            locale: user.locale,
            emailVerifiedAt: user.emailVerifiedAt,
          },
          counts: {
            enrollments: enrollments.length,
            inProgress,
            completed,
            notStarted,
            certificates: certs.length,
            certificatesIssued: issued,
            badges: badgesCount,
            pendingGrading,
          },
          avgFinalScore,
          activeCourses: activeCoursesPayload,
          recentActivity,
        },
      };
    },
  );

  // ─── Lista completa de mis inscripciones ───────────────────────────────────
  app.get(
    '/v1/me/student/courses',
    {
      preHandler: [app.requireAuth(['student']), app.rateLimit()],
      schema: { tags: ['Student'], description: 'Cursos en los que estoy inscrito, con avance.' },
    },
    async (req) => {
      const userId = req.auth!.userId;
      const db = getDb();

      const enrollments = await db
        .select()
        .from(schema.enrollments)
        .where(eq(schema.enrollments.userId, userId))
        .orderBy(desc(schema.enrollments.createdAt));
      if (enrollments.length === 0) {
        return { data: [], totals: { total: 0, inProgress: 0, completed: 0, notStarted: 0 } };
      }

      const enrollmentIds = enrollments.map((e) => e.id);
      const courseIds = Array.from(new Set(enrollments.map((e) => e.courseId)));
      const courses = await db
        .select()
        .from(schema.courses)
        .where(inArray(schema.courses.id, courseIds));
      const institutionIds = Array.from(new Set(courses.map((c) => c.institutionId)));
      const institutions = institutionIds.length
        ? await db
            .select()
            .from(schema.institutions)
            .where(inArray(schema.institutions.id, institutionIds))
        : [];

      const moduleCounts = await db
        .select({ courseId: schema.modules.courseId, total: count() })
        .from(schema.modules)
        .where(inArray(schema.modules.courseId, courseIds))
        .groupBy(schema.modules.courseId);
      const totalByCourse = new Map(moduleCounts.map((r) => [r.courseId, Number(r.total)]));

      const completedByEnrollment = await db
        .select({ enrollmentId: schema.moduleProgress.enrollmentId, n: count() })
        .from(schema.moduleProgress)
        .where(
          and(
            inArray(schema.moduleProgress.enrollmentId, enrollmentIds),
            eq(schema.moduleProgress.status, 'completed'),
          ),
        )
        .groupBy(schema.moduleProgress.enrollmentId);
      const completedById = new Map(
        completedByEnrollment.map((r) => [r.enrollmentId, Number(r.n)]),
      );

      const inProgressByEnrollment = await db
        .select({ enrollmentId: schema.moduleProgress.enrollmentId, n: count() })
        .from(schema.moduleProgress)
        .where(
          and(
            inArray(schema.moduleProgress.enrollmentId, enrollmentIds),
            eq(schema.moduleProgress.status, 'in_progress'),
          ),
        )
        .groupBy(schema.moduleProgress.enrollmentId);
      const inProgressById = new Map(
        inProgressByEnrollment.map((r) => [r.enrollmentId, Number(r.n)]),
      );

      const cBy = new Map(courses.map((c) => [c.id, c]));
      const iBy = new Map(institutions.map((i) => [i.id, i]));

      const data = enrollments.map((e) => {
        const c = cBy.get(e.courseId);
        const inst = c ? iBy.get(c.institutionId) : null;
        const total = totalByCourse.get(e.courseId) ?? 0;
        const done = completedById.get(e.id) ?? 0;
        const wip = inProgressById.get(e.id) ?? 0;
        return {
          enrollmentId: e.id,
          courseId: e.courseId,
          courseTitle: c?.title ?? 'Curso',
          courseSlug: c?.slug ?? null,
          courseDescription: c?.description ?? null,
          thumbnailUrl: c?.thumbnailUrl ?? null,
          passingScore: c?.passingScore ?? null,
          institutionId: c?.institutionId ?? null,
          institutionName: inst?.name ?? null,
          institutionSlug: inst?.slug ?? null,
          institutionLogoUrl: inst?.logoUrl ?? null,
          institutionStatus: inst?.status ?? null,
          institutionSuspensionReason: null,
          enrollmentSource: e.enrollmentSource,
          startedAt: e.startedAt,
          completedAt: e.completedAt,
          finalScore: e.finalScore,
          status: e.completedAt ? 'completed' : e.startedAt ? 'in_progress' : 'not_started',
          totalModules: total,
          completedModules: done,
          inProgressModules: wip,
          progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
          createdAt: e.createdAt,
        };
      });

      return {
        data,
        totals: {
          total: data.length,
          inProgress: data.filter((d) => d.status === 'in_progress').length,
          completed: data.filter((d) => d.status === 'completed').length,
          notStarted: data.filter((d) => d.status === 'not_started').length,
        },
      };
    },
  );

  // ─── Mis certificados ──────────────────────────────────────────────────────
  app.get(
    '/v1/me/student/certificates',
    {
      preHandler: [app.requireAuth(['student']), app.rateLimit()],
      schema: { tags: ['Student'], description: 'Certificados emitidos a mi nombre.' },
    },
    async (req) => {
      const userId = req.auth!.userId;
      const db = getDb();
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
      if (!user) throw errors.notFound('Usuario');

      const rows = await db
        .select()
        .from(schema.certificates)
        .where(
          or(
            eq(schema.certificates.studentUserId, userId),
            eq(schema.certificates.studentEmail, user.email),
          )!,
        )
        .orderBy(desc(schema.certificates.issuedAt));

      const institutionIds = Array.from(new Set(rows.map((r) => r.institutionId)));
      const institutions = institutionIds.length
        ? await db
            .select()
            .from(schema.institutions)
            .where(inArray(schema.institutions.id, institutionIds))
        : [];
      const iBy = new Map(institutions.map((i) => [i.id, i]));

      const courseIds = Array.from(
        new Set(rows.map((r) => r.courseId).filter((v): v is string => !!v)),
      );
      const courses = courseIds.length
        ? await db.select().from(schema.courses).where(inArray(schema.courses.id, courseIds))
        : [];
      const cBy = new Map(courses.map((c) => [c.id, c]));

      // Replicas en redes secundarias.
      //
      // El estudiante veia solo la red de emision, asi que su credencial
      // parecia existir en un unico sitio cuando en realidad esta tambien en
      // Avalanche, con su propio numero de token. Es su credencial: tiene que
      // poder verla entera y enseñarla en cualquiera de las dos.
      const certificateIds = rows.map((r) => r.id);
      const mirrors = certificateIds.length
        ? await db
            .select()
            .from(schema.certificateMirrors)
            .where(inArray(schema.certificateMirrors.certificateId, certificateIds))
        : [];
      const mirrorsBy = new Map<string, typeof mirrors>();
      for (const m of mirrors) {
        const list = mirrorsBy.get(m.certificateId) ?? [];
        list.push(m);
        mirrorsBy.set(m.certificateId, list);
      }

      return {
        data: rows.map((r) => {
          const inst = iBy.get(r.institutionId);
          const c = r.courseId ? cBy.get(r.courseId) : null;
          return {
            id: r.id,
            status: r.status,
            achievementName: r.achievementName,
            achievementDescription: r.achievementDescription,
            grade: r.grade,
            tokenId: r.onchainTokenId?.toString() ?? null,
            txHash: r.txHash,
            tokenUri: r.tokenUri,
            ipfsCid: r.ipfsCid,
            arweaveTxId: r.arweaveTxId,
            issuedAt: r.issuedAt,
            revokedAt: r.revokedAt,
            studentWallet: r.studentWallet,
            failureReason: r.failureReason,
            institutionId: r.institutionId,
            institutionName: inst?.name ?? null,
            institutionSlug: inst?.slug ?? null,
            institutionLogoUrl: inst?.logoUrl ?? null,
            courseId: r.courseId,
            courseTitle: c?.title ?? null,
            courseSlug: c?.slug ?? null,
            // Pagina publica de la credencial: es la que el egresado comparte
            // con un empleador, y desde aqui no habia forma de llegar a ella.
            verifyUrl: r.onchainTokenId
              ? `${env.AUTH_URL.replace(/\/$/, '')}/verify/${r.onchainTokenId.toString()}`
              : null,
            // Cada red donde vive la credencial. El tokenId no coincide entre
            // cadenas --cada contrato lleva su propio contador--, de modo que
            // enseñar el de la red principal manda a buscar un token que no es.
            networks: [
              {
                chainId: env.POLYGON_CHAIN_ID,
                name: networkFor(env.POLYGON_CHAIN_ID)?.name ?? 'Red principal',
                role: 'issuance' as const,
                status: r.txHash ? 'confirmed' : r.status,
                tokenId: r.onchainTokenId?.toString() ?? null,
                nftUrl: r.onchainTokenId
                  ? nftUrlFor(
                      env.POLYGON_CHAIN_ID,
                      contractAddresses.certificate,
                      r.onchainTokenId.toString(),
                    )
                  : null,
                txUrl: r.txHash
                  ? `${explorerFor(env.POLYGON_CHAIN_ID)?.replace(/\/$/, '') ?? ''}/tx/${r.txHash}`
                  : null,
              },
              ...(mirrorsBy.get(r.id) ?? []).flatMap((m) => {
                const net = networkFor(m.chainId);
                if (!net) return [];
                const mirrorTokenId = m.onchainTokenId?.toString() ?? null;
                const explorer = net.explorer.replace(/\/$/, '');
                return [
                  {
                    chainId: m.chainId,
                    name: net.name,
                    role: 'mirror' as const,
                    status: m.status,
                    tokenId: mirrorTokenId,
                    nftUrl: mirrorTokenId
                      ? nftUrlFor(m.chainId, net.contracts.certificate, mirrorTokenId)
                      : null,
                    txUrl: m.txHash ? `${explorer}/tx/${m.txHash}` : null,
                  },
                ];
              }),
            ],
          };
        }),
      };
    },
  );

  // ─── Mis badges ───────────────────────────────────────────────────────────
  app.get(
    '/v1/me/student/badges',
    {
      preHandler: [app.requireAuth(['student']), app.rateLimit()],
      schema: { tags: ['Student'], description: 'Badges (ERC-1155) emitidos a mi wallet.' },
    },
    async (req) => {
      const userId = req.auth!.userId;
      const db = getDb();

      const rows = await db
        .select()
        .from(schema.badges)
        .where(eq(schema.badges.studentUserId, userId))
        .orderBy(desc(schema.badges.issuedAt));

      if (rows.length === 0) return { data: [] };

      const collectionIds = Array.from(new Set(rows.map((r) => r.collectionId)));
      const collections = await db
        .select()
        .from(schema.badgeCollections)
        .where(inArray(schema.badgeCollections.id, collectionIds));
      const colBy = new Map(collections.map((c) => [c.id, c]));
      const institutionIds = Array.from(new Set(collections.map((c) => c.institutionId)));
      const institutions = institutionIds.length
        ? await db
            .select()
            .from(schema.institutions)
            .where(inArray(schema.institutions.id, institutionIds))
        : [];
      const iBy = new Map(institutions.map((i) => [i.id, i]));

      return {
        data: rows.map((b) => {
          const col = colBy.get(b.collectionId);
          const inst = col ? iBy.get(col.institutionId) : null;
          return {
            id: b.id,
            collectionId: b.collectionId,
            collectionName: col?.name ?? 'Colección',
            collectionDescription: col?.description ?? null,
            imageUrl: col?.imageUrl ?? null,
            institutionName: inst?.name ?? null,
            institutionSlug: inst?.slug ?? null,
            studentWallet: b.studentWallet,
            amount: b.amount,
            txHash: b.txHash,
            issuedAt: b.issuedAt,
            tokenUri: col?.tokenUri ?? null,
          };
        }),
      };
    },
  );

  // ─── Mi wallet (custodia / propia) ─────────────────────────────────────────
  app.get(
    '/v1/me/student/wallet',
    {
      preHandler: [app.requireAuth(['student']), app.rateLimit()],
      schema: { tags: ['Student'], description: 'Wallet del estudiante y NFTs asociados.' },
    },
    async (req) => {
      const userId = req.auth!.userId;
      const db = getDb();
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
      if (!user) throw errors.notFound('Usuario');

      const issued = await db
        .select({
          id: schema.certificates.id,
          tokenId: schema.certificates.onchainTokenId,
          achievementName: schema.certificates.achievementName,
          txHash: schema.certificates.txHash,
          issuedAt: schema.certificates.issuedAt,
        })
        .from(schema.certificates)
        .where(
          and(
            or(
              eq(schema.certificates.studentUserId, userId),
              eq(schema.certificates.studentEmail, user.email),
            )!,
            eq(schema.certificates.status, 'issued'),
          ),
        )
        .orderBy(desc(schema.certificates.issuedAt));

      const badgesRows = await db
        .select({ n: count() })
        .from(schema.badges)
        .where(eq(schema.badges.studentUserId, userId));

      return {
        data: {
          walletAddress: user.walletAddress,
          custodyMode: user.walletAddress ? 'tessera' : 'none',
          network: env.POLYGON_CHAIN,
          chainId: env.POLYGON_CHAIN_ID,
          counts: {
            certificates: issued.length,
            badges: Number(badgesRows[0]?.n ?? 0),
          },
          certificates: issued.map((c) => ({
            id: c.id,
            tokenId: c.tokenId?.toString() ?? null,
            achievementName: c.achievementName,
            txHash: c.txHash,
            issuedAt: c.issuedAt,
          })),
        },
      };
    },
  );

  // ─── Mi perfil ─────────────────────────────────────────────────────────────
  app.get(
    '/v1/me/student/profile',
    {
      preHandler: [app.requireAuth(['student']), app.rateLimit()],
      schema: { tags: ['Student'] },
    },
    async (req) => {
      const userId = req.auth!.userId;
      const db = getDb();
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
      if (!user) throw errors.notFound('Usuario');

      const [enrollmentsCount] = await db
        .select({ n: count() })
        .from(schema.enrollments)
        .where(eq(schema.enrollments.userId, userId));
      const [completedCount] = await db
        .select({ n: count() })
        .from(schema.enrollments)
        .where(
          and(
            eq(schema.enrollments.userId, userId),
            sql`${schema.enrollments.completedAt} is not null`,
          ),
        );
      const [certsCount] = await db
        .select({ n: count() })
        .from(schema.certificates)
        .where(
          and(
            or(
              eq(schema.certificates.studentUserId, userId),
              eq(schema.certificates.studentEmail, user.email),
            )!,
            eq(schema.certificates.status, 'issued'),
          ),
        );

      return {
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          walletAddress: user.walletAddress,
          locale: user.locale,
          emailVerifiedAt: user.emailVerifiedAt,
          twoFactorEnabled: user.twoFactorEnabled,
          createdAt: user.createdAt,
          stats: {
            enrollments: Number(enrollmentsCount?.n ?? 0),
            completed: Number(completedCount?.n ?? 0),
            certificates: Number(certsCount?.n ?? 0),
          },
        },
      };
    },
  );

  app.patch(
    '/v1/me/student/profile',
    {
      preHandler: [app.requireAuth(['student']), app.rateLimit()],
      schema: {
        tags: ['Student'],
        body: z.object({
          name: z.string().min(2).max(200).optional(),
          locale: z.enum(['es', 'en', 'pt']).optional(),
          avatarUrl: z.string().url().max(500).nullable().optional(),
        }),
      },
    },
    async (req) => {
      const userId = req.auth!.userId;
      const body = z
        .object({
          name: z.string().min(2).max(200).optional(),
          locale: z.enum(['es', 'en', 'pt']).optional(),
          avatarUrl: z.string().url().max(500).nullable().optional(),
        })
        .parse(req.body);
      const db = getDb();
      const [updated] = await db
        .update(schema.users)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(schema.users.id, userId))
        .returning({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          avatarUrl: schema.users.avatarUrl,
          locale: schema.users.locale,
        });
      return { data: updated };
    },
  );
}
