import { relations } from 'drizzle-orm';
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { institutions } from './institutions.js';
import { courses } from './courses.js';

export const userProfileStatusEnum = pgEnum('user_profile_status', [
  'incomplete',
  'pending',
  'approved',
  'rejected',
]);

export const userProfiles = pgTable(
  'user_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    firstName: varchar('first_name', { length: 120 }),
    lastName: varchar('last_name', { length: 120 }),
    documentType: varchar('document_type', { length: 40 }),
    documentNumber: varchar('document_number', { length: 80 }),
    birthDate: date('birth_date'),
    phone: varchar('phone', { length: 60 }),
    country: varchar('country', { length: 2 }),
    city: varchar('city', { length: 120 }),
    addressLine: varchar('address_line', { length: 240 }),
    status: userProfileStatusEnum('status').notNull().default('incomplete'),
    profileCompletedAt: timestamp('profile_completed_at', { withTimezone: true }),
    profileSubmittedAt: timestamp('profile_submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_profiles_user_key').on(t.userId),
    index('user_profiles_status_idx').on(t.status),
  ],
);

export const teamInvitations = pgTable(
  'team_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 200 }),
    memberRole: varchar('member_role', { length: 50 }).notNull().default('teacher'),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('team_invitations_token_key').on(t.tokenHash),
    index('team_invitations_email_idx').on(t.email),
    index('team_invitations_institution_idx').on(t.institutionId),
    index('team_invitations_course_idx').on(t.courseId),
  ],
);

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}));

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  institution: one(institutions, {
    fields: [teamInvitations.institutionId],
    references: [institutions.id],
  }),
  course: one(courses, { fields: [teamInvitations.courseId], references: [courses.id] }),
  creator: one(users, { fields: [teamInvitations.createdBy], references: [users.id] }),
}));
