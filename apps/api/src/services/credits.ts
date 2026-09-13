import { sql } from '@tessera/db';
import { schema } from '@tessera/db';
import { errors } from '@tessera/shared/errors';
import { getDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import {
  DEFAULT_TSC_PER_CERTIFICATE,
  getPricingVersion,
  getTscNominalValueCents,
  getTscPerCertificate,
} from './payments/catalog.js';

export const TSC_PER_CERTIFICATE = DEFAULT_TSC_PER_CERTIFICATE;

export async function getCreditBalance(institutionId: string): Promise<number> {
  const db = getDb();
  const rows = await db.execute<{ balance: number }>(sql`
    SELECT COALESCE(SUM(${schema.tscLots.remainingTsc}), 0)::int AS balance
    FROM ${schema.tscLots}
    WHERE ${schema.tscLots.institutionId} = ${institutionId}
      AND ${schema.tscLots.expiresAt} > now()
  `);
  return (rows as unknown as Array<{ balance: number }>)[0]?.balance ?? 0;
}

export interface DebitResult {
  ok: boolean;
  newBalance: number | null;
  reason: 'debited' | 'insufficient' | 'already_debited';
}

/** Debits the configured non-transferable TSC cost from the earliest expiring lots. */
export async function debitCertificateCredit(input: {
  institutionId: string;
  certificateId: string;
}): Promise<DebitResult> {
  const db = getDb();
  const tscPerCertificate = await getTscPerCertificate();
  return db.transaction(async (tx) => {
    // A per-institution transaction lock prevents concurrent SUM/read races.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.institutionId}))`);
    const prior = await tx.execute<{ id: string }>(sql`
      SELECT id FROM ${schema.creditLedger}
      WHERE ${schema.creditLedger.referenceType} = 'certificate'
        AND ${schema.creditLedger.referenceId} = ${input.certificateId} LIMIT 1
    `);
    if ((prior as unknown as Array<{ id: string }>)[0]) {
      const balance = balanceFromRows(
        await tx.execute(
          sql`SELECT COALESCE(SUM(remaining_tsc), 0)::int AS balance FROM ${schema.tscLots} WHERE institution_id = ${input.institutionId} AND expires_at > now()`,
        ),
      );
      return { ok: true, newBalance: balance, reason: 'already_debited' };
    }
    const lots = await tx.execute<{ id: string; remaining_tsc: number; expires_at: Date }>(sql`
      SELECT id, remaining_tsc, expires_at FROM ${schema.tscLots}
      WHERE institution_id = ${input.institutionId} AND expires_at > now() AND remaining_tsc > 0
      ORDER BY expires_at ASC, created_at ASC FOR UPDATE
    `);
    const rows = lots as unknown as Array<{ id: string; remaining_tsc: number; expires_at: Date }>;
    const balanceBefore = rows.reduce((sum, lot) => sum + lot.remaining_tsc, 0);
    if (balanceBefore < tscPerCertificate) {
      return {
        ok: false,
        newBalance: balanceFromRows(
          await tx.execute(
            sql`SELECT COALESCE(SUM(remaining_tsc), 0)::int AS balance FROM ${schema.tscLots} WHERE institution_id = ${input.institutionId} AND expires_at > now()`,
          ),
        ),
        reason: 'insufficient',
      };
    }
    let remaining = tscPerCertificate;
    const spentLots: Array<{ id: string; tsc: number }> = [];
    for (const lot of rows) {
      if (!remaining) break;
      const used = Math.min(remaining, lot.remaining_tsc);
      await tx.execute(
        sql`UPDATE ${schema.tscLots} SET remaining_tsc = remaining_tsc - ${used} WHERE id = ${lot.id}`,
      );
      spentLots.push({ id: lot.id, tsc: used });
      remaining -= used;
    }
    await tx.insert(schema.creditLedger).values({
      institutionId: input.institutionId,
      delta: -tscPerCertificate,
      reason: 'emit',
      referenceType: 'certificate',
      referenceId: input.certificateId,
      certificateCostTsc: tscPerCertificate,
      balanceBefore,
      balanceAfter: balanceBefore - tscPerCertificate,
      metadata: { tsc: tscPerCertificate, movementType: 'certificate_debit', spentLots },
    });
    return {
      ok: true,
      newBalance: balanceFromRows(
        await tx.execute(
          sql`SELECT COALESCE(SUM(remaining_tsc), 0)::int AS balance FROM ${schema.tscLots} WHERE institution_id = ${input.institutionId} AND expires_at > now()`,
        ),
      ),
      reason: 'debited',
    };
  });
}

export async function refundCertificateCredit(input: {
  institutionId: string;
  certificateId: string;
  note?: string;
}): Promise<boolean> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.institutionId}))`);
    const referenceId = `refund:${input.certificateId}`;
    const balanceBefore = balanceFromRows(
      await tx.execute(
        sql`SELECT COALESCE(SUM(remaining_tsc), 0)::int AS balance FROM ${schema.tscLots} WHERE institution_id = ${input.institutionId} AND expires_at > now()`,
      ),
    );
    const debitRows = await tx.execute<{
      certificate_cost_tsc: number | null;
      metadata: Record<string, unknown> | null;
    }>(sql`
      SELECT certificate_cost_tsc, metadata FROM ${schema.creditLedger}
      WHERE reference_type = 'certificate' AND reference_id = ${input.certificateId}
      LIMIT 1
    `);
    const debit = (debitRows as unknown as Array<{
      certificate_cost_tsc: number | null;
      metadata: Record<string, unknown> | null;
    }>)[0];
    if (!debit) return false;
    const refundedTsc = debit.certificate_cost_tsc ?? 0;
    if (!Number.isInteger(refundedTsc) || refundedTsc <= 0) {
      throw new Error(`Invalid certificate debit for refund ${input.certificateId}`);
    }
    const result = await tx.execute<{ inserted: boolean }>(sql`
      WITH debit AS (
        SELECT id FROM ${schema.creditLedger} WHERE reference_type = 'certificate' AND reference_id = ${input.certificateId}
      ), inserted AS (
        INSERT INTO ${schema.creditLedger} (institution_id, delta, reason, reference_type, reference_id, note, certificate_cost_tsc, balance_before, balance_after, metadata)
        SELECT ${input.institutionId}, ${refundedTsc}, 'refund', 'certificate_refund', ${referenceId}, ${input.note ?? 'Reembolso de emisión fallida'}, ${refundedTsc}, ${balanceBefore}, ${balanceBefore + refundedTsc}, ${JSON.stringify({ tsc: refundedTsc, movementType: 'refund' })}::jsonb
        FROM debit ON CONFLICT DO NOTHING RETURNING id
      ) SELECT EXISTS(SELECT 1 FROM inserted) AS inserted
    `);
    const inserted = (result as unknown as Array<{ inserted: boolean }>)[0]?.inserted ?? false;
    if (!inserted) return false;
    const spentLots = parseSpentLots(debit.metadata);
    if (spentLots.length) {
      for (const lot of spentLots) {
        await tx.execute(sql`
          UPDATE ${schema.tscLots}
          SET remaining_tsc = LEAST(total_tsc, remaining_tsc + ${lot.tsc})
          WHERE id = ${lot.id} AND institution_id = ${input.institutionId}
        `);
      }
      return true;
    }
    // Legacy debits did not record their FIFO allocation. Preserve the prior
    // fallback only for those historic records.
    await tx.insert(schema.tscLots).values({
      institutionId: input.institutionId,
      sourceType: 'certificate_refund',
      sourceId: referenceId,
      totalTsc: refundedTsc,
      remainingTsc: refundedTsc,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
    return true;
  });
}

function parseSpentLots(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.spentLots;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { id?: unknown; tsc?: unknown };
    return typeof row.id === 'string' && Number.isInteger(row.tsc) && (row.tsc as number) > 0
      ? [{ id: row.id, tsc: row.tsc as number }]
      : [];
  });
}

export async function grantPaymentTsc(input: {
  institutionId: string;
  paymentOrderId: string;
  packageCode: string;
  tsc: number;
  amountCents: number;
  currency: string;
  nominalValueCents?: number;
  discountCents?: number;
  discountBps?: number;
  pricingVersion?: string;
  certificateCostTsc?: number;
  validityMonths?: number;
}): Promise<{ alreadyApplied: boolean }> {
  if (!Number.isInteger(input.tsc) || input.tsc <= 0)
    throw errors.validation({ tsc: ['debe ser positivo'] });
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.institutionId}))`);
      const balanceBefore = balanceFromRows(
        await tx.execute(
          sql`SELECT COALESCE(SUM(remaining_tsc), 0)::int AS balance FROM ${schema.tscLots} WHERE institution_id = ${input.institutionId} AND expires_at > now()`,
        ),
      );
      await tx.insert(schema.tscLots).values({
        institutionId: input.institutionId,
        sourceType: 'payment_order',
        sourceId: input.paymentOrderId,
        totalTsc: input.tsc,
        remainingTsc: input.tsc,
        nominalValueCents: input.nominalValueCents,
        amountPaidCents: input.amountCents,
        discountCents: input.discountCents,
        discountBps: input.discountBps,
        pricingVersion: input.pricingVersion,
        certificateCostTsc: input.certificateCostTsc,
        expiresAt: dateMonthsFromNow(input.validityMonths ?? 12),
      });
      await tx.insert(schema.creditLedger).values({
        institutionId: input.institutionId,
        delta: input.tsc,
        reason: 'purchase',
        referenceType: 'payment_order',
        referenceId: input.paymentOrderId,
        bundleCode: input.packageCode,
        unitCostCents: input.amountCents,
        currency: input.currency,
        nominalValueCents: input.nominalValueCents,
        amountPaidCents: input.amountCents,
        discountCents: input.discountCents,
        discountBps: input.discountBps,
        pricingVersion: input.pricingVersion,
        certificateCostTsc: input.certificateCostTsc,
        balanceBefore,
        balanceAfter: balanceBefore + input.tsc,
        metadata: { tsc: input.tsc, providerNeutral: true, movementType: 'purchase' },
      });
    });
    return { alreadyApplied: false };
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      logger.info({ paymentOrderId: input.paymentOrderId }, 'TSC payment grant already applied');
      return { alreadyApplied: true };
    }
    throw error;
  }
}

/** Monthly grants are idempotent by subscription-period and never grow past two months of TSC. */
export async function grantSubscriptionTsc(input: {
  institutionId: string;
  subscriptionId: string;
  period: string;
  monthlyTsc: number;
  entitlementId?: string;
}): Promise<{ granted: number; alreadyApplied: boolean; blocked?: boolean }> {
  const db = getDb();
  const [tscNominalValueCents, certificateCostTsc, pricingVersion] = await Promise.all([
    getTscNominalValueCents(),
    getTscPerCertificate(),
    getPricingVersion(),
  ]);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.institutionId}))`);
    if (input.entitlementId) {
      const entitlement = await tx.execute<{ status: string }>(sql`
        SELECT status FROM ${schema.subscriptionEntitlements}
        WHERE id = ${input.entitlementId} FOR UPDATE
      `);
      if ((entitlement as unknown as Array<{ status: string }>)[0]?.status !== 'active') {
        return { granted: 0, alreadyApplied: true, blocked: true };
      }
    }
    const sourceId = `${input.subscriptionId}:${input.period}`;
    const prior = await tx.execute<{ id: string }>(
      sql`SELECT id FROM ${schema.tscLots} WHERE source_type = 'subscription' AND source_id = ${sourceId} LIMIT 1`,
    );
    if ((prior as unknown as Array<{ id: string }>)[0]) return { granted: 0, alreadyApplied: true };
    const balance = balanceFromRows(
      await tx.execute(
        sql`SELECT COALESCE(SUM(remaining_tsc), 0)::int AS balance FROM ${schema.tscLots} WHERE institution_id = ${input.institutionId} AND expires_at > now()`,
      ),
    );
    const granted = Math.max(0, Math.min(input.monthlyTsc, input.monthlyTsc * 2 - balance));
    // Record the period even when capped so retries never mint it later.
    await tx.insert(schema.tscLots).values({
      institutionId: input.institutionId,
      sourceType: 'subscription',
      sourceId,
      totalTsc: granted,
      remainingTsc: granted,
      nominalValueCents: granted * tscNominalValueCents,
      amountPaidCents: null,
      discountCents: null,
      discountBps: null,
      pricingVersion,
      certificateCostTsc,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
    if (granted) {
      await tx.insert(schema.creditLedger).values({
        institutionId: input.institutionId,
        delta: granted,
        reason: 'purchase',
        referenceType: 'subscription_period',
        referenceId: sourceId,
        nominalValueCents: granted * tscNominalValueCents,
        amountPaidCents: null,
        discountCents: null,
        discountBps: null,
        pricingVersion,
        certificateCostTsc,
        balanceBefore: balance,
        balanceAfter: balance + granted,
        metadata: {
          tsc: granted,
          subscriptionId: input.subscriptionId,
          period: input.period,
          movementType: 'subscription_grant',
        },
      });
    }
    return { granted, alreadyApplied: false };
  });
}

function balanceFromRows(rows: unknown): number {
  return (rows as Array<{ balance: number }>)[0]?.balance ?? 0;
}

function dateMonthsFromNow(months: number): Date {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + months);
  return date;
}
