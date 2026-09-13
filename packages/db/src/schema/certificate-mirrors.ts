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
import { certificates } from './certificates.js';

/**
 * Copias del certificado en redes secundarias.
 *
 * La red principal (POLYGON_CHAIN_ID) decide si el certificado existe: su
 * token vive en `certificates`. Un espejo es una emision adicional del mismo
 * contenido en otra cadena, y su fallo nunca invalida el original, que ya
 * esta minteado y no se puede deshacer.
 *
 * Es una tabla aparte y no columnas en `certificates` porque el numero de
 * redes cambia sin tocar el esquema, y porque cada espejo tiene su propio
 * ciclo de vida: se reintenta por su cuenta.
 */
export const certificateMirrors = pgTable(
  'certificate_mirrors',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    certificateId: uuid('certificate_id')
      .notNull()
      .references(() => certificates.id, { onDelete: 'cascade' }),
    chainId: integer('chain_id').notNull(),
    /** queued | confirmed | failed */
    status: varchar('status', { length: 20 }).notNull().default('queued'),
    onchainTokenId: bigint('onchain_token_id', { mode: 'bigint' }),
    txHash: varchar('tx_hash', { length: 66 }),
    blockNumber: bigint('block_number', { mode: 'bigint' }),
    /** Ultimo motivo de fallo, para diagnosticar sin abrir los logs. */
    failureReason: text('failure_reason'),
    attempts: integer('attempts').notNull().default(0),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Un solo espejo por certificado y red: si el job se reintenta, actualiza
    // la fila en vez de mintear dos veces en la misma cadena.
    uniqueIndex('certificate_mirrors_cert_chain_key').on(t.certificateId, t.chainId),
    index('certificate_mirrors_status_idx').on(t.status),
  ],
);

export type CertificateMirror = typeof certificateMirrors.$inferSelect;
export type NewCertificateMirror = typeof certificateMirrors.$inferInsert;
