import { relations, sql } from 'drizzle-orm';
import {
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

/**
 * Libro contable append-only de creditos por institucion.
 *
 * Saldo actual = SUM(delta) WHERE institutionId = X.
 *
 * - delta > 0: compra, refund, bono, ajuste positivo.
 * - delta < 0: emision, ajuste negativo.
 *
 * Idempotencia:
 * - Historic provider purchases retain their legacy unique key.
 * - Emisiones de certificados: unique parcial sobre (referenceType, referenceId).
 *
 * Atomicidad del debito: ver services/credits.ts (CTE con guard de saldo > 0).
 */
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),

    delta: integer('delta').notNull(),
    reason: varchar('reason', { length: 40 }).notNull(),
    // 'purchase' | 'emit' | 'refund' | 'bonus' | 'adjustment'

    referenceType: varchar('reference_type', { length: 40 }),
    // Legacy values may exist; new payments use provider-neutral references.
    referenceId: varchar('reference_id', { length: 120 }),

    paddleTransactionId: varchar('paddle_transaction_id', { length: 100 }),
    bundleCode: varchar('bundle_code', { length: 40 }),
    unitCostCents: integer('unit_cost_cents'),
    currency: varchar('currency', { length: 3 }),
    nominalValueCents: integer('nominal_value_cents'),
    amountPaidCents: integer('amount_paid_cents'),
    discountCents: integer('discount_cents'),
    discountBps: integer('discount_bps'),
    pricingVersion: varchar('pricing_version', { length: 80 }),
    certificateCostTsc: integer('certificate_cost_tsc'),
    balanceBefore: integer('balance_before'),
    balanceAfter: integer('balance_after'),

    note: text('note'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('credit_ledger_institution_idx').on(t.institutionId, t.createdAt),
    uniqueIndex('credit_ledger_paddle_tx_unique')
      .on(t.paddleTransactionId)
      .where(sql`${t.paddleTransactionId} is not null`),
    uniqueIndex('credit_ledger_emit_unique')
      .on(t.referenceType, t.referenceId)
      .where(sql`${t.referenceType} = 'certificate'`),
  ],
);

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
  institution: one(institutions, {
    fields: [creditLedger.institutionId],
    references: [institutions.id],
  }),
}));

/** Expiring TSC grants. Remaining tokens are spent FIFO by expiration date. */
export const tscLots = pgTable(
  'tsc_lots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    sourceType: varchar('source_type', { length: 40 }).notNull(),
    sourceId: varchar('source_id', { length: 128 }).notNull(),
    totalTsc: integer('total_tsc').notNull(),
    remainingTsc: integer('remaining_tsc').notNull(),
    nominalValueCents: integer('nominal_value_cents'),
    amountPaidCents: integer('amount_paid_cents'),
    discountCents: integer('discount_cents'),
    discountBps: integer('discount_bps'),
    pricingVersion: varchar('pricing_version', { length: 80 }),
    certificateCostTsc: integer('certificate_cost_tsc'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('tsc_lots_source_key').on(t.sourceType, t.sourceId),
    index('tsc_lots_fifo_idx').on(t.institutionId, t.expiresAt),
  ],
);
