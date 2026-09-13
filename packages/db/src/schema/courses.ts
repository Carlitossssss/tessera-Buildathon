import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { institutions } from './institutions.js';
import { users } from './auth.js';

export const courseStatusEnum = pgEnum('course_status', ['draft', 'published', 'archived']);

/**
 * Modos de acceso al curso.
 *  - public_free: visible y gratuito para cualquiera.
 *  - public_paid: visible en catálogo público y requiere pago.
 *  - private_code: oculto del catálogo, sólo accesible canjeando el access_code.
 *  - hybrid: visible en catálogo, de pago para externos pero gratis para miembros
 *    de la institución que canjeen el access_code.
 *  - token_gated: visible en catálogo; la matrícula la concede una membresía
 *    de Unlock Protocol. Quien decide el acceso es el Lock on-chain, no
 *    nuestra base de datos.
 */
export const courseVisibilityEnum = pgEnum('course_visibility', [
  'public_free',
  'public_paid',
  'private_code',
  'hybrid',
  'token_gated',
]);

/**
 * Cómo caduca el acceso de un curso token-gated.
 *
 * `perpetual` es el valor por defecto y conserva el comportamiento anterior:
 * quien entró con una llave válida conserva el curso aunque la membresía
 * venza. Es lo correcto para un pago único —una entrada comprada no se
 * invalida—, pero convertía cualquier suscripción en pago único, y Unlock es
 * un protocolo de suscripciones: su `expirationDuration` existe para cortar.
 *
 * `subscription` revalida el Lock al entrar, así que una llave vencida cierra
 * el contenido hasta renovarla.
 */
export const courseAccessModeEnum = pgEnum('course_access_mode', [
  'perpetual',
  'subscription',
]);

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    description: text('description'),
    priceCents: integer('price_cents').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    thumbnailUrl: text('thumbnail_url'),
    durationHours: decimal('duration_hours', { precision: 6, scale: 2 }),
    passingScore: integer('passing_score').notNull().default(70),
    status: courseStatusEnum('status').notNull().default('draft'),
    visibility: courseVisibilityEnum('visibility').notNull().default('private_code'),
    /** Código de canje (12 chars uppercase). Único por institución. */
    accessCode: varchar('access_code', { length: 16 }),

    /**
     * Lock de Unlock que concede la matrícula, y red donde vive. Se guardan
     * por curso para que cada institución fije su propio precio y duración.
     * Obligatorios cuando visibility es 'token_gated'; la base lo exige con
     * un CHECK, porque un curso así sin Lock sería inaccesible para siempre.
     */
    lockAddress: varchar('lock_address', { length: 42 }),
    lockChainId: integer('lock_chain_id'),

    /**
     * Si el acceso concedido caduca con la membresía. Ver courseAccessModeEnum.
     * Sólo un curso token-gated puede ser suscripción: sin Lock no hay llave
     * que revalidar, y la base lo exige con un CHECK.
     */
    accessMode: courseAccessModeEnum('access_mode').notNull().default('perpetual'),

    /**
     * Módulos visibles sin membresía. Es la previsualización que permite
     * decidir antes de pagar; el resto del temario no sale del servidor sin
     * una llave válida.
     */
    previewModuleCount: integer('preview_module_count').notNull().default(1),
    autoIssueEnabled: boolean('auto_issue_enabled').notNull().default(true),
    templateId: uuid('template_id'),
    badgeCollectionId: uuid('badge_collection_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('courses_slug_unique').on(t.institutionId, t.slug),
    uniqueIndex('courses_access_code_unique').on(t.institutionId, t.accessCode),
    index('courses_institution_idx').on(t.institutionId),
    index('courses_status_idx').on(t.status),
    index('courses_visibility_idx').on(t.visibility),
    index('courses_lock_idx').on(t.lockAddress),
  ],
);

/**
 * Estudiantes registrados como "miembros" de una institución.
 * Habilita el modo híbrido: si un user es institutionStudent del owner del curso
 * y canjea el access_code, accede gratis aunque sea de pago para externos.
 */
export const institutionStudents = pgTable(
  'institution_students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Identificador interno del estudiante (matrícula, código universitario, etc.). */
    externalId: varchar('external_id', { length: 100 }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('institution_students_unique').on(t.institutionId, t.userId),
    index('institution_students_user_idx').on(t.userId),
  ],
);

export const modules = pgTable(
  'modules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    orderIndex: integer('order_index').notNull(),
    contentType: varchar('content_type', { length: 50 }).notNull(),
    content: jsonb('content').$type<Record<string, unknown>>(),
    /** Peso relativo del módulo en la nota final (0–100). 0 = no contabiliza. */
    weight: integer('weight').notNull().default(0),
    /** Si es false, el módulo es informativo y no exige completarse para aprobar. */
    isRequired: boolean('is_required').notNull().default(true),

    /**
     * Lock de Unlock que desbloquea ESTE módulo, independiente del lock del
     * curso. Permite que un curso gratuito venda material avanzado, o que un
     * módulo concreto tenga su propio precio. Ambos campos van juntos: una
     * dirección sin red no permite consultar el Lock ni construir el checkout.
     */
    lockAddress: varchar('lock_address', { length: 42 }),
    lockChainId: integer('lock_chain_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('modules_course_idx').on(t.courseId, t.orderIndex),
    index('modules_lock_idx').on(t.lockAddress),
  ],
);

export const courseTeachers = pgTable(
  'course_teachers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** owner = puede editar todo; assistant = sólo grading. */
    assignmentRole: varchar('assignment_role', { length: 20 }).notNull().default('owner'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('course_teachers_unique').on(t.courseId, t.userId),
    index('course_teachers_user_idx').on(t.userId),
  ],
);

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Email guardado de forma denormalizada para mostrar inscripciones aun si el user borra cuenta. */
    studentEmail: varchar('student_email', { length: 255 }),
    studentName: varchar('student_name', { length: 200 }),
    /** manual = inscrito por el equipo; payment = pagó mediante un proveedor; api = vino por API; code = canjeó access_code; public = se inscribió desde el catálogo público gratis; unlock = presentó una membresía válida de Unlock. */
    enrollmentSource: varchar('enrollment_source', { length: 20 }).notNull().default('manual'),

    /**
     * Trazabilidad de la matrícula por membresía: qué wallet presentó la
     * llave, de qué Lock y hasta cuándo era válida. Es auditoría, nunca la
     * fuente de autorización: esa es siempre el Lock on-chain, que se vuelve
     * a consultar en cada acceso.
     */
    unlockWallet: varchar('unlock_wallet', { length: 42 }),
    unlockLockAddress: varchar('unlock_lock_address', { length: 42 }),
    unlockChainId: integer('unlock_chain_id'),
    unlockKeyExpiresAt: timestamp('unlock_key_expires_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paddleTransactionId: varchar('paddle_transaction_id', { length: 100 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    finalScore: integer('final_score'),
    certificateId: uuid('certificate_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('enrollments_unique').on(t.courseId, t.userId),
    index('enrollments_user_idx').on(t.userId),
    index('enrollments_unlock_wallet_idx').on(t.unlockWallet),
  ],
);

/**
 * Temarios dentro de un módulo. Permiten desglosar un módulo grande
 * en varios sub-temas, cada uno con su propio contenido.
 */
export const topics = pgTable(
  'topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    contentType: varchar('content_type', { length: 50 }).notNull().default('text'),
    content: jsonb('content').$type<Record<string, unknown>>(),

    /**
     * Material del temario: video, audio o documento.
     *
     * El preview es un archivo físico distinto, generado al subir. El original
     * nunca se sirve sin autorización, así que no hay forma de saltarse la
     * membresía desde el navegador.
     */
    assetKey: text('asset_key'),
    assetPreviewKey: text('asset_preview_key'),
    assetMimeType: varchar('asset_mime_type', { length: 120 }),
    assetByteSize: bigint('asset_byte_size', { mode: 'number' }),
    /** Segundos de muestra en audio y video; nulo para documentos. */
    assetPreviewSeconds: integer('asset_preview_seconds'),
    /** Duración del material. Se muestra sobre la portada: saber cuánto dura
     *  una clase es parte de lo que decide la compra y no revela contenido. */
    assetDurationSeconds: integer('asset_duration_seconds'),

    /**
     * Portada del temario, en dos versiones.
     *
     * Un vídeo o un audio no se pueden recortar aquí —haría falta ffmpeg, que
     * no está en la imagen—, así que la muestra es una portada: es lo que usan
     * las plataformas de cursos y comunica de qué va la clase sin entregar
     * nada del material de pago.
     *
     * La difuminada se genera en el servidor. Aplicar el desenfoque por CSS lo
     * dejaría en decorativo: se quita desde el inspector y la imagen nítida
     * viaja igual.
     */
    coverKey: text('cover_key'),
    coverBlurKey: text('cover_blur_key'),
    coverMimeType: varchar('cover_mime_type', { length: 120 }),
    /** Dimensiones de la portada, para reservar el hueco antes de que cargue
     *  y que la ficha no dé un salto al pintarse. */
    coverWidth: integer('cover_width'),
    coverHeight: integer('cover_height'),

    orderIndex: integer('order_index').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('topics_module_idx').on(t.moduleId, t.orderIndex)],
);

/**
 * Registro de desbloqueos de módulo.
 *
 * Es trazabilidad, nunca la fuente de autorización: el acceso se comprueba
 * contra el Lock on-chain en cada intento, de modo que una fila aquí no
 * concede nada por sí sola.
 */
export const moduleUnlocks = pgTable(
  'module_unlocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    lockAddress: varchar('lock_address', { length: 42 }).notNull(),
    lockChainId: integer('lock_chain_id').notNull(),
    keyExpiresAt: timestamp('key_expires_at', { withTimezone: true }),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('module_unlocks_module_idx').on(t.moduleId),
    index('module_unlocks_wallet_idx').on(t.walletAddress),
  ],
);

export const assessmentScopeEnum = pgEnum('assessment_scope', ['topic', 'module']);
export const assessmentTypeEnum = pgEnum('assessment_type', [
  'multiple_choice',
  'true_false',
  'essay',
]);

/**
 * Evaluaciones del módulo. Pueden estar atadas a un topic concreto (scope='topic')
 * o cubrir el módulo completo (scope='module', topicId null).
 */
export const assessments = pgTable(
  'assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
    scope: assessmentScopeEnum('scope').notNull().default('module'),
    type: assessmentTypeEnum('type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    /** Peso de la evaluación dentro del módulo (0–100). Se normaliza al calcular la nota. */
    weight: integer('weight').notNull().default(0),
    maxScore: integer('max_score').notNull().default(100),
    passingScore: integer('passing_score').notNull().default(60),
    attemptsAllowed: integer('attempts_allowed').notNull().default(1),
    timeLimitMin: integer('time_limit_min'),
    orderIndex: integer('order_index').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('assessments_module_idx').on(t.moduleId, t.orderIndex),
    index('assessments_topic_idx').on(t.topicId),
  ],
);

export const assessmentQuestionKindEnum = pgEnum('assessment_question_kind', [
  'single',
  'boolean',
  'text',
]);

export const assessmentQuestions = pgTable(
  'assessment_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    prompt: text('prompt').notNull(),
    kind: assessmentQuestionKindEnum('kind').notNull(),
    /** Para 'single': [{ id, label }]. Para 'boolean'/'text': null. */
    options: jsonb('options').$type<Array<{ id: string; label: string }>>(),
    /** Para 'single': string id de opción. Para 'boolean': true|false. Para 'text' (essay): null (calificación manual). */
    correctAnswer: jsonb('correct_answer'),
    points: integer('points').notNull().default(1),
    orderIndex: integer('order_index').notNull(),
  },
  (t) => [index('assessment_questions_idx').on(t.assessmentId, t.orderIndex)],
);

export const assessmentAttemptStatusEnum = pgEnum('assessment_attempt_status', [
  'in_progress',
  'submitted',
  'graded',
]);

export const assessmentAttempts = pgTable(
  'assessment_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull().default(1),
    status: assessmentAttemptStatusEnum('status').notNull().default('in_progress'),
    /** { [questionId]: any } */
    answers: jsonb('answers').$type<Record<string, unknown>>().notNull().default({}),
    score: integer('score'),
    gradedBy: uuid('graded_by').references(() => users.id, { onDelete: 'set null' }),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    feedback: text('feedback'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('assessment_attempts_unique').on(t.enrollmentId, t.assessmentId, t.attemptNumber),
    index('assessment_attempts_enrollment_idx').on(t.enrollmentId),
    index('assessment_attempts_assessment_idx').on(t.assessmentId),
  ],
);

export const moduleProgressStatusEnum = pgEnum('module_progress_status', [
  'not_started',
  'in_progress',
  'completed',
]);

export const moduleProgress = pgTable(
  'module_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    status: moduleProgressStatusEnum('status').notNull().default('not_started'),
    score: integer('score'),
    note: text('note'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    /** Quién registró el avance: estudiante (self), docente, admin o sistema. */
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('module_progress_unique').on(t.enrollmentId, t.moduleId),
    index('module_progress_enrollment_idx').on(t.enrollmentId),
  ],
);

export const coursesRelations = relations(courses, ({ many, one }) => ({
  modules: many(modules),
  enrollments: many(enrollments),
  teachers: many(courseTeachers),
  institution: one(institutions, {
    fields: [courses.institutionId],
    references: [institutions.id],
  }),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
  course: one(courses, { fields: [modules.courseId], references: [courses.id] }),
  progress: many(moduleProgress),
  topics: many(topics),
  assessments: many(assessments),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  module: one(modules, { fields: [topics.moduleId], references: [modules.id] }),
  assessments: many(assessments),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  module: one(modules, { fields: [assessments.moduleId], references: [modules.id] }),
  topic: one(topics, { fields: [assessments.topicId], references: [topics.id] }),
  questions: many(assessmentQuestions),
  attempts: many(assessmentAttempts),
}));

export const assessmentQuestionsRelations = relations(assessmentQuestions, ({ one }) => ({
  assessment: one(assessments, {
    fields: [assessmentQuestions.assessmentId],
    references: [assessments.id],
  }),
}));

export const assessmentAttemptsRelations = relations(assessmentAttempts, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [assessmentAttempts.enrollmentId],
    references: [enrollments.id],
  }),
  assessment: one(assessments, {
    fields: [assessmentAttempts.assessmentId],
    references: [assessments.id],
  }),
  grader: one(users, { fields: [assessmentAttempts.gradedBy], references: [users.id] }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  progress: many(moduleProgress),
}));

export const courseTeachersRelations = relations(courseTeachers, ({ one }) => ({
  course: one(courses, { fields: [courseTeachers.courseId], references: [courses.id] }),
  user: one(users, { fields: [courseTeachers.userId], references: [users.id] }),
}));

export const moduleProgressRelations = relations(moduleProgress, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [moduleProgress.enrollmentId],
    references: [enrollments.id],
  }),
  module: one(modules, { fields: [moduleProgress.moduleId], references: [modules.id] }),
}));

export const institutionStudentsRelations = relations(institutionStudents, ({ one }) => ({
  institution: one(institutions, {
    fields: [institutionStudents.institutionId],
    references: [institutions.id],
  }),
  user: one(users, { fields: [institutionStudents.userId], references: [users.id] }),
}));
