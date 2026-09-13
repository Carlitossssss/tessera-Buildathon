import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { institutions } from './institutions.js';
import { users } from './auth.js';

export const badgeCollections = pgTable(
  'badge_collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    onchainCollectionId: bigint('onchain_collection_id', { mode: 'bigint' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    maxSupply: integer('max_supply'),
    arweaveTxId: varchar('arweave_tx_id', { length: 100 }),
    tokenUri: text('token_uri'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('badge_collections_institution_idx').on(t.institutionId),
    uniqueIndex('badge_collections_onchain_id_unique')
      .on(t.onchainCollectionId)
      .where(sql`${t.onchainCollectionId} IS NOT NULL`),
  ],
);

export const badges = pgTable(
  'badges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => badgeCollections.id, { onDelete: 'cascade' }),
    studentUserId: uuid('student_user_id').references(() => users.id, { onDelete: 'set null' }),
    studentWallet: varchar('student_wallet', { length: 42 }).notNull(),
    amount: integer('amount').notNull().default(1),
    txHash: varchar('tx_hash', { length: 66 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('badges_collection_idx').on(t.collectionId),
    index('badges_student_idx').on(t.studentUserId),
    index('badges_wallet_idx').on(t.studentWallet),
  ],
);

export const badgeCollectionsRelations = relations(badgeCollections, ({ many, one }) => ({
  badges: many(badges),
  institution: one(institutions, {
    fields: [badgeCollections.institutionId],
    references: [institutions.id],
  }),
}));

export const badgesRelations = relations(badges, ({ one }) => ({
  collection: one(badgeCollections, {
    fields: [badges.collectionId],
    references: [badgeCollections.id],
  }),
  student: one(users, { fields: [badges.studentUserId], references: [users.id] }),
}));
