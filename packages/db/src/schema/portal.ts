import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { institutions } from './institutions.js';
import { users } from './auth.js';
import { certificates } from './certificates.js';

/**
 * Portal de contenido token-gated (Unlock Protocol).
 *
 * Tessera certifica lo que alguien aprendio; el portal controla el acceso al
 * contenido antes de certificarlo. La membresia vive on-chain en un Lock de
 * Unlock, de modo que quien decide el acceso es la blockchain y no nuestra
 * base de datos: aqui solo guardamos a que Lock corresponde cada contenido.
 *
 * Estas tablas son aditivas. Ninguna tabla existente cambia.
 */

/** Tipos de contenido con previsualizacion soportada. */
export const PORTAL_CONTENT_KINDS = ['text', 'image', 'video', 'audio'] as const;
export type PortalContentKind = (typeof PORTAL_CONTENT_KINDS)[number];

export const portalContents = pgTable(
  'portal_contents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    /** Autor del contenido. Se conserva aunque el usuario se elimine. */
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

    slug: varchar('slug', { length: 140 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    summary: text('summary'),
    kind: varchar('kind', { length: 20 }).$type<PortalContentKind>().notNull(),

    /**
     * Direccion del Lock que desbloquea este contenido y red donde vive.
     * Se guardan por contenido, no globalmente, para que cada creador pueda
     * usar su propio Lock y su propio precio.
     */
    lockAddress: varchar('lock_address', { length: 42 }).notNull(),
    lockChainId: integer('lock_chain_id').notNull(),

    /**
     * Claves en el object storage. El preview es un archivo fisico distinto,
     * recortado al subir: el original nunca se sirve sin llave valida, asi que
     * no hay forma de saltarse el pago desde el navegador.
     */
    previewKey: text('preview_key'),
    fullKey: text('full_key').notNull(),

    /** Texto de muestra para contenido escrito, ya recortado. */
    previewText: text('preview_text'),
    /** Segundos de muestra en audio/video; nulo para texto e imagen. */
    previewSeconds: integer('preview_seconds'),

    mimeType: varchar('mime_type', { length: 120 }),
    byteSize: bigint('byte_size', { mode: 'number' }),

    /**
     * Nombre del logro que se certifica al completar. Si es nulo, el contenido
     * no emite credencial: no toda pieza de un portal amerita un certificado.
     */
    certifiesAchievement: varchar('certifies_achievement', { length: 200 }),

    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // El slug identifica el contenido en la URL publica del portal.
    uniqueIndex('portal_contents_slug_key').on(t.slug),
    index('portal_contents_institution_idx').on(t.institutionId),
    index('portal_contents_lock_idx').on(t.lockAddress),
  ],
);

/**
 * Registro de desbloqueos. Es telemetria y trazabilidad, nunca la fuente de
 * autorizacion: el acceso se comprueba siempre contra el Lock on-chain, de
 * modo que una fila aqui no concede nada por si sola.
 */
export const portalUnlocks = pgTable(
  'portal_unlocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentId: uuid('content_id')
      .notNull()
      .references(() => portalContents.id, { onDelete: 'cascade' }),
    /** Wallet que presento la llave valida. */
    walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
    /** Usuario de Tessera, si el visitante tenia sesion. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

    lockAddress: varchar('lock_address', { length: 42 }).notNull(),
    lockChainId: integer('lock_chain_id').notNull(),
    /** Expiracion de la llave leida on-chain, para poder auditar despues. */
    keyExpiresAt: timestamp('key_expires_at', { withTimezone: true }),

    /**
     * Cierre del circulo: cuando el visitante termina el contenido, la
     * institucion le emite un certificado soulbound. Guardamos su id para no
     * emitir dos veces y para poder enlazar la credencial desde el portal.
     */
    completedAt: timestamp('completed_at', { withTimezone: true }),
    certificateId: uuid('certificate_id').references(() => certificates.id, {
      onDelete: 'set null',
    }),

    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('portal_unlocks_content_idx').on(t.contentId),
    index('portal_unlocks_wallet_idx').on(t.walletAddress),
    index('portal_unlocks_certificate_idx').on(t.certificateId),
    // Una credencial por wallet y contenido. El indice es parcial a proposito:
    // si incluyera completedAt (un timestamp distinto en cada intento) no
    // impediria nada, y sin el filtro los desbloqueos --que si se repiten--
    // chocarian entre si.
    uniqueIndex('portal_unlocks_completion_key')
      .on(t.contentId, t.walletAddress)
      .where(sql`${t.completedAt} is not null`),
  ],
);
