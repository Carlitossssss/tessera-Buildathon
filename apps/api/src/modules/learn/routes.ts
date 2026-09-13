import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq, inArray } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { errors } from '@tessera/shared/errors';
import { autoIssueCourseCertificate } from '../../services/certificates.js';
import { assertCourseInstitutionActive } from '../../services/institution-access.js';
import { getObjectStorageAsset } from '../../services/storage.js';
import {
  buildCheckoutUrl,
  checkMembership,
  formatKeyPrice,
  getLockInfo,
  unlockNetworkLabel,
} from '../../services/unlock.js';
import { markPreviewable } from '../../services/course-access.js';
import {
  assetKeyFor,
  decideMaterialAccess,
  moduleRequiresKey,
} from '../../services/module-access.js';
import { issueCoverToken, verifyCoverToken } from '../../services/cover-token.js';
import { env } from '../../config/env.js';

const submitSchema = z.object({
  /** { [questionId]: string | boolean | string (text) } */
  answers: z.record(z.unknown()),
});

const moduleProgressUpdateSchema = z.object({
  status: z.enum(['in_progress', 'completed']),
});

async function upsertModuleProgress(input: {
  enrollmentId: string;
  moduleId: string;
  status: 'in_progress' | 'completed';
  userId: string;
}) {
  const db = getDb();
  const now = new Date();
  const existing = await db.query.moduleProgress.findFirst({
    where: and(
      eq(schema.moduleProgress.enrollmentId, input.enrollmentId),
      eq(schema.moduleProgress.moduleId, input.moduleId),
    ),
  });

  if (existing) {
    await db
      .update(schema.moduleProgress)
      .set({
        status:
          existing.status === 'completed' && input.status === 'in_progress'
            ? 'completed'
            : input.status,
        startedAt: existing.startedAt ?? now,
        completedAt:
          input.status === 'completed' ? (existing.completedAt ?? now) : existing.completedAt,
        updatedBy: input.userId,
        updatedAt: now,
      })
      .where(eq(schema.moduleProgress.id, existing.id));
  } else {
    await db.insert(schema.moduleProgress).values({
      enrollmentId: input.enrollmentId,
      moduleId: input.moduleId,
      status: input.status,
      startedAt: now,
      completedAt: input.status === 'completed' ? now : null,
      updatedBy: input.userId,
    });
  }
}

export default async function learnRoutes(app: FastifyInstance) {
  // GET /v1/me/learn/courses/:enrollmentId
  // Devuelve el curso visto desde el estudiante: módulos, temarios, evaluaciones (sin correctAnswer)
  // y attempts del estudiante.
  app.get(
    '/v1/me/learn/courses/:enrollmentId',
    {
      preHandler: [app.requireAuth(['student', 'institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Learn'] },
    },
    async (req) => {
      const { enrollmentId } = req.params as { enrollmentId: string };
      const userId = req.auth!.userId;
      const db = getDb();
      const enrollment = await db.query.enrollments.findFirst({
        where: and(eq(schema.enrollments.id, enrollmentId), eq(schema.enrollments.userId, userId)),
      });
      if (!enrollment) throw errors.notFound('Inscripción no encontrada');
      const course = await db.query.courses.findFirst({
        where: eq(schema.courses.id, enrollment.courseId),
      });
      if (!course) throw errors.notFound('Curso no encontrado');
      await assertCourseInstitutionActive(course.id);

      const modules = await db
        .select()
        .from(schema.modules)
        .where(eq(schema.modules.courseId, course.id))
        .orderBy(asc(schema.modules.orderIndex));
      const moduleIds = modules.map((m) => m.id);

      const topics = moduleIds.length
        ? await db
            .select()
            .from(schema.topics)
            .where(inArray(schema.topics.moduleId, moduleIds))
            .orderBy(asc(schema.topics.orderIndex))
        : [];

      /**
       * Membresia que abre cada modulo de pago.
       *
       * El precio y la duracion se leen del Lock on-chain. Se consultan todos
       * a la vez y cada uno tolera su propio fallo: un RPC lento no puede
       * dejar el curso sin cargar, y sin precio el boton de compra sigue
       * llevando al checkout, que es lo que de verdad importa.
       */
      const gatedModules = modules.filter(
        (m): m is typeof m & { lockAddress: string; lockChainId: number } =>
          Boolean(m.lockAddress) && typeof m.lockChainId === 'number',
      );
      const gateEntries = await Promise.all(
        gatedModules.map(async (m) => {
          const info = await getLockInfo(m.lockAddress, m.lockChainId).catch(() => null);
          return [
            m.id,
            {
              lockAddress: m.lockAddress,
              chainId: m.lockChainId,
              network: info?.network ?? unlockNetworkLabel(m.lockChainId),
              checkoutUrl: info?.checkoutUrl ?? buildCheckoutUrl(m.lockAddress, m.lockChainId),
              name: info?.name ?? null,
              price: formatKeyPrice(info?.keyPriceWei ?? null, m.lockChainId),
              durationSeconds: info?.expirationDuration ?? null,
            },
          ] as const;
        }),
      );
      const gateByModule = new Map(gateEntries);

      /**
       * Si el estudiante YA puede abrir cada modulo de pago.
       *
       * El gate solo dice cuanto cuesta un modulo, nunca si a esta persona le
       * falta pagarlo. Sin esta señal el muro se pintaba encima de la portada
       * para todo el mundo --tambien para quien ya tenia la llave-- y no habia
       * forma de quitarlo: se compraba la membresia y el candado seguia ahi.
       *
       * Se resuelve aqui, en el servidor, con la wallet que consta en la
       * matricula. Es la misma llave que decide la entrega del archivo, asi
       * que la pantalla y el material no pueden contradecirse.
       *
       * Ante un fallo de lectura se concede: un RPC caido no puede poner un
       * candado sobre material que la persona ya pago. Si la llave de verdad
       * falta, la ruta del material lo volvera a comprobar antes de entregar
       * nada --alli es donde se protege el contenido--.
       */
      const wallet = enrollment.unlockWallet;
      const moduleAccessEntries = await Promise.all(
        gatedModules.map(async (m) => {
          if (!wallet) return [m.id, false] as const;
          const membership = await checkMembership({
            lockAddress: m.lockAddress,
            chainId: m.lockChainId,
            walletAddress: wallet,
          }).catch(() => null);
          return [m.id, membership ? membership.hasValidKey : true] as const;
        }),
      );
      const moduleAccessById = new Map(moduleAccessEntries);

      /**
       * Membresía del curso entero, cuando es token-gated.
       *
       * Se lee del Lock como la de los módulos y tolera igual el fallo: si el
       * RPC no responde, el curso carga sin precio pero con el camino de
       * compra intacto.
       */
      const courseGate =
        course.lockAddress && typeof course.lockChainId === 'number'
          ? await getLockInfo(course.lockAddress, course.lockChainId)
              .catch(() => null)
              .then((info) => ({
                lockAddress: course.lockAddress!,
                chainId: course.lockChainId!,
                network: info?.network ?? unlockNetworkLabel(course.lockChainId!),
                checkoutUrl:
                  info?.checkoutUrl ?? buildCheckoutUrl(course.lockAddress!, course.lockChainId!),
                name: info?.name ?? null,
                price: formatKeyPrice(info?.keyPriceWei ?? null, course.lockChainId!),
                durationSeconds: info?.expirationDuration ?? null,
              }))
          : null;
      const assessments = moduleIds.length
        ? await db
            .select()
            .from(schema.assessments)
            .where(inArray(schema.assessments.moduleId, moduleIds))
            .orderBy(asc(schema.assessments.orderIndex))
        : [];
      const assessmentIds = assessments.map((a) => a.id);
      const questionsRaw = assessmentIds.length
        ? await db
            .select()
            .from(schema.assessmentQuestions)
            .where(inArray(schema.assessmentQuestions.assessmentId, assessmentIds))
            .orderBy(asc(schema.assessmentQuestions.orderIndex))
        : [];
      // Ocultar correctAnswer al estudiante.
      const questions = questionsRaw.map((q) => ({
        id: q.id,
        assessmentId: q.assessmentId,
        prompt: q.prompt,
        kind: q.kind,
        options: q.options,
        points: q.points,
        orderIndex: q.orderIndex,
      }));

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
        : [];

      const progress = await db
        .select()
        .from(schema.moduleProgress)
        .where(eq(schema.moduleProgress.enrollmentId, enrollment.id));

      return {
        data: {
          enrollment: {
            id: enrollment.id,
            status: enrollment.completedAt
              ? 'completed'
              : enrollment.startedAt
                ? 'in_progress'
                : 'not_started',
            startedAt: enrollment.startedAt,
            completedAt: enrollment.completedAt,
            finalScore: enrollment.finalScore,
            /**
             * Membresía que concedió la matrícula, si entró por Unlock. Es
             * trazabilidad: el estudiante ve con qué llave abrió el curso y
             * hasta cuándo vale. Una llave vencida no le quita el acceso ya
             * concedido, así que esto informa, no restringe.
             */
            membership: enrollment.unlockLockAddress
              ? {
                  wallet: enrollment.unlockWallet,
                  lockAddress: enrollment.unlockLockAddress,
                  chainId: enrollment.unlockChainId,
                  keyExpiresAt: enrollment.unlockKeyExpiresAt,
                }
              : null,
          },
          course: {
            id: course.id,
            title: course.title,
            slug: course.slug,
            description: course.description,
            passingScore: course.passingScore,
            /**
             * Membresía que abre el curso entero, si es token-gated.
             *
             * Va aparte del gate de cada módulo porque responde otra pregunta:
             * aquélla es "qué cuesta este material", ésta es "en qué estado
             * está mi membresía". Con ella la barra del curso puede mostrar el
             * recorrido completo —sin llave, con llave, vencida— en lugar de
             * limitarse a decir que un día se entró con una.
             */
            gate: courseGate,
          },
          modules: modules.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            orderIndex: m.orderIndex,
            weight: m.weight,
            isRequired: m.isRequired,
            /**
             * Membresía que abre este módulo, cuando la tiene.
             *
             * Un módulo puede cobrarse aparte dentro de un curso abierto, y
             * hasta ahora el estudiante se encontraba con un 402 al pedir el
             * material: un error, sin precio y sin forma de comprar. Con el
             * Lock aquí, el muro de pago se puede pintar sobre la portada —que
             * es donde se decide la compra— en lugar de aparecer como un fallo.
             *
             * `lockInfo` se lee on-chain y puede venir nulo si el RPC no
             * responde; el camino de compra sigue existiendo igual, sólo sin
             * precio. Un checkout sin precio es peor que uno con precio, pero
             * mucho mejor que ninguno.
             */
            gate: gateByModule.get(m.id) ?? null,
            /**
             * Si esta persona ya puede abrir este modulo.
             *
             * Un modulo sin Lock propio lo abre la matricula, asi que es true.
             * Uno con Lock exige su llave, y aqui se dice si la tiene: es lo
             * que permite que el candado desaparezca al comprar en vez de
             * quedarse puesto para siempre.
             */
            hasAccess: gateByModule.has(m.id) ? (moduleAccessById.get(m.id) ?? false) : true,
            // Se eligen los campos uno a uno en vez de devolver la fila.
            //
            // `assetKey`, `coverKey` y `coverBlurKey` son rutas internas del
            // almacenamiento: no abren nada por si solas, pero describen como
            // esta organizado y no tienen ninguna utilidad en el navegador. Lo
            // que el cliente necesita saber es si HAY material y si HAY
            // portada, no donde viven.
            topics: topics
              .filter((t) => t.moduleId === m.id)
              .map((t) => ({
                id: t.id,
                moduleId: t.moduleId,
                title: t.title,
                description: t.description,
                contentType: t.contentType,
                content: t.content,
                orderIndex: t.orderIndex,
                hasMaterial: Boolean(t.assetKey),
                hasPreview: Boolean(t.assetPreviewKey),
                hasCover: Boolean(t.coverKey),
                assetMimeType: t.assetMimeType,
                assetByteSize: t.assetByteSize,
                assetPreviewSeconds: t.assetPreviewSeconds,
                assetDurationSeconds: t.assetDurationSeconds,
                coverWidth: t.coverWidth,
                coverHeight: t.coverHeight,
                /**
                 * Permiso para pedir la portada.
                 *
                 * La portada se pinta con <img>, y un <img> no manda cabecera
                 * Authorization: el navegador la pide por su cuenta, sin pasar
                 * por el cliente de API. Sin este permiso la ruta respondia 401
                 * a toda portada y la previsualizacion no se veia nunca.
                 *
                 * No autoriza por si solo: solo dice quien pide, para que la
                 * ruta vuelva a decidir con las reglas de siempre si entrega la
                 * nitida o la difuminada.
                 */
                coverToken: t.coverKey
                  ? issueCoverToken(
                      { topicId: t.id, userId, scope: 'cover' },
                      env.AUTH_SECRET,
                    )
                  : null,
                /**
                 * Permiso para abrir el archivo completo.
                 *
                 * Sin el no habia ninguna forma de ver el material: la vista
                 * del estudiante solo ofrecia el boton de compra y el enlace
                 * al Lock. El archivo se subia, se guardaba y se servia, y
                 * nadie podia pedirlo.
                 *
                 * Va con ambito propio: el de la portada viaja en cada <img>,
                 * a la vista en el inspector, y no debe abrir el video.
                 */
                materialToken: t.assetKey
                  ? issueCoverToken(
                      { topicId: t.id, userId, scope: 'material' },
                      env.AUTH_SECRET,
                    )
                  : null,
              })),
            assessments: assessments
              .filter((a) => a.moduleId === m.id)
              .map((a) => ({
                ...a,
                questions: questions.filter((q) => q.assessmentId === a.id),
                attempts: attempts.filter((at) => at.assessmentId === a.id),
              })),
            progress: progress.find((p) => p.moduleId === m.id) ?? null,
          })),
        },
      };
    },
  );

  // POST /v1/me/learn/assessments/:assessmentId/start
  // Crea (o devuelve) un attempt en in_progress para el estudiante.
  app.post(
    '/v1/me/learn/assessments/:assessmentId/start',
    {
      preHandler: [app.requireAuth(['student', 'institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Learn'] },
    },
    async (req, reply) => {
      const { assessmentId } = req.params as { assessmentId: string };
      const userId = req.auth!.userId;
      const db = getDb();
      const assessment = await db.query.assessments.findFirst({
        where: eq(schema.assessments.id, assessmentId),
      });
      if (!assessment) throw errors.notFound('Evaluación no encontrada');
      const m = await db.query.modules.findFirst({
        where: eq(schema.modules.id, assessment.moduleId),
      });
      if (!m) throw errors.notFound('Módulo no encontrado');
      await assertCourseInstitutionActive(m.courseId);
      const enrollment = await db.query.enrollments.findFirst({
        where: and(
          eq(schema.enrollments.userId, userId),
          eq(schema.enrollments.courseId, m.courseId),
        ),
      });
      if (!enrollment) throw errors.forbidden('No estás inscrito en este curso');

      const existing = await db
        .select()
        .from(schema.assessmentAttempts)
        .where(
          and(
            eq(schema.assessmentAttempts.enrollmentId, enrollment.id),
            eq(schema.assessmentAttempts.assessmentId, assessmentId),
          ),
        );
      const open = existing.find((a) => a.status === 'in_progress');
      if (open) return { data: open };
      if (existing.length >= assessment.attemptsAllowed) {
        throw errors.badRequest('Has alcanzado el número máximo de intentos');
      }
      const attemptNumber = existing.length + 1;
      const [created] = await db
        .insert(schema.assessmentAttempts)
        .values({
          enrollmentId: enrollment.id,
          assessmentId,
          attemptNumber,
          status: 'in_progress',
          answers: {},
        })
        .returning();
      await upsertModuleProgress({
        enrollmentId: enrollment.id,
        moduleId: assessment.moduleId,
        status: 'in_progress',
        userId,
      });
      if (!enrollment.startedAt) {
        await db
          .update(schema.enrollments)
          .set({ startedAt: new Date() })
          .where(eq(schema.enrollments.id, enrollment.id));
      }
      reply.code(201);
      return { data: created };
    },
  );

  app.post(
    '/v1/me/learn/modules/:moduleId/progress',
    {
      preHandler: [app.requireAuth(['student']), app.rateLimit()],
      schema: { tags: ['Learn'], body: moduleProgressUpdateSchema },
    },
    async (req) => {
      const { moduleId } = z.object({ moduleId: z.string().uuid() }).parse(req.params);
      const body = moduleProgressUpdateSchema.parse(req.body);
      const userId = req.auth!.userId;
      const db = getDb();

      const module = await db.query.modules.findFirst({
        where: eq(schema.modules.id, moduleId),
      });
      if (!module) throw errors.notFound('Módulo no encontrado');
      await assertCourseInstitutionActive(module.courseId);

      const enrollment = await db.query.enrollments.findFirst({
        where: and(
          eq(schema.enrollments.userId, userId),
          eq(schema.enrollments.courseId, module.courseId),
        ),
      });
      if (!enrollment) throw errors.forbidden('No estás inscrito en este curso');

      if (body.status === 'completed') {
        const assessments = await db
          .select({ id: schema.assessments.id })
          .from(schema.assessments)
          .where(eq(schema.assessments.moduleId, moduleId));
        if (assessments.length > 0) {
          throw errors.badRequest(
            'Este módulo tiene evaluaciones; completa las evaluaciones para registrar avance.',
          );
        }
      }

      await upsertModuleProgress({
        enrollmentId: enrollment.id,
        moduleId,
        status: body.status,
        userId,
      });

      if (!enrollment.startedAt) {
        await db
          .update(schema.enrollments)
          .set({ startedAt: new Date() })
          .where(eq(schema.enrollments.id, enrollment.id));
      }

      await recalculateFinalScore(enrollment.id);

      return { ok: true };
    },
  );

  // POST /v1/me/learn/attempts/:attemptId/submit
  app.post(
    '/v1/me/learn/attempts/:attemptId/submit',
    {
      preHandler: [app.requireAuth(['student', 'institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Learn'], body: submitSchema },
    },
    async (req) => {
      const { attemptId } = req.params as { attemptId: string };
      const userId = req.auth!.userId;
      const body = submitSchema.parse(req.body);
      const db = getDb();
      const attempt = await db.query.assessmentAttempts.findFirst({
        where: eq(schema.assessmentAttempts.id, attemptId),
      });
      if (!attempt) throw errors.notFound('Intento no encontrado');
      if (attempt.status !== 'in_progress') {
        throw errors.badRequest('Este intento ya fue enviado');
      }
      const enrollment = await db.query.enrollments.findFirst({
        where: and(
          eq(schema.enrollments.id, attempt.enrollmentId),
          eq(schema.enrollments.userId, userId),
        ),
      });
      if (!enrollment) throw errors.forbidden('No autorizado');
      const assessment = await db.query.assessments.findFirst({
        where: eq(schema.assessments.id, attempt.assessmentId),
      });
      if (!assessment) throw errors.notFound('Evaluación no encontrada');
      const module = await db.query.modules.findFirst({
        columns: { courseId: true },
        where: eq(schema.modules.id, assessment.moduleId),
      });
      if (!module) throw errors.notFound('Módulo no encontrado');
      await assertCourseInstitutionActive(module.courseId);

      const questions = await db
        .select()
        .from(schema.assessmentQuestions)
        .where(eq(schema.assessmentQuestions.assessmentId, assessment.id))
        .orderBy(asc(schema.assessmentQuestions.orderIndex));

      let score: number | null = null;
      let nextStatus: 'submitted' | 'graded' = 'submitted';

      if (assessment.type !== 'essay' && questions.length > 0) {
        // Auto-grade
        let earned = 0;
        let total = 0;
        for (const q of questions) {
          total += q.points;
          const ans = body.answers[q.id];
          if (q.kind === 'single' && typeof ans === 'string') {
            if (ans === q.correctAnswer) earned += q.points;
          } else if (q.kind === 'boolean' && typeof ans === 'boolean') {
            if (ans === q.correctAnswer) earned += q.points;
          }
        }
        score = total > 0 ? Math.round((earned / total) * assessment.maxScore) : 0;
        nextStatus = 'graded';
      }

      const [updated] = await db
        .update(schema.assessmentAttempts)
        .set({
          status: nextStatus,
          answers: body.answers,
          score,
          submittedAt: new Date(),
          gradedAt: nextStatus === 'graded' ? new Date() : null,
        })
        .where(eq(schema.assessmentAttempts.id, attemptId))
        .returning();

      // Recalcular nota del módulo y del curso si la evaluación fue auto-graded.
      if (nextStatus === 'graded') {
        await recalculateModuleScore(enrollment.id, assessment.moduleId);
        await recalculateFinalScore(enrollment.id);
      }

      return { data: updated };
    },
  );

  /**
   * Si la matricula todavia abre el curso.
   *
   * En un curso de pago unico --el modo por defecto-- basta con estar
   * matriculado: el acceso ya se concedio y no caduca. En uno por suscripcion
   * la matricula abre la puerta pero la llave tiene que seguir viva, que es lo
   * que convierte a Unlock en una suscripcion de verdad; sin esto, pagar un
   * mes dejaba el curso para siempre.
   *
   * Ante un RPC caido se mantiene el acceso: cerrarle el curso a alguien por
   * un fallo nuestro parece un robo, y dejarlo abierto un rato de mas se
   * corrige en la siguiente lectura.
   */
  async function membershipStillOpensCourse(input: {
    course: typeof schema.courses.$inferSelect;
    enrollment: typeof schema.enrollments.$inferSelect | undefined;
    wallet?: string;
  }): Promise<boolean> {
    if (!input.enrollment) return false;
    if (input.course.accessMode !== 'subscription') return true;
    if (!input.course.lockAddress || typeof input.course.lockChainId !== 'number') return true;

    // La wallet de la consulta manda sobre la guardada: el estudiante puede
    // haber renovado desde otra, y la de la matricula es solo trazabilidad.
    const wallet = input.wallet ?? input.enrollment.unlockWallet;
    if (!wallet) return true;

    const membership = await checkMembership({
      lockAddress: input.course.lockAddress,
      chainId: input.course.lockChainId,
      walletAddress: wallet,
    }).catch(() => null);

    // null significa que no se pudo leer, no que la llave vencio.
    if (!membership) return true;
    return membership.hasValidKey;
  }

  // ─── Material del temario ─────────────────────────────────────────────────
  //
  // Entrega el archivo de un temario aplicando las dos barreras que pueden
  // existir: la del curso (matricula o modulo de muestra) y la del modulo (su
  // propio Lock de Unlock, para material premium dentro de un curso abierto).
  //
  // La decision se toma en el servidor ANTES de leer el storage: si no
  // corresponde, el archivo ni se abre.
  //
  // La autorizacion no puede venir solo de `requireAuth`: el archivo se abre
  // desde un enlace del navegador, y un enlace no manda cabecera
  // Authorization. Exigirla dejaba el material inalcanzable --se subia, se
  // guardaba, se servia, y nadie podia pedirlo--. Se admite ademas el permiso
  // firmado que emite el payload del curso, con ambito propio para que el de
  // la portada, que viaja a la vista en cada <img>, no abra el video.
  app.get(
    '/v1/me/learn/topics/:topicId/material',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Learn'],
        description:
          'Sirve el material de un temario. Devuelve la muestra si el modulo exige una membresia que el estudiante no presento.',
        querystring: z.object({
          wallet: z
            .string()
            .regex(/^0x[a-fA-F0-9]{40}$/)
            .optional(),
          /** Permiso firmado con ambito 'material'. */
          t: z.string().min(1).max(200).optional(),
        }),
      },
    },
    async (req, reply) => {
      const { topicId } = req.params as { topicId: string };
      const query = z
        .object({
          wallet: z
            .string()
            .regex(/^0x[a-fA-F0-9]{40}$/)
            .optional(),
          t: z.string().min(1).max(200).optional(),
        })
        .parse(req.query);
      const db = getDb();

      // Quien pide: la sesion si la hay, y si no el permiso firmado. Sin
      // ninguno de los dos no se identifica a nadie y no se entrega nada.
      let viewerId: string | null = null;
      try {
        const payload = await req.jwtVerify<{ sub: string }>();
        viewerId = payload.sub;
      } catch {
        viewerId = null;
      }

      const topic = await db.query.topics.findFirst({ where: eq(schema.topics.id, topicId) });
      if (!topic || !topic.assetKey) throw errors.notFound('Material no encontrado');

      const mod = await db.query.modules.findFirst({ where: eq(schema.modules.id, topic.moduleId) });
      if (!mod) throw errors.notFound('Modulo no encontrado');
      const course = await db.query.courses.findFirst({
        where: eq(schema.courses.id, mod.courseId),
      });
      if (!course) throw errors.notFound('Curso no encontrado');

      // El permiso lleva dentro a quien se le emitio, asi que se comprueba
      // contra los matriculados del curso: lista corta y acotada, y evita
      // confiar en un id suelto en la query.
      if (!viewerId && query.t) {
        const enrolledRows = await db
          .select({ userId: schema.enrollments.userId })
          .from(schema.enrollments)
          .where(eq(schema.enrollments.courseId, course.id));
        const match = enrolledRows.find((row) =>
          verifyCoverToken(
            query.t!,
            { topicId, userId: row.userId, scope: 'material' },
            env.AUTH_SECRET,
          ),
        );
        viewerId = match?.userId ?? null;
      }
      if (!viewerId) throw errors.unauthorized();

      const enrollment = await db.query.enrollments.findFirst({
        where: and(
          eq(schema.enrollments.courseId, course.id),
          eq(schema.enrollments.userId, viewerId),
        ),
      });

      // Los modulos de muestra del curso quedan abiertos aunque no haya
      // matricula: es lo que permite probar el contenido antes de pagar.
      const moduleRows = await db
        .select({ id: schema.modules.id, orderIndex: schema.modules.orderIndex })
        .from(schema.modules)
        .where(eq(schema.modules.courseId, course.id));
      const coursePreviewable =
        markPreviewable(course, moduleRows).find((m) => m.id === mod.id)?.previewable ?? false;

      // La llave del modulo se lee on-chain en este momento. No hay copia en
      // la base que pueda quedar desactualizada.
      let hasModuleKey = false;
      if (moduleRequiresKey(mod) && query.wallet) {
        const membership = await checkMembership({
          lockAddress: mod.lockAddress!,
          chainId: mod.lockChainId!,
          walletAddress: query.wallet,
        }).catch(() => null);
        hasModuleKey = membership?.hasValidKey === true;

        if (hasModuleKey && membership) {
          // Trazabilidad: quien abrio que y con que llave. Nunca autoriza por
          // si sola, asi que su fallo no debe impedir el acceso.
          await db
            .insert(schema.moduleUnlocks)
            .values({
              moduleId: mod.id,
              walletAddress: membership.walletAddress,
              userId: viewerId,
              lockAddress: mod.lockAddress!,
              lockChainId: mod.lockChainId!,
              keyExpiresAt: membership.expiresAt,
            })
            .catch((err: unknown) => {
              req.log.warn({ err, moduleId: mod.id }, 'No se pudo registrar el desbloqueo');
            });
        }
      }

      const decision = decideMaterialAccess({
        module: mod,
        // En un curso por suscripcion la matricula solo cuenta mientras la
        // llave siga viva. En pago unico basta con estar matriculado.
        enrolledInCourse: await membershipStillOpensCourse({
          course,
          enrollment,
          wallet: query.wallet,
        }),
        coursePreviewable,
        hasModuleKey,
      });

      if (decision.access === 'none') {
        reply.status(402);
        return {
          error: {
            code: 'ENROLLMENT_REQUIRED',
            message: 'Matriculate en el curso para ver este material.',
          },
        };
      }

      const key = assetKeyFor(topic, decision);
      if (!key) {
        // El modulo exige llave y no hay muestra publicada: no hay nada que
        // entregar, pero si un camino de compra.
        reply.status(402);
        return {
          error: {
            code: 'MEMBERSHIP_REQUIRED',
            message: 'Este material requiere una membresia valida.',
            ...(mod.lockAddress && mod.lockChainId
              ? {
                  checkoutUrl: buildCheckoutUrl(mod.lockAddress, mod.lockChainId),
                  lock: { address: mod.lockAddress, chainId: mod.lockChainId },
                }
              : {}),
          },
        };
      }

      const asset = await getObjectStorageAsset(key);
      if (!asset) throw errors.notFound('Material no encontrado');

      reply.header('Content-Type', asset.contentType ?? topic.assetMimeType ?? 'application/octet-stream');
      // Material de pago: no debe quedar cacheado en intermediarios.
      reply.header('Cache-Control', 'private, no-store');
      reply.header('X-Tessera-Access', decision.access);
      return reply.send(asset.data);
    },
  );

  // ─── Portada del temario ──────────────────────────────────────────────────
  //
  // Es la cara visible del material bloqueado: lo unico que ve quien todavia no
  // tiene llave. Por eso pasa por el mismo control que el archivo completo y
  // decide con el mismo `decideMaterialAccess`; si la portada nitida saliera
  // sin comprobar nada, un video con la diapositiva de la clase en su caratula
  // se estaria regalando.
  //
  // Con llave se entrega la nitida; sin ella, la difuminada que se genero en
  // el servidor. Devolver la nitida y difuminarla por CSS seria inutil:
  // cualquiera quita el filtro desde el inspector.
  //
  // La autorizacion NO viene de `requireAuth` aqui, y es deliberado: el
  // navegador pide esta URL desde una etiqueta <img>, que no manda cabecera
  // Authorization. Exigirla devolvia 401 a toda portada y la previsualizacion
  // no se veia nunca. En su lugar se admite un permiso firmado por nosotros,
  // acotado a este temario y a esta persona, que solo sirve para identificar a
  // quien pregunta; quien entrega la nitida o la difuminada sigue siendo
  // `decideMaterialAccess`, con las reglas de siempre.
  app.get(
    '/v1/me/learn/topics/:topicId/cover',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Learn'],
        description:
          'Portada del temario. Nitida si hay acceso al material; difuminada en caso contrario.',
        querystring: z.object({
          wallet: z
            .string()
            .regex(/^0x[a-fA-F0-9]{40}$/)
            .optional(),
          /** Permiso firmado que emite el payload del curso para cada portada. */
          t: z.string().min(1).max(200).optional(),
        }),
      },
    },
    async (req, reply) => {
      const { topicId } = req.params as { topicId: string };
      const query = z
        .object({
          wallet: z
            .string()
            .regex(/^0x[a-fA-F0-9]{40}$/)
            .optional(),
          t: z.string().min(1).max(200).optional(),
        })
        .parse(req.query);
      const db = getDb();

      const topic = await db.query.topics.findFirst({ where: eq(schema.topics.id, topicId) });
      if (!topic?.coverKey) throw errors.notFound('Portada no encontrada');

      /**
       * Quien pregunta.
       *
       * Una sesion normal (Bearer) sigue funcionando: la usa cualquier cliente
       * que no sea una etiqueta <img>. Cuando no la hay, el permiso firmado
       * dice de quien es la peticion, y con eso se busca su matricula. Sin
       * ninguno de los dos no se identifica a nadie, y entonces se entrega la
       * difuminada --que no revela nada-- en vez de un 401 que dejaria el
       * hueco de la imagen roto.
       */
      let viewerId: string | null = null;
      try {
        const payload = await req.jwtVerify<{ sub: string }>();
        viewerId = payload.sub;
      } catch {
        viewerId = null;
      }

      const mod = await db.query.modules.findFirst({ where: eq(schema.modules.id, topic.moduleId) });
      if (!mod) throw errors.notFound('Modulo no encontrado');
      const course = await db.query.courses.findFirst({
        where: eq(schema.courses.id, mod.courseId),
      });
      if (!course) throw errors.notFound('Curso no encontrado');

      // El permiso lleva dentro a quien se le emitio, asi que se comprueba
      // contra los matriculados del curso: es una lista corta y acotada, y
      // evita confiar en un id que venga suelto en la query.
      const enrollments = await db
        .select({ userId: schema.enrollments.userId })
        .from(schema.enrollments)
        .where(eq(schema.enrollments.courseId, course.id));

      if (!viewerId && query.t) {
        const match = enrollments.find((row) =>
          verifyCoverToken(
            query.t!,
            { topicId, userId: row.userId, scope: 'cover' },
            env.AUTH_SECRET,
          ),
        );
        viewerId = match?.userId ?? null;
      }

      const enrollment = viewerId
        ? await db.query.enrollments.findFirst({
            where: and(
              eq(schema.enrollments.courseId, course.id),
              eq(schema.enrollments.userId, viewerId),
            ),
          })
        : undefined;

      const moduleRows = await db
        .select({ id: schema.modules.id, orderIndex: schema.modules.orderIndex })
        .from(schema.modules)
        .where(eq(schema.modules.courseId, course.id));
      const coursePreviewable =
        markPreviewable(course, moduleRows).find((m) => m.id === mod.id)?.previewable ?? false;

      // La llave del modulo se lee on-chain aqui tambien: una portada nitida
      // servida con datos viejos abriria el material de pago por la ventana.
      let hasModuleKey = false;
      if (moduleRequiresKey(mod) && query.wallet) {
        const membership = await checkMembership({
          lockAddress: mod.lockAddress!,
          chainId: mod.lockChainId!,
          walletAddress: query.wallet,
        }).catch(() => null);
        hasModuleKey = membership?.hasValidKey === true;
      }

      const decision = decideMaterialAccess({
        module: mod,
        // Misma regla que para el material: con la suscripcion vencida la
        // portada nitida deja de entregarse y vuelve la difuminada.
        enrolledInCourse: await membershipStillOpensCourse({
          course,
          enrollment,
          wallet: query.wallet,
        }),
        coursePreviewable,
        hasModuleKey,
      });

      // La portada difuminada se entrega incluso con el curso cerrado: es
      // justamente el anzuelo que invita a desbloquear, y no revela nada.
      const sharpCover = decision.access === 'full';
      const key = sharpCover ? topic.coverKey : (topic.coverBlurKey ?? topic.coverKey);

      const asset = await getObjectStorageAsset(key);
      if (!asset) throw errors.notFound('Portada no encontrada');

      reply.header('Content-Type', asset.contentType ?? topic.coverMimeType ?? 'image/webp');
      // La difuminada es publica en la practica --la ve cualquiera-- pero se
      // cachea en privado igual, porque la nitida viaja por esta misma URL y
      // un intermediario no distingue cual sirvio.
      reply.header('Cache-Control', 'private, max-age=300');
      reply.header('X-Tessera-Cover', sharpCover ? 'full' : 'blurred');
      return reply.send(asset.data);
    },
  );
}

/**
 * Promedio ponderado de evaluaciones graded del módulo.
 * Si no hay evaluaciones autograded, no toca moduleProgress.
 */
export async function recalculateModuleScore(enrollmentId: string, moduleId: string) {
  const db = getDb();
  const assessments = await db
    .select()
    .from(schema.assessments)
    .where(eq(schema.assessments.moduleId, moduleId));
  if (!assessments.length) return;

  const attempts = await db
    .select()
    .from(schema.assessmentAttempts)
    .where(
      and(
        eq(schema.assessmentAttempts.enrollmentId, enrollmentId),
        inArray(
          schema.assessmentAttempts.assessmentId,
          assessments.map((a) => a.id),
        ),
      ),
    );

  // Mejor intento por evaluación (status=graded).
  const bestByAssessment = new Map<string, number>();
  for (const at of attempts) {
    if (at.status !== 'graded' || at.score == null) continue;
    const prev = bestByAssessment.get(at.assessmentId);
    if (prev == null || at.score > prev) bestByAssessment.set(at.assessmentId, at.score);
  }
  if (bestByAssessment.size === 0) return;

  let weightedSum = 0;
  let totalWeight = 0;
  for (const a of assessments) {
    const score = bestByAssessment.get(a.id);
    if (score == null) continue;
    const w = a.weight > 0 ? a.weight : 1; // weight=0 sigue contando con peso 1 si nadie lo configuró
    weightedSum += score * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return;
  const moduleScore = Math.round(weightedSum / totalWeight);

  // Marcar completed si TODAS las assessments autograded del módulo tienen score.
  const autoGraded = assessments.filter((a) => a.type !== 'essay');
  const allDone = autoGraded.every((a) => bestByAssessment.has(a.id));

  const existing = await db.query.moduleProgress.findFirst({
    where: and(
      eq(schema.moduleProgress.enrollmentId, enrollmentId),
      eq(schema.moduleProgress.moduleId, moduleId),
    ),
  });
  if (existing) {
    await db
      .update(schema.moduleProgress)
      .set({
        score: moduleScore,
        status: allDone ? 'completed' : 'in_progress',
        startedAt: existing.startedAt ?? new Date(),
        completedAt: allDone ? new Date() : existing.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.moduleProgress.id, existing.id));
  } else {
    await db.insert(schema.moduleProgress).values({
      enrollmentId,
      moduleId,
      score: moduleScore,
      status: allDone ? 'completed' : 'in_progress',
      startedAt: new Date(),
      completedAt: allDone ? new Date() : null,
    });
  }
}

/** Promedio ponderado de moduleProgress.score por module.weight. */
export async function recalculateFinalScore(enrollmentId: string) {
  const db = getDb();
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(schema.enrollments.id, enrollmentId),
  });
  if (!enrollment) return;
  const modules = await db
    .select()
    .from(schema.modules)
    .where(eq(schema.modules.courseId, enrollment.courseId));
  if (!modules.length) return;
  const progress = await db
    .select()
    .from(schema.moduleProgress)
    .where(eq(schema.moduleProgress.enrollmentId, enrollmentId));
  const byModule = new Map(progress.map((p) => [p.moduleId, p]));

  let weightedSum = 0;
  let totalWeight = 0;
  for (const m of modules) {
    const p = byModule.get(m.id);
    if (!p || p.score == null) continue;
    const w = m.weight > 0 ? m.weight : 1;
    weightedSum += p.score * w;
    totalWeight += w;
  }
  const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;

  const allRequiredCompleted = modules
    .filter((m) => m.isRequired)
    .every((m) => byModule.get(m.id)?.status === 'completed');

  await db
    .update(schema.enrollments)
    .set({
      finalScore,
      startedAt: enrollment.startedAt ?? new Date(),
      completedAt: allRequiredCompleted
        ? (enrollment.completedAt ?? new Date())
        : enrollment.completedAt,
    })
    .where(eq(schema.enrollments.id, enrollmentId));

  if (allRequiredCompleted) {
    await autoIssueCourseCertificate({
      courseId: enrollment.courseId,
      enrollmentId,
    }).catch(() => null);
  }
}
