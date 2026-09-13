import { relations } from 'drizzle-orm';
import {
  boolean,
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
import { users } from './auth.js';

export const institutionStatusEnum = pgEnum('institution_status', [
  'pending',
  'approved',
  'suspended',
  'revoked',
]);

export const planEnum = pgEnum('plan', ['starter', 'pro', 'pro_extended', 'enterprise']);

export const institutions = pgTable(
  'institutions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: text('description'),
    website: text('website'),
    logoUrl: text('logo_url'),
    country: varchar('country', { length: 2 }),
    legalName: varchar('legal_name', { length: 240 }),
    taxId: varchar('tax_id', { length: 80 }),
    addressLine: varchar('address_line', { length: 240 }),
    city: varchar('city', { length: 120 }),
    stateRegion: varchar('state_region', { length: 120 }),
    postalCode: varchar('postal_code', { length: 40 }),
    contactName: varchar('contact_name', { length: 200 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 60 }),
    accreditationId: varchar('accreditation_id', { length: 120 }),
    profileSubmittedAt: timestamp('profile_submitted_at', { withTimezone: true }),
    walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
    onchainInstitutionId: varchar('onchain_institution_id', { length: 78 }),

    /**
     * Lock de Unlock por defecto de la institución.
     *
     * Un Lock es un contrato con beneficiario propio: quien lo despliega es
     * quien cobra. Por eso pertenece a cada institución y no a Tessera, y por
     * eso se guarda a este nivel: el mismo emisor cobra todos sus cursos y
     * todo su contenido del portal.
     *
     * Es sólo el valor que se propone al crear. Cada curso conserva su propio
     * `lockAddress` como fuente de verdad, de modo que uno concreto puede usar
     * un Lock distinto sin afectar al resto.
     */
    defaultLockAddress: varchar('default_lock_address', { length: 42 }),
    defaultLockChainId: integer('default_lock_chain_id'),
    status: institutionStatusEnum('status').notNull().default('pending'),
    plan: planEnum('plan').notNull().default('starter'),
    paddleCustomerId: varchar('paddle_customer_id', { length: 100 }),
    paddleSubscriptionId: varchar('paddle_subscription_id', { length: 100 }),
    monthlyCertQuota: integer('monthly_cert_quota').notNull().default(100),
    certIssuedThisMonth: integer('cert_issued_this_month').notNull().default(0),
    // Flag para deduplicar notificaciones de saldo bajo (en el modelo actual:
    // creditos prepagados, no MATIC). Antes se llamaba "low MATIC balance".
    lowBalanceNotified: boolean('low_balance_notified').notNull().default(false),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspensionReason: text('suspension_reason'),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('institutions_slug_key').on(t.slug),
    uniqueIndex('institutions_wallet_key').on(t.walletAddress),
    index('institutions_status_idx').on(t.status),
  ],
);

export const institutionMembers = pgTable(
  'institution_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberRole: varchar('member_role', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('institution_members_unique').on(t.institutionId, t.userId),
    index('institution_members_user_idx').on(t.userId),
  ],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    prefix: varchar('prefix', { length: 20 }).notNull(),
    hash: varchar('hash', { length: 255 }).notNull(),
    secret: varchar('secret', { length: 255 }).notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('api_keys_prefix_key').on(t.prefix),
    index('api_keys_institution_idx').on(t.institutionId),
  ],
);

export const institutionsRelations = relations(institutions, ({ many }) => ({
  members: many(institutionMembers),
  apiKeys: many(apiKeys),
}));

export const institutionMembersRelations = relations(institutionMembers, ({ one }) => ({
  institution: one(institutions, {
    fields: [institutionMembers.institutionId],
    references: [institutions.id],
  }),
  user: one(users, { fields: [institutionMembers.userId], references: [users.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  institution: one(institutions, {
    fields: [apiKeys.institutionId],
    references: [institutions.id],
  }),
  creator: one(users, { fields: [apiKeys.createdBy], references: [users.id] }),
}));

/**
 * Acreditación institucional on-chain, por red.
 *
 * Aprobar una institución la registra en TesseraRegistry. Esta tabla deja
 * constancia de en qué cadena ocurrió, con qué transacción, y qué pasó si
 * falló: antes ese hecho vivía sólo como `status = approved` en la fila de la
 * institución, sin forma de saber si el contrato realmente la reconocía.
 *
 * El caso que la motiva es HashKey Chain: una cadena compliance-first donde un
 * auditor puede preguntarle al contrato si una institución está acreditada sin
 * pasar por la API de Tessera. Eso es lo que hace de un diploma un activo del
 * mundo real verificable.
 *
 * Es trazabilidad, nunca autorización: quien decide es el contrato. Una fila
 * aquí sólo dice que se intentó y cómo terminó.
 */
export const institutionAccreditations = pgTable(
  'institution_accreditations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    chainId: integer('chain_id').notNull(),
    /** pending | confirmed | failed */
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
    txHash: varchar('tx_hash', { length: 66 }),
    failureReason: text('failure_reason'),
    /** Un RPC intermitente puede necesitar varios intentos; conviene verlos. */
    attempts: integer('attempts').notNull().default(0),
    accreditedAt: timestamp('accredited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Una acreditación por institución y red: reintentar actualiza la fila en
    // vez de acumular intentos sueltos que ocultarían el estado actual.
    uniqueIndex('institution_accreditations_unique').on(t.institutionId, t.chainId),
    index('institution_accreditations_chain_idx').on(t.chainId, t.status),
  ],
);
