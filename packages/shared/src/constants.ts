export const ROLES = {
  ADMIN: 'admin',
  INSTITUTION_ADMIN: 'institution_admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  API_CLIENT: 'api_client',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PLANS = {
  STARTER: 'starter',
  PRO: 'pro',
  PRO_EXTENDED: 'pro_extended',
} as const;

export type Plan = (typeof PLANS)[keyof typeof PLANS];

export const API_KEY_SCOPES = [
  'certificates:read',
  'certificates:write',
  'badges:read',
  'badges:write',
  'courses:read',
  'courses:write',
  'wallet:read',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const CERTIFICATE_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  ISSUED: 'issued',
  FAILED: 'failed',
  REVOKED: 'revoked',
} as const;

export type CertificateStatus = (typeof CERTIFICATE_STATUS)[keyof typeof CERTIFICATE_STATUS];

export const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const WEBHOOK_EVENTS = {
  CERTIFICATE_ISSUED: 'certificate.issued',
  CERTIFICATE_FAILED: 'certificate.failed',
  CERTIFICATE_REVOKED: 'certificate.revoked',
  BADGE_ISSUED: 'badge.issued',
  CREDITS_LOW_BALANCE: 'credits.low_balance',
  PAYMENT_RECEIVED: 'payment.received',
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

export const QUEUE_NAMES = {
  CERTIFICATE: 'certificate',
  BADGE: 'badge',
  WEBHOOK: 'webhook',
  EMAIL: 'email',
  INDEXER: 'indexer',
  GDPR_EXPORT: 'gdpr-export',
  GDPR_DELETION: 'gdpr-deletion',
  PAYMENT_SYNC: 'payment-sync',
} as const;

export const RATE_LIMITS_PER_MINUTE: Record<Plan, number> = {
  starter: 100,
  pro: 1000,
  pro_extended: 2500,
};

export const API_KEY_PREFIX = 'tss_';
export const WEBHOOK_MAX_ATTEMPTS = 7;
export const WEBHOOK_TTL_DAYS = 7;

export const WEBHOOK_BACKOFF_SCHEDULE_SECONDS = [0, 30, 300, 1800, 7200, 43200, 86400];

// ──────────────────────────────────────────────────────────────────────────────
// TSC is internal, non-transferable accounting value. Catalog and pricing are
// owned by the API; this legacy type remains only for older API consumers.
// ──────────────────────────────────────────────────────────────────────────────

export interface CreditBundle {
  code: string;
  credits: number;
  priceCents: number;
  currency: 'USD';
  /** Etiqueta corta para badge de descuento; "Mejor valor" en el bundle destacado. */
  highlight?: 'recommended' | 'best_value';
}

export const CREDIT_BUNDLES: readonly CreditBundle[] = [
  { code: 'bundle_100', credits: 100, priceCents: 3_000, currency: 'USD' },
  {
    code: 'bundle_500',
    credits: 500,
    priceCents: 10_000,
    currency: 'USD',
    highlight: 'recommended',
  },
  {
    code: 'bundle_1500',
    credits: 1500,
    priceCents: 25_000,
    currency: 'USD',
    highlight: 'best_value',
  },
] as const;

export function findBundle(code: string): CreditBundle | undefined {
  return CREDIT_BUNDLES.find((b) => b.code === code);
}

/** Umbral por debajo del cual la UI muestra advertencia de saldo bajo. */
export const CREDIT_LOW_THRESHOLD = 25;

export const CREDIT_REASONS = {
  PURCHASE: 'purchase',
  EMIT: 'emit',
  REFUND: 'refund',
  BONUS: 'bonus',
  ADJUSTMENT: 'adjustment',
} as const;

export type CreditReason = (typeof CREDIT_REASONS)[keyof typeof CREDIT_REASONS];
