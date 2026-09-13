import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { AppError, errors } from '@tessera/shared/errors';
import { uploadPrivateObject } from '../../services/storage.js';
import { materialKindFor } from '../../services/module-access.js';
import {
  isSupportedCoverMime,
  renderPdfCover,
  renderTopicCover,
  type RenderedCover,
} from '../../services/topic-cover.js';

/**
 * Subida de material academico a un temario.
 *
 * La muestra viaja aparte y es opcional: si el creador no la envia, el temario
 * queda sin previsualizacion. Nunca se deriva del original automaticamente,
 * porque servir el archivo completo como "muestra" regalaria el material.
 */
const materialUploadSchema = z.object({
  /** Archivo completo en base64. */
  data: z.string().min(1),
  /** Muestra gratuita en base64. Opcional. */
  preview: z.string().optional(),
  mimeType: z.string().min(3).max(120),
  /** Segundos de muestra en audio y video; informativo para el estudiante. */
  previewSeconds: z.number().int().min(1).max(600).optional(),
  /**
   * Portada en base64: la imagen que ve quien todavia no tiene llave.
   *
   * Es opcional porque de un PDF se deriva sola de su primera pagina. Para
   * video y audio la sube el creador, y es lo que convierte un material
   * bloqueado en algo que alguien quiera desbloquear.
   */
  cover: z.string().optional(),
  coverMimeType: z.string().min(3).max(120).optional(),
  /** Duracion del material. Se muestra sobre la portada y no revela contenido. */
  durationSeconds: z.number().int().min(1).max(86_400).optional(),
});

async function resolveInstitutionId(userId: string): Promise<string> {
  const db = getDb();
  const m = await db.query.institutionMembers.findFirst({
    where: eq(schema.institutionMembers.userId, userId),
  });
  if (!m) throw errors.forbidden('No perteneces a una institucion');
  return m.institutionId;
}

async function assertCourseAccess(
  courseId: string,
  institutionId: string,
  role: string,
  userId: string,
) {
  const db = getDb();
  if (role === 'teacher') {
    const assignment = await db.query.courseTeachers.findFirst({
      where: and(
        eq(schema.courseTeachers.courseId, courseId),
        eq(schema.courseTeachers.userId, userId),
      ),
    });
    if (!assignment) throw errors.notFound('Curso no encontrado');
    const c = await db.query.courses.findFirst({
      where: eq(schema.courses.id, courseId),
    });
    if (!c) throw errors.notFound('Curso no encontrado');
    return c;
  }
  const c = await db.query.courses.findFirst({
    where: and(eq(schema.courses.id, courseId), eq(schema.courses.institutionId, institutionId)),
  });
  if (!c) throw errors.notFound('Curso no encontrado');
  if (role === 'institution_admin') return c;
  throw errors.forbidden('Sin acceso al curso');
}

async function loadModuleAndCourse(moduleId: string) {
  const db = getDb();
  const m = await db.query.modules.findFirst({
    where: eq(schema.modules.id, moduleId),
  });
  if (!m) throw errors.notFound('Módulo no encontrado');
  const c = await db.query.courses.findFirst({
    where: eq(schema.courses.id, m.courseId),
  });
  if (!c) throw errors.notFound('Curso no encontrado');
  return { module: m, course: c };
}

async function loadAssessmentChain(assessmentId: string) {
  const db = getDb();
  const a = await db.query.assessments.findFirst({
    where: eq(schema.assessments.id, assessmentId),
  });
  if (!a) throw errors.notFound('Evaluación no encontrada');
  const { module: m, course: c } = await loadModuleAndCourse(a.moduleId);
  return { assessment: a, module: m, course: c };
}

const topicCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  contentType: z.string().min(1).max(50).default('text'),
  content: z.record(z.unknown()).optional().nullable(),
});
const topicUpdateSchema = topicCreateSchema.partial();

const assessmentTypeSchema = z.enum(['multiple_choice', 'true_false', 'essay']);
const assessmentScopeSchema = z.enum(['topic', 'module']);

const assessmentCreateSchema = z.object({
  type: assessmentTypeSchema,
  scope: assessmentScopeSchema.default('module'),
  topicId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  weight: z.number().int().min(0).max(100).default(0),
  maxScore: z.number().int().min(1).max(1000).default(100),
  passingScore: z.number().int().min(0).max(100).default(60),
  attemptsAllowed: z.number().int().min(1).max(10).default(1),
  timeLimitMin: z.number().int().min(1).max(600).optional().nullable(),
});
const assessmentUpdateSchema = assessmentCreateSchema.partial();

const questionKindSchema = z.enum(['single', 'boolean', 'text']);
const optionSchema = z.object({ id: z.string().min(1).max(40), label: z.string().min(1).max(500) });
const questionCreateSchema = z.object({
  prompt: z.string().min(1).max(4000),
  kind: questionKindSchema,
  options: z.array(optionSchema).min(2).max(10).optional().nullable(),
  correctAnswer: z.unknown().optional().nullable(),
  points: z.number().int().min(1).max(100).default(1),
});
const questionUpdateSchema = questionCreateSchema.partial();

export default async function coursesContentRoutes(app: FastifyInstance) {
  // ─── Topics ─────────────────────────────────────────────────────────────────

  app.get(
    '/v1/me/modules/:moduleId/topics',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req) => {
      const { moduleId } = req.params as { moduleId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { module: m } = await loadModuleAndCourse(moduleId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.topics)
        .where(eq(schema.topics.moduleId, moduleId))
        .orderBy(asc(schema.topics.orderIndex));
      return { data: rows };
    },
  );

  app.post(
    '/v1/me/modules/:moduleId/topics',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: topicCreateSchema },
    },
    async (req, reply) => {
      const { moduleId } = req.params as { moduleId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { module: m } = await loadModuleAndCourse(moduleId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);
      const body = topicCreateSchema.parse(req.body);
      const db = getDb();
      const [last] = await db
        .select({ orderIndex: schema.topics.orderIndex })
        .from(schema.topics)
        .where(eq(schema.topics.moduleId, moduleId))
        .orderBy(asc(schema.topics.orderIndex));
      const orderIndex = last
        ? (
            await db
              .select({ orderIndex: schema.topics.orderIndex })
              .from(schema.topics)
              .where(eq(schema.topics.moduleId, moduleId))
          ).reduce((mx, r) => Math.max(mx, r.orderIndex), -1) + 1
        : 0;
      const [created] = await db
        .insert(schema.topics)
        .values({
          moduleId,
          title: body.title,
          description: body.description ?? null,
          contentType: body.contentType,
          content: body.content ?? null,
          orderIndex,
        })
        .returning();
      reply.code(201);
      return { data: created };
    },
  );

  app.patch(
    '/v1/me/topics/:topicId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: topicUpdateSchema },
    },
    async (req) => {
      const { topicId } = req.params as { topicId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const t = await db.query.topics.findFirst({ where: eq(schema.topics.id, topicId) });
      if (!t) throw errors.notFound('Temario no encontrado');
      const { module: m } = await loadModuleAndCourse(t.moduleId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);
      const body = topicUpdateSchema.parse(req.body);
      const [updated] = await db
        .update(schema.topics)
        .set({
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.contentType !== undefined ? { contentType: body.contentType } : {}),
          ...(body.content !== undefined ? { content: body.content } : {}),
        })
        .where(eq(schema.topics.id, topicId))
        .returning();
      return { data: updated };
    },
  );

  app.delete(
    '/v1/me/topics/:topicId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req, reply) => {
      const { topicId } = req.params as { topicId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const t = await db.query.topics.findFirst({ where: eq(schema.topics.id, topicId) });
      if (!t) throw errors.notFound('Temario no encontrado');
      const { module: m } = await loadModuleAndCourse(t.moduleId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);
      await db.delete(schema.topics).where(eq(schema.topics.id, topicId));
      reply.code(204);
    },
  );

  // ─── Assessments ────────────────────────────────────────────────────────────

  app.get(
    '/v1/me/modules/:moduleId/assessments',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req) => {
      const { moduleId } = req.params as { moduleId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { module: m } = await loadModuleAndCourse(moduleId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.assessments)
        .where(eq(schema.assessments.moduleId, moduleId))
        .orderBy(asc(schema.assessments.orderIndex));
      return { data: rows };
    },
  );

  app.post(
    '/v1/me/modules/:moduleId/assessments',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: assessmentCreateSchema },
    },
    async (req, reply) => {
      const { moduleId } = req.params as { moduleId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { module: m } = await loadModuleAndCourse(moduleId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);
      const body = assessmentCreateSchema.parse(req.body);
      if (body.scope === 'topic' && !body.topicId) {
        throw errors.badRequest('topicId es requerido cuando scope=topic');
      }
      if (body.topicId) {
        const db = getDb();
        const t = await db.query.topics.findFirst({ where: eq(schema.topics.id, body.topicId) });
        if (!t || t.moduleId !== moduleId) throw errors.badRequest('topicId inválido');
      }
      const db = getDb();
      const existing = await db
        .select({ orderIndex: schema.assessments.orderIndex })
        .from(schema.assessments)
        .where(eq(schema.assessments.moduleId, moduleId));
      const orderIndex = existing.reduce((mx, r) => Math.max(mx, r.orderIndex), -1) + 1;
      const [created] = await db
        .insert(schema.assessments)
        .values({
          moduleId,
          topicId: body.scope === 'topic' ? (body.topicId ?? null) : null,
          scope: body.scope,
          type: body.type,
          title: body.title,
          description: body.description ?? null,
          weight: body.weight,
          maxScore: body.maxScore,
          passingScore: body.passingScore,
          attemptsAllowed: body.attemptsAllowed,
          timeLimitMin: body.timeLimitMin ?? null,
          orderIndex,
        })
        .returning();
      reply.code(201);
      return { data: created };
    },
  );

  app.patch(
    '/v1/me/assessments/:assessmentId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: assessmentUpdateSchema },
    },
    async (req) => {
      const { assessmentId } = req.params as { assessmentId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { module: m } = await loadAssessmentChain(assessmentId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);
      const body = assessmentUpdateSchema.parse(req.body);
      const db = getDb();
      const [updated] = await db
        .update(schema.assessments)
        .set({
          ...(body.type !== undefined ? { type: body.type } : {}),
          ...(body.scope !== undefined ? { scope: body.scope } : {}),
          ...(body.topicId !== undefined ? { topicId: body.topicId } : {}),
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.weight !== undefined ? { weight: body.weight } : {}),
          ...(body.maxScore !== undefined ? { maxScore: body.maxScore } : {}),
          ...(body.passingScore !== undefined ? { passingScore: body.passingScore } : {}),
          ...(body.attemptsAllowed !== undefined ? { attemptsAllowed: body.attemptsAllowed } : {}),
          ...(body.timeLimitMin !== undefined ? { timeLimitMin: body.timeLimitMin } : {}),
        })
        .where(eq(schema.assessments.id, assessmentId))
        .returning();
      return { data: updated };
    },
  );

  app.delete(
    '/v1/me/assessments/:assessmentId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req, reply) => {
      const { assessmentId } = req.params as { assessmentId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { module: m } = await loadAssessmentChain(assessmentId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);
      const db = getDb();
      await db.delete(schema.assessments).where(eq(schema.assessments.id, assessmentId));
      reply.code(204);
    },
  );

  // ─── Questions ──────────────────────────────────────────────────────────────

  app.get(
    '/v1/me/assessments/:assessmentId/questions',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req) => {
      const { assessmentId } = req.params as { assessmentId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { module: m } = await loadAssessmentChain(assessmentId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.assessmentQuestions)
        .where(eq(schema.assessmentQuestions.assessmentId, assessmentId))
        .orderBy(asc(schema.assessmentQuestions.orderIndex));
      return { data: rows };
    },
  );

  app.post(
    '/v1/me/assessments/:assessmentId/questions',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: questionCreateSchema },
    },
    async (req, reply) => {
      const { assessmentId } = req.params as { assessmentId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { module: m, assessment: a } = await loadAssessmentChain(assessmentId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);
      const body = questionCreateSchema.parse(req.body);
      validateQuestionShape(body, a.type);
      const db = getDb();
      const existing = await db
        .select({ orderIndex: schema.assessmentQuestions.orderIndex })
        .from(schema.assessmentQuestions)
        .where(eq(schema.assessmentQuestions.assessmentId, assessmentId));
      const orderIndex = existing.reduce((mx, r) => Math.max(mx, r.orderIndex), -1) + 1;
      const [created] = await db
        .insert(schema.assessmentQuestions)
        .values({
          assessmentId,
          prompt: body.prompt,
          kind: body.kind,
          options: body.options ?? null,
          correctAnswer: body.correctAnswer ?? null,
          points: body.points,
          orderIndex,
        })
        .returning();
      reply.code(201);
      return { data: created };
    },
  );

  app.patch(
    '/v1/me/questions/:questionId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: questionUpdateSchema },
    },
    async (req) => {
      const { questionId } = req.params as { questionId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const q = await db.query.assessmentQuestions.findFirst({
        where: eq(schema.assessmentQuestions.id, questionId),
      });
      if (!q) throw errors.notFound('Pregunta no encontrada');
      const { module: m, assessment: a } = await loadAssessmentChain(q.assessmentId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);
      const body = questionUpdateSchema.parse(req.body);
      const merged = {
        prompt: body.prompt ?? q.prompt,
        kind: body.kind ?? q.kind,
        options: body.options !== undefined ? body.options : q.options,
        correctAnswer: body.correctAnswer !== undefined ? body.correctAnswer : q.correctAnswer,
        points: body.points ?? q.points,
      };
      validateQuestionShape(merged as never, a.type);
      const [updated] = await db
        .update(schema.assessmentQuestions)
        .set({
          ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
          ...(body.kind !== undefined ? { kind: body.kind } : {}),
          ...(body.options !== undefined ? { options: body.options } : {}),
          ...(body.correctAnswer !== undefined ? { correctAnswer: body.correctAnswer } : {}),
          ...(body.points !== undefined ? { points: body.points } : {}),
        })
        .where(eq(schema.assessmentQuestions.id, questionId))
        .returning();
      return { data: updated };
    },
  );

  app.delete(
    '/v1/me/questions/:questionId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req, reply) => {
      const { questionId } = req.params as { questionId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const q = await db.query.assessmentQuestions.findFirst({
        where: eq(schema.assessmentQuestions.id, questionId),
      });
      if (!q) throw errors.notFound('Pregunta no encontrada');
      const { module: m } = await loadAssessmentChain(q.assessmentId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);
      await db
        .delete(schema.assessmentQuestions)
        .where(eq(schema.assessmentQuestions.id, questionId));
      reply.code(204);
    },
  );

  // ─── Material del temario ─────────────────────────────────────────────────
  //
  // Sustituye al portal de contenido: el material academico pertenece al
  // curso, no a una seccion aparte. Al subir se genera una muestra como
  // archivo distinto, de modo que el original nunca se sirve sin autorizacion.
  app.post(
    '/v1/me/topics/:topicId/material',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      /**
       * Limite propio, mas alto que el global de 5 MB.
       *
       * El material viaja en base64, que engorda un tercio: con el limite
       * global quedaban 3,65 MB utiles y ningun video de una clase real
       * entraba. Se sube solo en ESTA ruta --no en todo el API-- porque es la
       * unica que recibe un archivo grande a proposito; el resto sigue
       * rechazando cuerpos enormes, que es lo que protege la memoria del
       * proceso.
       */
      bodyLimit: 96 * 1024 * 1024,
      schema: {
        tags: ['Dashboard'],
        description:
          'Sube el material de un temario (video, audio o PDF) y genera su muestra gratuita.',
        body: materialUploadSchema,
      },
    },
    async (req) => {
      const { topicId } = req.params as { topicId: string };
      const body = materialUploadSchema.parse(req.body);
      const institutionId = await resolveInstitutionId(req.auth!.userId);

      const db = getDb();
      const topic = await db.query.topics.findFirst({ where: eq(schema.topics.id, topicId) });
      if (!topic) throw errors.notFound('Temario no encontrado');
      const { module: m } = await loadModuleAndCourse(topic.moduleId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);

      // Un tipo que no sabriamos recortar terminaria sirviendo el original
      // como muestra, asi que se rechaza antes de guardar nada.
      const kind = materialKindFor(body.mimeType);
      if (!kind) {
        throw errors.validation({
          mimeType: ['Solo se admiten video, audio o PDF.'],
        });
      }

      const data = Buffer.from(body.data, 'base64');
      if (data.byteLength === 0) throw errors.validation({ data: ['El archivo esta vacio'] });

      const base = `courses/${m.courseId}/topics/${topicId}`;
      await uploadPrivateObject({ data, key: `${base}/full`, contentType: body.mimeType });

      // Portada: la imagen que ve quien todavia no tiene llave.
      //
      // De un PDF se deriva sola --su primera pagina ya es la caratula-- y
      // para video y audio la sube el creador, porque recortarlos exigiria
      // ffmpeg. Se guardan las dos versiones y ninguna es el original: la
      // nitida para quien tiene llave y la difuminada para quien no.
      //
      // Si algo falla aqui no se aborta la subida: el material completo ya
      // esta guardado y es valido, y quedarse sin portada es peor que perder
      // el archivo que el creador acaba de subir.
      let cover: RenderedCover | null = null;
      try {
        if (body.cover) {
          if (!isSupportedCoverMime(body.coverMimeType)) {
            throw errors.validation({
              coverMimeType: ['La portada debe ser JPEG, PNG, WebP o AVIF.'],
            });
          }
          cover = await renderTopicCover(Buffer.from(body.cover, 'base64'));
        } else if (kind === 'document') {
          cover = await renderPdfCover(data);
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        req.log.warn({ err, topicId }, 'No se pudo generar la portada del temario');
      }

      let coverKey: string | null = null;
      let coverBlurKey: string | null = null;
      if (cover) {
        coverKey = `${base}/cover`;
        coverBlurKey = `${base}/cover-blur`;
        await Promise.all([
          uploadPrivateObject({ data: cover.full, key: coverKey, contentType: cover.mimeType }),
          uploadPrivateObject({
            data: cover.blurred,
            key: coverBlurKey,
            contentType: cover.mimeType,
          }),
        ]);
      }

      // La muestra es un archivo fisico distinto. Mientras no exista un
      // recorte real en servidor, solo se publica si el creador la sube: usar
      // el original como muestra regalaria el material completo.
      let previewKey: string | null = null;
      if (body.preview) {
        const preview = Buffer.from(body.preview, 'base64');
        if (preview.byteLength > 0) {
          previewKey = `${base}/preview`;
          await uploadPrivateObject({
            data: preview,
            key: previewKey,
            contentType: body.mimeType,
          });
        }
      }

      const [updated] = await db
        .update(schema.topics)
        .set({
          assetKey: `${base}/full`,
          assetPreviewKey: previewKey,
          assetMimeType: body.mimeType,
          assetByteSize: data.byteLength,
          assetPreviewSeconds: body.previewSeconds ?? null,
          assetDurationSeconds: body.durationSeconds ?? null,
          coverKey,
          coverBlurKey,
          coverMimeType: cover?.mimeType ?? null,
          coverWidth: cover?.width ?? null,
          coverHeight: cover?.height ?? null,
          contentType: kind,
        })
        .where(eq(schema.topics.id, topicId))
        .returning();

      return { data: updated };
    },
  );

  app.delete(
    '/v1/me/topics/:topicId/material',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], description: 'Quita el material de un temario.' },
    },
    async (req) => {
      const { topicId } = req.params as { topicId: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);

      const db = getDb();
      const topic = await db.query.topics.findFirst({ where: eq(schema.topics.id, topicId) });
      if (!topic) throw errors.notFound('Temario no encontrado');
      const { module: m } = await loadModuleAndCourse(topic.moduleId);
      await assertCourseAccess(m.courseId, institutionId, req.auth!.role, req.auth!.userId);

      // Las claves se limpian de la fila; los objetos quedan en el storage a
      // proposito, porque borrarlos haria irrecuperable un quitado por error.
      const [updated] = await db
        .update(schema.topics)
        .set({
          assetKey: null,
          assetPreviewKey: null,
          assetMimeType: null,
          assetByteSize: null,
          assetPreviewSeconds: null,
          assetDurationSeconds: null,
          // La portada se limpia con el material: sin archivo al que
          // pertenecer, quedaria anunciando algo que ya no existe.
          coverKey: null,
          coverBlurKey: null,
          coverMimeType: null,
          coverWidth: null,
          coverHeight: null,
          contentType: 'text',
        })
        .where(eq(schema.topics.id, topicId))
        .returning();

      return { data: updated };
    },
  );
}

function validateQuestionShape(
  body: { kind: 'single' | 'boolean' | 'text'; options?: unknown; correctAnswer?: unknown },
  assessmentType: 'multiple_choice' | 'true_false' | 'essay',
) {
  if (assessmentType === 'multiple_choice') {
    if (body.kind !== 'single') {
      throw errors.badRequest('Las preguntas de multiple_choice deben ser kind=single');
    }
    if (!Array.isArray(body.options) || body.options.length < 2) {
      throw errors.badRequest('multiple_choice requiere al menos 2 opciones');
    }
    if (typeof body.correctAnswer !== 'string') {
      throw errors.badRequest('correctAnswer debe ser el id de la opción correcta');
    }
    const ids = (body.options as Array<{ id: string }>).map((o) => o.id);
    if (!ids.includes(body.correctAnswer)) {
      throw errors.badRequest('correctAnswer no coincide con ninguna opción');
    }
  } else if (assessmentType === 'true_false') {
    if (body.kind !== 'boolean') {
      throw errors.badRequest('true_false requiere kind=boolean');
    }
    if (typeof body.correctAnswer !== 'boolean') {
      throw errors.badRequest('correctAnswer debe ser boolean para true_false');
    }
  } else if (assessmentType === 'essay') {
    if (body.kind !== 'text') {
      throw errors.badRequest('essay requiere kind=text');
    }
  }
}
