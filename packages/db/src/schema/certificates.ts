import { relations, sql } from 'drizzle-orm';
import {
  bigint,
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
import { courses } from './courses.js';

export const certificateStatusEnum = pgEnum('certificate_status', [
  'queued',
  'processing',
  'issued',
  'failed',
  'revoked',
]);

export const certificateTemplates = pgTable(
  'certificate_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    backgroundUrl: text('background_url'),
    layout: jsonb('layout').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('certificate_templates_institution_idx').on(t.institutionId)],
);

export const certificates = pgTable(
  'certificates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'restrict' }),
    studentUserId: uuid('student_user_id').references(() => users.id, { onDelete: 'set null' }),
    studentEmail: varchar('student_email', { length: 255 }).notNull(),
    studentName: varchar('student_name', { length: 200 }).notNull(),
    studentWallet: varchar('student_wallet', { length: 42 }),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
    templateId: uuid('template_id').references(() => certificateTemplates.id),
    achievementName: varchar('achievement_name', { length: 200 }).notNull(),
    achievementDescription: text('achievement_description'),
    grade: integer('grade'),
    externalId: varchar('external_id', { length: 200 }),
    idempotencyKey: varchar('idempotency_key', { length: 200 }),
    status: certificateStatusEnum('status').notNull().default('queued'),
    onchainTokenId: bigint('onchain_token_id', { mode: 'bigint' }),
    txHash: varchar('tx_hash', { length: 66 }),
    blockNumber: bigint('block_number', { mode: 'bigint' }),
    gasUsed: bigint('gas_used', { mode: 'bigint' }),
    arweaveTxId: varchar('arweave_tx_id', { length: 100 }),
    ipfsCid: varchar('ipfs_cid', { length: 100 }),
    tokenUri: text('token_uri'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    issuedBy: uuid('issued_by').references(() => users.id),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: uuid('revoked_by').references(() => users.id),
    revokeReason: varchar('revoke_reason', { length: 50 }),
    revokeReasonText: text('revoke_reason_text'),
    revokeTxHash: varchar('revoke_tx_hash', { length: 66 }),
    failureReason: text('failure_reason'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    callbackUrl: text('callback_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('certificates_institution_idx').on(t.institutionId),
    index('certificates_student_user_idx').on(t.studentUserId),
    index('certificates_student_email_idx').on(t.studentEmail),
    index('certificates_status_idx').on(t.status),
    index('certificates_token_id_idx').on(t.onchainTokenId),
    uniqueIndex('certificates_idempotency_unique')
      .on(t.institutionId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
  ],
);

export const emissionJobs = pgTable(
  'emission_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: varchar('public_id', { length: 100 }).notNull(),
    certificateId: uuid('certificate_id').references(() => certificates.id, {
      onDelete: 'set null',
    }),
    institutionId: uuid('institution_id').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('queued'),
    queue: varchar('queue', { length: 50 }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    result: jsonb('result').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('emission_jobs_public_id_key').on(t.publicId),
    index('emission_jobs_institution_idx').on(t.institutionId),
    index('emission_jobs_certificate_idx').on(t.certificateId),
  ],
);

export const certificatesRelations = relations(certificates, ({ one }) => ({
  institution: one(institutions, {
    fields: [certificates.institutionId],
    references: [institutions.id],
  }),
  student: one(users, {
    fields: [certificates.studentUserId],
    references: [users.id],
  }),
  course: one(courses, { fields: [certificates.courseId], references: [courses.id] }),
  template: one(certificateTemplates, {
    fields: [certificates.templateId],
    references: [certificateTemplates.id],
  }),
}));
