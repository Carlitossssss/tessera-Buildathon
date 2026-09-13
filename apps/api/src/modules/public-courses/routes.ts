import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, count, desc, eq, inArray, sql } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { errors } from '@tessera/shared/errors';
import { ethereumAddressSchema } from '@tessera/shared/schemas';
import { assertCourseInstitutionActive } from '../../services/institution-access.js';
import {
  canSeeModuleContent,
  isGateUsable,
  markPreviewable,
  previewModuleLimit,
  requiresMembership,
} from '../../services/course-access.js';
import {
  buildCheckoutUrl,
  checkMembership,
  getLockInfo,
  membershipScope,
  unlockNetworkLabel,
  verifyWalletOwnership,
} from '../../services/unlock.js';
import {
  readAccreditationOnchain,
  readableAccreditationChainIds,
} from '../../services/institution-accreditation.js';
import { networkFor } from '../../config/networks.js';
import { env } from '../../config/env.js';
import {
  getContinuityReserveCents,
  getPricingVersion,
  getSubscriptionPlans,
  getTscNominalValueCents,
  getTscPackages,
  getTscPerCertificate,
} from '../../services/payments/catalog.js';

/**
 * RPC publico por red, para que el comando `cast` que devolvemos sea
 * ejecutable tal cual. Se declaran aqui y no se toman de env porque el valor
 * de estos comandos es que NO dependan de nuestra configuracion privada.
 */
const ACCREDITATION_RPC_HINTS: Record<number, string> = {
  80002: 'https://polygon-amoy-bor-rpc.publicnode.com',
  133: 'https://testnet.hsk.xyz',
};

/** Prueba de propiedad de la wallet mas la firma que la respalda. */
const membershipEnrollSchema = z.object({
  wallet: ethereumAddressSchema,
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, 'signature debe ser hex'),
  issuedAt: z.coerce.number().int().positive(),
});

async function createCourseEnrollment(input: {
  courseId: string;
  institutionId: string;
  userId: string;
  source: 'code' | 'public' | 'unlock';
  /** Membresia que concedio la matricula. Solo para source 'unlock'. */
  membership?: {
    wallet: string;
    lockAddress: string;
    chainId: number;
    keyExpiresAt: Date | null;
  };
}) {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, input.userId),
  });

  const [enrollment] = await db
    .insert(schema.enrollments)
    .values({
      courseId: input.courseId,
      userId: input.userId,
      studentEmail: user?.email ?? null,
      studentName: user?.name ?? null,
      enrollmentSource: input.source,
      // Queda registrado por que se concedio el acceso. Es auditoria: la
      // autorizacion se vuelve a leer del Lock, nunca de estas columnas.
      unlockWallet: input.membership?.wallet ?? null,
      unlockLockAddress: input.membership?.lockAddress ?? null,
      unlockChainId: input.membership?.chainId ?? null,
      unlockKeyExpiresAt: input.membership?.keyExpiresAt ?? null,
    })
    .returning();

  await db
    .insert(schema.institutionStudents)
    .values({
      institutionId: input.institutionId,
      userId: input.userId,
    })
    .onConflictDoNothing();

  const mods = await db
    .select({ id: schema.modules.id })
    .from(schema.modules)
    .where(eq(schema.modules.courseId, input.courseId));
  if (mods.length > 0) {
    await db
      .insert(schema.moduleProgress)
      .values(mods.map((m) => ({ enrollmentId: enrollment!.id, moduleId: m.id })));
  }

  return enrollment!;
}

async function ensureInstitutionStudent(input: { institutionId: string; userId: string }) {
  const db = getDb();
  await db
    .insert(schema.institutionStudents)
    .values({
      institutionId: input.institutionId,
      userId: input.userId,
    })
    .onConflictDoNothing();
}

async function assertStudentProfileApproved(userId: string) {
  const db = getDb();
  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });
  if (profile?.status !== 'approved') {
    throw errors.forbidden(
      'Tu perfil de estudiante debe estar aprobado antes de inscribirte a cursos.',
    );
  }
}

async function isInstitutionStudent(input: { institutionId: string; userId: string }) {
  const db = getDb();
  const member = await db.query.institutionStudents.findFirst({
    where: and(
      eq(schema.institutionStudents.institutionId, input.institutionId),
      eq(schema.institutionStudents.userId, input.userId),
    ),
  });
  if (member) return true;

  const priorEnrollment = await db
    .select({ id: schema.enrollments.id })
    .from(schema.enrollments)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollments.courseId))
    .where(
      and(
        eq(schema.enrollments.userId, input.userId),
        eq(schema.courses.institutionId, input.institutionId),
      ),
    )
    .limit(1);

  return priorEnrollment.length > 0;
}

/**
 * Endpoints públicos para descubrimiento e inscripción a cursos.
 *
 * Modos de acceso:
 *  - public_free  → catálogo abierto, inscripción gratis.
 *  - public_paid  → catálogo abierto, requiere checkout (no implementado aún).
 *  - private_code → no aparece en catálogo, sólo se accede vía /redeem-code.
 *  - hybrid       → aparece en catálogo (de pago para externos) pero los miembros
 *                   de la institución pueden canjear el código y entrar gratis.
 */
export default async function publicCoursesRoutes(app: FastifyInstance) {
  app.get(
    '/v1/public/billing-catalog',
    {
      schema: {
        tags: ['Public'],
        description: 'Planes, paquetes TSC y costo de emisión configurados.',
      },
    },
    async () => ({
      tscPerCertificate: await getTscPerCertificate(),
      tscNominalValueCents: await getTscNominalValueCents(),
      continuityReserveCents: await getContinuityReserveCents(),
      pricingVersion: await getPricingVersion(),
      plans: await getSubscriptionPlans(),
      packages: await getTscPackages(),
    }),
  );

  app.get(
    '/v1/public/stats',
    {
      schema: {
        tags: ['Public'],
        description: 'Metricas publicas agregadas para la landing.',
      },
    },
    async () => {
      const db = getDb();
      const [students, badges, certificates, emissionTime] = await Promise.all([
        db
          .select({
            n: sql<number>`count(distinct coalesce(${schema.certificates.studentUserId}::text, lower(${schema.certificates.studentEmail})))`,
          })
          .from(schema.certificates)
          .where(eq(schema.certificates.status, 'issued')),
        db.select({ n: count() }).from(schema.badges),
        db
          .select({ n: count() })
          .from(schema.certificates)
          .where(eq(schema.certificates.status, 'issued')),
        db
          .select({
            seconds: sql<number>`coalesce(round(avg(extract(epoch from (${schema.certificates.completedAt} - ${schema.certificates.createdAt}))))::int, 0)`,
          })
          .from(schema.certificates)
          .where(eq(schema.certificates.status, 'issued')),
      ]);

      return {
        studentsVerified: Number(students[0]?.n ?? 0),
        badgesShared: Number(badges[0]?.n ?? 0),
        certificatesIssued: Number(certificates[0]?.n ?? 0),
        avgEmissionSeconds: Number(emissionTime[0]?.seconds ?? 0),
      };
    },
  );

  // ─── Catálogo público ─────────────────────────────────────────────────────
  app.get(
    '/v1/public/courses',
    {
      schema: {
        tags: ['Public'],
        description: 'Cursos publicados visibles en el catálogo público.',
      },
    },
    async () => {
      const db = getDb();
      const rows = await db
        .select({
          id: schema.courses.id,
          title: schema.courses.title,
          slug: schema.courses.slug,
          description: schema.courses.description,
          priceCents: schema.courses.priceCents,
          currency: schema.courses.currency,
          visibility: schema.courses.visibility,
          durationHours: schema.courses.durationHours,
          thumbnailUrl: schema.courses.thumbnailUrl,
          institutionId: schema.courses.institutionId,
          institutionName: schema.institutions.name,
          institutionSlug: schema.institutions.slug,
          // El catalogo necesita saber que un curso es token-gated para
          // mostrar el distintivo de membresia sin abrir cada detalle.
          lockAddress: schema.courses.lockAddress,
          lockChainId: schema.courses.lockChainId,
          modulesCount: sql<number>`(select count(*)::int from ${schema.modules} where ${schema.modules.courseId} = ${schema.courses.id})`,
        })
        .from(schema.courses)
        .innerJoin(schema.institutions, eq(schema.institutions.id, schema.courses.institutionId))
        .where(
          and(
            eq(schema.courses.status, 'published'),
            eq(schema.institutions.status, 'approved'),
            inArray(schema.courses.visibility, [
              'public_free',
              'public_paid',
              'hybrid',
              'token_gated',
            ]),
          ),
        )
        .orderBy(desc(schema.courses.createdAt));
      return { data: rows };
    },
  );

  app.get(
    '/v1/public/courses/:slug',
    {
      schema: {
        tags: ['Public'],
        description: 'Detalle público de un curso por institución y slug.',
      },
    },
    async (req) => {
      const params = z.object({ slug: z.string().min(1) }).parse(req.params);
      const query = z.object({ institution: z.string().min(1) }).parse(req.query);
      const db = getDb();

      const institution = await db.query.institutions.findFirst({
        where: and(
          eq(schema.institutions.slug, query.institution),
          eq(schema.institutions.status, 'approved'),
        ),
      });
      if (!institution) throw errors.notFound('Institución no encontrada');

      const course = await db.query.courses.findFirst({
        where: and(
          eq(schema.courses.institutionId, institution.id),
          eq(schema.courses.slug, params.slug),
          eq(schema.courses.status, 'published'),
        ),
      });
      if (!course) throw errors.notFound('Curso no encontrado');
      if (course.visibility === 'private_code') {
        throw errors.notFound('Curso no encontrado');
      }

      const moduleRows = await db
        .select({
          id: schema.modules.id,
          title: schema.modules.title,
          description: schema.modules.description,
          orderIndex: schema.modules.orderIndex,
          contentType: schema.modules.contentType,
          weight: schema.modules.weight,
          isRequired: schema.modules.isRequired,
        })
        .from(schema.modules)
        .where(eq(schema.modules.courseId, course.id))
        .orderBy(schema.modules.orderIndex);

      // El temario se muestra siempre: sin el, nadie sabria que esta
      // comprando. Lo que se protege es el contenido, y eso lo sirve
      // /preview sólo para los modulos de muestra.
      const modules = markPreviewable(course, moduleRows);

      // Datos del Lock para que el visitante vea precio y duracion antes de
      // decidir. Si el RPC no responde, el curso se sigue mostrando: perder
      // el precio es mejor que perder la pagina.
      const membership =
        requiresMembership(course) && course.lockAddress && course.lockChainId
          ? {
              lockAddress: course.lockAddress,
              chainId: course.lockChainId,
              network: unlockNetworkLabel(course.lockChainId),
              checkoutUrl: buildCheckoutUrl(course.lockAddress, course.lockChainId),
              lockInfo: await getLockInfo(course.lockAddress, course.lockChainId).catch(() => null),
              previewModuleCount: previewModuleLimit(course, moduleRows.length),
            }
          : null;

      return {
        course: {
          id: course.id,
          title: course.title,
          slug: course.slug,
          description: course.description,
          priceCents: course.priceCents,
          currency: course.currency,
          visibility: course.visibility,
          durationHours: course.durationHours,
          thumbnailUrl: course.thumbnailUrl,
          passingScore: course.passingScore,
        },
        institution: {
          id: institution.id,
          name: institution.name,
          slug: institution.slug,
          logoUrl: institution.logoUrl,
        },
        membership,
        modules,
      };
    },
  );

  // ─── Previsualizacion del contenido ───────────────────────────────────────
  //
  // Entrega el contenido real de un modulo de muestra. Es la mitad
  // "previsualizar" del recorrido: el visitante prueba una parte antes de
  // decidir. Un modulo fuera de la muestra responde 402 con el camino de
  // compra, nunca el contenido.
  app.get(
    '/v1/public/courses/:id/modules/:moduleId/preview',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Public'],
        description:
          'Contenido de un modulo de muestra. Fuera de la previsualizacion responde 402 con el checkout de Unlock.',
      },
    },
    async (req, reply) => {
      const { id, moduleId } = z
        .object({ id: z.string().uuid(), moduleId: z.string().uuid() })
        .parse(req.params);
      const db = getDb();

      const course = await db.query.courses.findFirst({
        where: and(eq(schema.courses.id, id), eq(schema.courses.status, 'published')),
      });
      if (!course || course.visibility === 'private_code') throw errors.notFound('Curso');

      const moduleRows = await db
        .select({ id: schema.modules.id, orderIndex: schema.modules.orderIndex })
        .from(schema.modules)
        .where(eq(schema.modules.courseId, course.id))
        .orderBy(schema.modules.orderIndex);

      const target = markPreviewable(course, moduleRows).find((m) => m.id === moduleId);
      if (!target) throw errors.notFound('Modulo');

      // La decision de entregar el contenido se toma aqui, en el servidor.
      // El navegador nunca recibe lo que no le corresponde, asi que no hay
      // nada que saltarse desde el cliente.
      if (!canSeeModuleContent({ course, enrolled: false, previewable: target.previewable })) {
        reply.status(402);
        return {
          error: {
            code: 'MEMBERSHIP_REQUIRED',
            message: 'Este modulo requiere una membresia valida para verse completo.',
            ...(course.lockAddress && course.lockChainId
              ? {
                  checkoutUrl: buildCheckoutUrl(course.lockAddress, course.lockChainId),
                  lock: { address: course.lockAddress, chainId: course.lockChainId },
                }
              : {}),
          },
        };
      }

      const full = await db.query.modules.findFirst({
        where: eq(schema.modules.id, moduleId),
      });
      if (!full) throw errors.notFound('Modulo');

      const topics = await db
        .select({
          id: schema.topics.id,
          title: schema.topics.title,
          description: schema.topics.description,
          contentType: schema.topics.contentType,
          content: schema.topics.content,
          orderIndex: schema.topics.orderIndex,
        })
        .from(schema.topics)
        .where(eq(schema.topics.moduleId, moduleId))
        .orderBy(schema.topics.orderIndex);

      return {
        data: {
          id: full.id,
          title: full.title,
          description: full.description,
          contentType: full.contentType,
          content: full.content,
          topics,
          preview: true,
        },
      };
    },
  );

  // ─── Canje de código ──────────────────────────────────────────────────────
  app.post(
    '/v1/public/courses/redeem-code',
    {
      preHandler: [app.requireAuth(['student']), app.rateLimit()],
      schema: {
        tags: ['Public'],
        description: 'Canjea un código y matricula al usuario en el curso correspondiente.',
        body: z.object({ code: z.string().min(4).max(16) }),
      },
    },
    async (req, reply) => {
      const { code } = z.object({ code: z.string().min(4).max(16) }).parse(req.body);
      const normalized = code.trim().toUpperCase();
      const db = getDb();

      const course = await db.query.courses.findFirst({
        where: and(
          eq(schema.courses.accessCode, normalized),
          eq(schema.courses.status, 'published'),
        ),
      });
      if (!course) throw errors.notFound('Código inválido o curso no disponible');
      await assertCourseInstitutionActive(course.id);
      await assertStudentProfileApproved(req.auth!.userId);

      // Modo hybrid: requiere ser estudiante registrado de la institución dueña del curso.
      if (course.visibility === 'hybrid') {
        const member = await isInstitutionStudent({
          institutionId: course.institutionId,
          userId: req.auth!.userId,
        });
        if (!member) {
          throw errors.forbidden(
            'Este código es válido sólo para estudiantes de la institución. Contacta a tu universidad para registrarte.',
          );
        }
      } else if (course.visibility !== 'private_code') {
        throw errors.conflict('Este curso no requiere código de canje');
      }

      const existing = await db.query.enrollments.findFirst({
        where: and(
          eq(schema.enrollments.courseId, course.id),
          eq(schema.enrollments.userId, req.auth!.userId),
        ),
      });
      if (existing) {
        await ensureInstitutionStudent({
          institutionId: course.institutionId,
          userId: req.auth!.userId,
        });
        return reply.status(200).send({
          enrollmentId: existing.id,
          courseId: course.id,
          courseSlug: course.slug,
          alreadyEnrolled: true,
        });
      }

      const enrollment = await createCourseEnrollment({
        courseId: course.id,
        institutionId: course.institutionId,
        userId: req.auth!.userId,
        source: 'code',
      });

      return reply.status(201).send({
        enrollmentId: enrollment.id,
        courseId: course.id,
        courseSlug: course.slug,
        alreadyEnrolled: false,
      });
    },
  );

  app.post(
    '/v1/public/courses/:id/enroll',
    {
      preHandler: [app.requireAuth(['student']), app.rateLimit()],
      schema: {
        tags: ['Public'],
        description:
          'Inscribe a un estudiante autenticado en un curso público gratuito o híbrido si pertenece a la institución.',
      },
    },
    async (req, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const db = getDb();
      const course = await db.query.courses.findFirst({
        where: and(
          eq(schema.courses.id, id),
          eq(schema.courses.status, 'published'),
          inArray(schema.courses.visibility, ['public_free', 'hybrid']),
        ),
      });
      if (!course) throw errors.notFound('Curso no disponible para inscripción gratuita');
      await assertCourseInstitutionActive(course.id);
      await assertStudentProfileApproved(req.auth!.userId);

      if (
        course.visibility === 'hybrid' &&
        !(await isInstitutionStudent({
          institutionId: course.institutionId,
          userId: req.auth!.userId,
        }))
      ) {
        throw errors.forbidden(
          'Este curso es gratis sólo para estudiantes de la institución. Si perteneces a ella, canjea tu código institucional.',
        );
      }

      const existing = await db.query.enrollments.findFirst({
        where: and(
          eq(schema.enrollments.courseId, course.id),
          eq(schema.enrollments.userId, req.auth!.userId),
        ),
      });
      if (existing) {
        await ensureInstitutionStudent({
          institutionId: course.institutionId,
          userId: req.auth!.userId,
        });
        return reply.status(200).send({
          enrollmentId: existing.id,
          courseId: course.id,
          courseSlug: course.slug,
          alreadyEnrolled: true,
        });
      }

      const enrollment = await createCourseEnrollment({
        courseId: course.id,
        institutionId: course.institutionId,
        userId: req.auth!.userId,
        source: 'public',
      });

      return reply.status(201).send({
        enrollmentId: enrollment.id,
        courseId: course.id,
        courseSlug: course.slug,
        alreadyEnrolled: false,
      });
    },
  );

  // ─── Verificar membresia ──────────────────────────────────────────────────
  //
  // Consulta on-chain si una wallet puede matricularse. No matricula ni
  // entrega contenido: sirve para que la pagina muestre el estado antes de
  // pedir la firma.
  app.get(
    '/v1/public/courses/:id/membership',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Public'],
        description:
          'Comprueba on-chain si una wallet tiene membresia valida para un curso token-gated.',
        querystring: z.object({ wallet: ethereumAddressSchema }),
      },
    },
    async (req) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const { wallet } = z.object({ wallet: ethereumAddressSchema }).parse(req.query);
      const db = getDb();

      const course = await db.query.courses.findFirst({
        where: and(eq(schema.courses.id, id), eq(schema.courses.status, 'published')),
      });
      if (!course) throw errors.notFound('Curso');
      if (!requiresMembership(course)) {
        throw errors.conflict('Este curso no usa membresia de Unlock');
      }
      if (!isGateUsable(course)) {
        throw errors.conflict('El curso no tiene un Lock configurado');
      }

      const membership = await checkMembership({
        lockAddress: course.lockAddress!,
        chainId: course.lockChainId!,
        walletAddress: wallet,
      });

      return {
        data: {
          hasAccess: membership.hasValidKey,
          wallet: membership.walletAddress,
          network: membership.network,
          expiresAt: membership.expiresAt,
          keyCount: membership.keyCount,
          lock: {
            address: course.lockAddress,
            chainId: course.lockChainId,
            checkoutUrl: buildCheckoutUrl(course.lockAddress!, course.lockChainId!),
          },
        },
      };
    },
  );

  // ─── Desbloquear: matricula por membresia ─────────────────────────────────
  //
  // Es el punto donde Unlock determina el acceso de verdad. El contenido de
  // un curso vive detras de una fila de "enrollments", asi que conceder la
  // matricula es conceder el curso. Se exigen dos pruebas antes de crearla:
  // que quien pide controle la wallet (firma) y que esa wallet tenga llave
  // valida (lectura on-chain). Sin ambas, no hay matricula.
  app.post(
    '/v1/public/courses/:id/enroll-with-membership',
    {
      preHandler: [app.requireAuth(['student']), app.rateLimit({ max: 20, timeWindow: 60_000 })],
      schema: {
        tags: ['Public'],
        description:
          'Matricula al estudiante en un curso token-gated tras verificar su membresia de Unlock on-chain.',
        body: membershipEnrollSchema,
      },
    },
    async (req, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = membershipEnrollSchema.parse(req.body);
      const db = getDb();

      const course = await db.query.courses.findFirst({
        where: and(eq(schema.courses.id, id), eq(schema.courses.status, 'published')),
      });
      if (!course) throw errors.notFound('Curso no disponible');
      await assertCourseInstitutionActive(course.id);
      await assertStudentProfileApproved(req.auth!.userId);

      if (!requiresMembership(course)) {
        throw errors.conflict('Este curso no se matricula con membresia de Unlock');
      }
      // Un curso token-gated sin Lock no puede abrirse. Negamos antes de
      // crear una matricula que nadie podria justificar.
      if (!isGateUsable(course)) {
        throw errors.conflict('El curso no tiene un Lock configurado');
      }

      // Primera prueba: que quien pide controla la wallet. Sin esto bastaria
      // con poner la address de un suscriptor para entrar con su membresia.
      const ownsWallet = await verifyWalletOwnership({
        walletAddress: body.wallet,
        slug: membershipScope(course.id),
        issuedAt: body.issuedAt,
        signature: body.signature,
      });
      if (!ownsWallet) {
        throw errors.unauthorized(
          'Firma invalida o expirada: volve a firmar para probar que controlas la wallet.',
        );
      }

      // Segunda prueba: la llave, leida on-chain en este mismo momento. Es la
      // unica fuente de autorizacion; no hay copia en nuestra base que pueda
      // quedar desactualizada.
      const membership = await checkMembership({
        lockAddress: course.lockAddress!,
        chainId: course.lockChainId!,
        walletAddress: body.wallet,
      });

      if (!membership.hasValidKey) {
        reply.status(402);
        return {
          error: {
            code: 'MEMBERSHIP_REQUIRED',
            message: 'Necesitas una membresia valida para matricularte en este curso.',
            checkoutUrl: buildCheckoutUrl(course.lockAddress!, course.lockChainId!),
            lock: { address: course.lockAddress, chainId: course.lockChainId },
          },
        };
      }

      const existing = await db.query.enrollments.findFirst({
        where: and(
          eq(schema.enrollments.courseId, course.id),
          eq(schema.enrollments.userId, req.auth!.userId),
        ),
      });
      if (existing) {
        await ensureInstitutionStudent({
          institutionId: course.institutionId,
          userId: req.auth!.userId,
        });
        return reply.status(200).send({
          enrollmentId: existing.id,
          courseId: course.id,
          courseSlug: course.slug,
          alreadyEnrolled: true,
        });
      }

      const enrollment = await createCourseEnrollment({
        courseId: course.id,
        institutionId: course.institutionId,
        userId: req.auth!.userId,
        source: 'unlock',
        membership: {
          wallet: membership.walletAddress,
          lockAddress: course.lockAddress!,
          chainId: course.lockChainId!,
          keyExpiresAt: membership.expiresAt,
        },
      });

      return reply.status(201).send({
        enrollmentId: enrollment.id,
        courseId: course.id,
        courseSlug: course.slug,
        alreadyEnrolled: false,
        membership: {
          wallet: membership.walletAddress,
          network: membership.network,
          expiresAt: membership.expiresAt,
        },
      });
    },
  );
  // ─── Acreditacion institucional verificable ───────────────────────────────
  //
  // Responde si una institucion esta acreditada, leyendo el contrato de cada
  // red. Es publico y sin API key a proposito: una acreditacion que solo puede
  // comprobarse preguntandole a quien la emite no le prueba nada a un tercero.
  //
  // Devuelve ademas los comandos para repetir la lectura sin Tessera, de modo
  // que un regulador, un empleador o un jurado llegue al mismo resultado por
  // su cuenta.
  app.get(
    '/v1/public/institutions/:slug/accreditation',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Public'],
        description:
          'Acreditacion on-chain de una institucion, leida de los contratos. Incluye comandos para verificarla de forma independiente.',
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const db = getDb();

      const institution = await db.query.institutions.findFirst({
        where: and(
          eq(schema.institutions.slug, slug),
          eq(schema.institutions.status, 'approved'),
        ),
      });
      if (!institution) throw errors.notFound('Institucion');

      // La red principal decide si puede emitir; las secundarias anaden
      // verificabilidad independiente.
      const chains = readableAccreditationChainIds();

      const results = await Promise.all(
        chains.map(async (chainId) => {
          const network = networkFor(chainId);
          const reading = await readAccreditationOnchain({
            walletAddress: institution.walletAddress,
            chainId,
          });

          const registry = network?.contracts.registry ?? null;
          const rpc = ACCREDITATION_RPC_HINTS[chainId] ?? null;

          return {
            chainId,
            network: network?.name ?? `chain ${chainId}`,
            role: chainId === env.POLYGON_CHAIN_ID ? ('issuance' as const) : ('audit' as const),
            accredited: reading.accredited,
            unavailableReason: reading.error,
            registry,
            // El enlace lleva al lector del contrato, no a su lista de
            // transacciones. Con `/address` se abria un historial crudo de
            // llamadas donde habia que adivinar cual era la relevante, y la
            // pregunta que trae a alguien aqui es una sola: si esta wallet
            // esta acreditada. En la pestaña de lectura se consulta
            // isApprovedInstitution y el contrato responde en el momento.
            explorerUrl: network
              ? `${network.explorer.replace(/\/$/, '')}/address/${registry}/read-contract`
              : null,
            verifyCommand:
              registry && rpc
                ? `cast call ${registry} "isApprovedInstitution(address)(bool)" ${institution.walletAddress} --rpc-url ${rpc}`
                : null,
          };
        }),
      );

      // Lectura on-chain de un estado que cambia poco: cachear evita castigar
      // a un RPC publico si varios revisores consultan a la vez.
      // Sin stale-while-revalidate: esa directiva deja al navegador servir la
      // respuesta vieja hasta diez minutos mientras refresca por detras, asi
      // que tras acreditar el panel seguia diciendo "No acreditada" aunque el
      // contrato ya respondiera true. Un caché corto y honesto vale mas aqui
      // que uno agresivo que contradice a la cadena.
      reply.header('Cache-Control', 'public, max-age=15');
      reply.header('Access-Control-Allow-Origin', '*');

      return {
        data: {
          institution: {
            name: institution.name,
            slug: institution.slug,
            country: institution.country,
            walletAddress: institution.walletAddress,
            approvedAt: institution.approvedAt,
          },
          chains: results,
        },
      };
    },
  );
}
