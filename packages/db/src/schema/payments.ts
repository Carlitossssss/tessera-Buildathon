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
import { users } from './auth.js';

// Provider-neutral payment records. The older provider columns below are retained
// only so deployed databases and their historical migration chain remain readable.
export const paymentOrders = pgTable(
  'payment_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 30 }).notNull(),
    providerOrderId: varchar('provider_order_id', { length: 128 }),
    kind: varchar('kind', { length: 30 }).notNull(),
    catalogCode: varchar('catalog_code', { length: 40 }).notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('created'),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payment_orders_provider_order_key').on(t.provider, t.providerOrderId),
    index('payment_orders_institution_idx').on(t.institutionId, t.createdAt),
  ],
);

export const paymentEvents = pgTable(
  'payment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 30 }).notNull(),
    providerEventId: varchar('provider_event_id', { length: 128 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('payment_events_provider_event_key').on(t.provider, t.providerEventId)],
);

export const subscriptionEntitlements = pgTable(
  'subscription_entitlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 30 }).notNull(),
    providerSubscriptionId: varchar('provider_subscription_id', { length: 128 }).notNull(),
    planCode: varchar('plan_code', { length: 40 }).notNull(),
    monthlyTsc: integer('monthly_tsc').notNull(),
    status: varchar('status', { length: 30 }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    lastGrantedPeriod: varchar('last_granted_period', { length: 30 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('subscription_entitlements_provider_subscription_key').on(
      t.provider,
      t.providerSubscriptionId,
    ),
  ],
);

export const billingPlans = pgTable(
  'billing_plans',
  {
    code: varchar('code', { length: 40 }).primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description').notNull(),
    monthlyTsc: integer('monthly_tsc').notNull(),
    monthlyPriceCents: integer('monthly_price_cents').notNull(),
    launchDiscountBps: integer('launch_discount_bps').notNull().default(0),
    extraTscPriceMilliCents: integer('extra_tsc_price_milli_cents').notNull(),
    minimumCommitmentMonths: integer('minimum_commitment_months').notNull().default(12),
    pricingVersion: varchar('pricing_version', { length: 80 }).notNull().default('2026-launch-v1'),
    active: integer('active').notNull().default(1),
    sortOrder: integer('sort_order').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('billing_plans_sort_idx').on(t.sortOrder)],
);

export const billingTscPackages = pgTable(
  'billing_tsc_packages',
  {
    code: varchar('code', { length: 40 }).primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    tsc: integer('tsc').notNull(),
    priceCents: integer('price_cents').notNull(),
    discountBps: integer('discount_bps').notNull().default(0),
    validityMonths: integer('validity_months').notNull().default(12),
    pricingVersion: varchar('pricing_version', { length: 80 }).notNull().default('2026-launch-v1'),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    active: integer('active').notNull().default(1),
    sortOrder: integer('sort_order').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('billing_tsc_packages_sort_idx').on(t.sortOrder)],
);

export const billingSettings = pgTable('billing_settings', {
  key: varchar('key', { length: 80 }).primaryKey(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id').references(() => institutions.id, {
      onDelete: 'restrict',
    }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    paddleTransactionId: varchar('paddle_transaction_id', { length: 100 }).notNull(),
    grossCents: integer('gross_cents').notNull(),
    paddleFeeCents: integer('paddle_fee_cents').notNull(),
    netCents: integer('net_cents').notNull(),
    tesseraCommissionCents: integer('tessera_commission_cents').notNull(),
    institutionPayoutCents: integer('institution_payout_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    payoutAt: timestamp('payout_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payouts_paddle_tx_key').on(t.paddleTransactionId),
    index('payouts_institution_idx').on(t.institutionId),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    paddleSubscriptionId: varchar('paddle_subscription_id', { length: 100 }).notNull(),
    plan: varchar('plan', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    billingCycle: varchar('billing_cycle', { length: 10 }).notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('subscriptions_paddle_key').on(t.paddleSubscriptionId)],
);
