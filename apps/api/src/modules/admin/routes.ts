import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import {
  reactivateInstitutionAdmins,
  restrictInstitutionAdmins,
} from '../../services/institution-access.js';
import {
  SUBSCRIPTION_PLANS,
  getContinuityReserveCents,
  getPackageValidityMonths,
  getPricingVersion,
  getSubscriptionPlans,
  getTscNominalValueCents,
  getTscPackages,
  getTscPerCertificate,
} from '../../services/payments/catalog.js';
import { approveInstitutionOnchain } from '../../services/registry.js';
import {
  accreditInstitution,
  activeAccreditationChainIds,
} from '../../services/institution-accreditation.js';
import type { Address } from 'viem';

function firstCount(rows: Array<{ n: number }>): number {
  return Number(rows[0]?.n ?? 0);
}

type SuspensionAppealMetadata = {
  email?: string;
  role?: string;
  institutionId?: string | null;
  supportEmail?: string;
};

function suspensionAppealAlertId(auditId: string) {
  return `restricted_appeal:${auditId}`;
}

async function listSuspensionReviewRequests(limit = 50) {
  const db = getDb();
  const rows = await db.query.auditLog.findMany({
    columns: {
      id: true,
      occurredAt: true,
      actorId: true,
      targetType: true,
      targetId: true,
      metadata: true,
    },
    where: eq(schema.auditLog.action, 'restricted_appeal.submitted'),
    limit,
    orderBy: [desc(schema.auditLog.occurredAt)],
  });

  if (rows.length === 0) {
    return { totals: { total: 0, open: 0, reviewed: 0 }, data: [] };
  }

  const alertIds = rows.map((row) => suspensionAppealAlertId(row.id));
  const userIds = Array.from(new Set(rows.map((row) => row.actorId).filter(Boolean)));
  const institutionIds = Array.from(
    new Set(
      rows
        .map((row) => {
          const metadata = (row.metadata ?? {}) as SuspensionAppealMetadata;
          return metadata.institutionId ?? (row.targetType === 'institution' ? row.targetId : null);
        })
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [resolutions, users, institutions] = await Promise.all([
    db.query.adminAlertResolutions.findMany({
      where: inArray(schema.adminAlertResolutions.alertId, alertIds),
    }),
    userIds.length > 0
      ? db.query.users.findMany({
          columns: {
            id: true,
            email: true,
            name: true,
            role: true,
            restricted: true,
          },
          where: inArray(schema.users.id, userIds),
        })
      : [],
    institutionIds.length > 0
      ? db.query.institutions.findMany({
          columns: {
            id: true,
            name: true,
            status: true,
          },
          where: inArray(schema.institutions.id, institutionIds),
        })
      : [],
  ]);

  const resolutionByAlertId = new Map(resolutions.map((row) => [row.alertId, row]));
  const userById = new Map(users.map((user) => [user.id, user]));
  const institutionById = new Map(institutions.map((institution) => [institution.id, institution]));
  const data = rows.map((row) => {
    const metadata = (row.metadata ?? {}) as SuspensionAppealMetadata;
    const alertId = suspensionAppealAlertId(row.id);
    const resolution = resolutionByAlertId.get(alertId);
    const user = userById.get(row.actorId);
    const institutionId =
      metadata.institutionId ?? (row.targetType === 'institution' ? row.targetId : null);
    const institution = institutionId ? institutionById.get(institutionId) : null;
    return {
      id: row.id,
      alertId,
      requesterEmail: metadata.email ?? user?.email ?? row.actorId,
      requesterName: user?.name ?? null,
      requesterRole: metadata.role ?? user?.role ?? 'user',
      targetType: row.targetType ?? 'user',
      targetId: row.targetId ?? row.actorId,
      institution: institution
        ? { id: institution.id, name: institution.name, status: institution.status }
        : null,
      supportEmail: metadata.supportEmail ?? null,
      submittedAt: row.occurredAt,
      reviewed: Boolean(resolution),
      reviewedAt: resolution?.resolvedAt ?? null,
      stillSuspended: user?.restricted ?? null,
    };
  });

  const open = data.filter((item) => !item.reviewed).length;
  return {
    totals: {
      total: data.length,
      open,
      reviewed: data.length - open,
    },
    data,
  };
}

function resolvePlanCopy(
  code: (typeof billingPlanUpdateSchema)['_output']['code'],
  currentPlans: Awaited<ReturnType<typeof getSubscriptionPlans>>,
) {
  const current = currentPlans.find((plan) => plan.code === code);
  const fallback = SUBSCRIPTION_PLANS.find((plan) => plan.code === code);
  return {
    name: current?.name ?? fallback?.name ?? code,
    description: current?.description ?? fallback?.description ?? code,
  };
}

function createPricingVersion(date = new Date()): string {
  const stamp = date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `pricing-${stamp}`;
}

const userRestrictionSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

const institutionSuspensionSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

const institutionRejectionSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(5),
  role: z.enum(['admin', 'institution_admin', 'teacher', 'student', 'api_client']).optional(),
  status: z
    .enum([
      'active',
      'restricted',
      'email_unverified',
      'deletion_scheduled',
      'deleted',
      'profile_incomplete',
      'profile_pending',
      'profile_rejected',
    ])
    .optional(),
  q: z.string().trim().max(120).optional(),
});

const adminCertificatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});

const adminAlertResolutionSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

const billingPlanUpdateSchema = z.object({
  code: z.enum(['essential', 'growth', 'institutional', 'scale', 'enterprise']),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  monthlyTsc: z.number().int().min(1).max(1_000_000),
  monthlyPriceCents: z.number().int().min(0).max(100_000_000),
  launchDiscountBps: z.number().int().min(0).max(10_000),
  extraTscPriceCents: z.number().min(0).max(100_000),
  minimumCommitmentMonths: z.number().int().min(1).max(120).default(12),
  active: z.boolean().default(true),
});

const tscPackageUpdateSchema = z.object({
  code: z.enum(['initial', 'growth', 'institutional', 'scale', 'enterprise']),
  name: z.string().trim().min(1).max(100),
  tsc: z.number().int().min(1).max(1_000_000),
  priceCents: z.number().int().min(0).max(100_000_000),
  discountBps: z.number().int().min(0).max(10_000),
  currency: z.literal('USD').default('USD'),
  active: z.boolean().default(true),
});

const billingCatalogUpdateSchema = z.object({
  tscPerCertificate: z.number().int().min(1).max(10_000),
  tscNominalValueCents: z.number().int().min(1).max(1_000_000),
  continuityReserveCents: z.number().int().min(0).max(1_000_000),
  packageValidityMonths: z.number().int().min(1).max(120),
  plans: z.array(billingPlanUpdateSchema).min(1).max(5),
  packages: z.array(tscPackageUpdateSchema).min(1).max(5),
});

export default async function adminRoutes(app: FastifyInstance) {
  app.get(
    '/v1/admin/dashboard',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'KPIs reales para el dashboard de administracion.' },
    },
    async () => {
      const db = getDb();
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const weekStart = new Date();
      weekStart.setUTCDate(weekStart.getUTCDate() - 7);
      weekStart.setUTCHours(0, 0, 0, 0);
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      const [
        activeInstitutions,
        activeInstitutionsThisMonth,
        certificates24h,
        certificatesPrevious24h,
        openPendingInstitutions,
        pendingInstitutionsThisMonth,
        rejectedInstitutions,
        rejectedInstitutionsThisWeek,
        suspendedInstitutions,
        suspendedInstitutionsThisMonth,
        suspendedUsers,
        suspendedUsersThisMonth,
        openFailedCertificates,
        failedCertificates24h,
        openFailedWebhooks,
        failedWebhooks24h,
        suspensionReviewRequests,
        pendingInstitutions,
      ] = await Promise.all([
        db
          .select({ n: count() })
          .from(schema.institutions)
          .where(eq(schema.institutions.status, 'approved')),
        db
          .select({ n: count() })
          .from(schema.institutions)
          .where(
            and(
              eq(schema.institutions.status, 'approved'),
              gte(schema.institutions.createdAt, monthStart),
            ),
          ),
        db
          .select({ n: count() })
          .from(schema.certificates)
          .where(gte(schema.certificates.createdAt, since24h)),
        db
          .select({ n: count() })
          .from(schema.certificates)
          .where(
            and(
              gte(schema.certificates.createdAt, since48h),
              lt(schema.certificates.createdAt, since24h),
            ),
          ),
        db
          .select({ n: count() })
          .from(schema.institutions)
          .where(
            and(
              eq(schema.institutions.status, 'pending'),
              isNotNull(schema.institutions.profileSubmittedAt),
            ),
          ),
        db
          .select({ n: count() })
          .from(schema.institutions)
          .where(
            and(
              eq(schema.institutions.status, 'pending'),
              isNotNull(schema.institutions.profileSubmittedAt),
              gte(schema.institutions.profileSubmittedAt, monthStart),
            ),
          ),
        db
          .select({ n: count() })
          .from(schema.institutions)
          .where(eq(schema.institutions.status, 'revoked')),
        db
          .select({ n: count() })
          .from(schema.institutions)
          .where(
            and(
              eq(schema.institutions.status, 'revoked'),
              gte(schema.institutions.rejectedAt, weekStart),
            ),
          ),
        db
          .select({ n: count() })
          .from(schema.institutions)
          .where(eq(schema.institutions.status, 'suspended')),
        db
          .select({ n: count() })
          .from(schema.institutions)
          .where(
            and(
              eq(schema.institutions.status, 'suspended'),
              gte(schema.institutions.suspendedAt, monthStart),
            ),
          ),
        db
          .select({ n: count() })
          .from(schema.users)
          .where(and(eq(schema.users.restricted, true), isNull(schema.users.deletedAt))),
        db
          .select({ n: count() })
          .from(schema.users)
          .where(
            and(
              eq(schema.users.restricted, true),
              isNull(schema.users.deletedAt),
              gte(schema.users.restrictedAt, monthStart),
            ),
          ),
        db
          .select({ n: count() })
          .from(schema.certificates)
          .where(eq(schema.certificates.status, 'failed')),
        db
          .select({ n: count() })
          .from(schema.certificates)
          .where(
            and(
              eq(schema.certificates.status, 'failed'),
              gte(schema.certificates.updatedAt, since24h),
            ),
          ),
        db
          .select({ n: count() })
          .from(schema.webhookEvents)
          .where(eq(schema.webhookEvents.status, 'failed')),
        db
          .select({ n: count() })
          .from(schema.webhookEvents)
          .where(
            and(
              eq(schema.webhookEvents.status, 'failed'),
              sql<boolean>`coalesce(${schema.webhookEvents.lastAttemptAt}, ${schema.webhookEvents.createdAt}) >= ${since24h}`,
            ),
          ),
        listSuspensionReviewRequests(10),
        db.query.institutions.findMany({
          columns: {
            id: true,
            name: true,
            country: true,
            status: true,
            createdAt: true,
          },
          where: and(
            eq(schema.institutions.status, 'pending'),
            isNotNull(schema.institutions.profileSubmittedAt),
          ),
          limit: 5,
          orderBy: [desc(schema.institutions.createdAt)],
        }),
      ]);

      const openAlerts =
        firstCount(openPendingInstitutions) +
        firstCount(openFailedCertificates) +
        firstCount(openFailedWebhooks) +
        suspensionReviewRequests.totals.open;

      return {
        kpis: {
          activeInstitutions: firstCount(activeInstitutions),
          activeInstitutionsThisMonth: firstCount(activeInstitutionsThisMonth),
          certificates24h: firstCount(certificates24h),
          certificates24hDeltaPct:
            firstCount(certificatesPrevious24h) > 0
              ? Math.round(
                  ((firstCount(certificates24h) - firstCount(certificatesPrevious24h)) /
                    firstCount(certificatesPrevious24h)) *
                    100,
                )
              : firstCount(certificates24h) > 0
                ? 100
                : 0,
          openAlerts,
          institutionsToReview: firstCount(openPendingInstitutions),
          institutionsToReviewThisMonth: firstCount(pendingInstitutionsThisMonth),
          rejectedInstitutions: firstCount(rejectedInstitutions),
          rejectedInstitutionsThisWeek: firstCount(rejectedInstitutionsThisWeek),
          suspendedInstitutions: firstCount(suspendedInstitutions),
          suspendedInstitutionsThisMonth: firstCount(suspendedInstitutionsThisMonth),
          suspendedUsers: firstCount(suspendedUsers),
          suspendedUsersThisMonth: firstCount(suspendedUsersThisMonth),
          failedCertificates: firstCount(openFailedCertificates),
          failedCertificates24h: firstCount(failedCertificates24h),
          failedWebhooks: firstCount(openFailedWebhooks),
          failedWebhooks24h: firstCount(failedWebhooks24h),
          suspensionReviewRequests: suspensionReviewRequests.totals.open,
        },
        pendingInstitutions: pendingInstitutions.map((inst) => ({
          id: inst.id,
          name: inst.name,
          country: inst.country,
          status: inst.status,
          createdAt: inst.createdAt,
        })),
        suspensionReviewRequests: suspensionReviewRequests.data.slice(0, 5),
      };
    },
  );

  app.get(
    '/v1/admin/institutions',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Instituciones con KPIs calculados desde la base.' },
    },
    async () => {
      const db = getDb();
      const [institutions, certCounts, activeSubscriptions, totals] = await Promise.all([
        db.query.institutions.findMany({
          columns: {
            id: true,
            name: true,
            slug: true,
            country: true,
            plan: true,
            status: true,
            createdAt: true,
            approvedAt: true,
            suspendedAt: true,
            suspensionReason: true,
            rejectedAt: true,
            rejectionReason: true,
            profileSubmittedAt: true,
          },
          limit: 100,
          where: sql<boolean>`(${schema.institutions.status} <> 'pending' or ${schema.institutions.profileSubmittedAt} is not null)`,
          orderBy: [desc(schema.institutions.createdAt)],
        }),
        db
          .select({ institutionId: schema.certificates.institutionId, n: count() })
          .from(schema.certificates)
          .groupBy(schema.certificates.institutionId),
        db
          .select({
            institutionId: schema.subscriptionEntitlements.institutionId,
            planCode: schema.subscriptionEntitlements.planCode,
          })
          .from(schema.subscriptionEntitlements)
          .where(eq(schema.subscriptionEntitlements.status, 'active'))
          .orderBy(desc(schema.subscriptionEntitlements.createdAt)),
        db
          .select({
            total: count(),
            approved: sql<number>`count(*) filter (where ${schema.institutions.status} = 'approved')`,
            pending: sql<number>`count(*) filter (where ${schema.institutions.status} = 'pending' and ${schema.institutions.profileSubmittedAt} is not null)`,
            rejected: sql<number>`count(*) filter (where ${schema.institutions.status} = 'revoked')`,
            suspended: sql<number>`count(*) filter (where ${schema.institutions.status} = 'suspended')`,
          })
          .from(schema.institutions),
      ]);

      const certCountByInstitution = new Map(certCounts.map((row) => [row.institutionId, row.n]));
      const activePlanByInstitution = new Map<string, string>();
      for (const row of activeSubscriptions) {
        if (!activePlanByInstitution.has(row.institutionId)) {
          activePlanByInstitution.set(row.institutionId, row.planCode);
        }
      }
      const totalCertificates = certCounts.reduce((sum, row) => sum + Number(row.n), 0);

      return {
        totals: {
          total: Number(totals[0]?.total ?? 0),
          approved: Number(totals[0]?.approved ?? 0),
          pending: Number(totals[0]?.pending ?? 0),
          rejected: Number(totals[0]?.rejected ?? 0),
          suspended: Number(totals[0]?.suspended ?? 0),
          certificates: totalCertificates,
        },
        data: institutions.map((inst) => ({
          id: inst.id,
          name: inst.name,
          slug: inst.slug,
          country: inst.country,
          plan: inst.plan,
          activePlanCode: activePlanByInstitution.get(inst.id) ?? null,
          status: inst.status,
          certificates: Number(certCountByInstitution.get(inst.id) ?? 0),
          createdAt: inst.createdAt,
          approvedAt: inst.approvedAt,
          suspendedAt: inst.suspendedAt,
          suspensionReason: inst.suspensionReason,
          rejectedAt: inst.rejectedAt,
          rejectionReason: inst.rejectionReason,
          profileSubmittedAt: inst.profileSubmittedAt,
        })),
      };
    },
  );

  app.get(
    '/v1/admin/institutions/:id',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Detalle real de una institucion.' },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const db = getDb();
      const institution = await db.query.institutions.findFirst({
        columns: {
          id: true,
          name: true,
          slug: true,
          country: true,
          plan: true,
          status: true,
          createdAt: true,
          approvedAt: true,
          suspendedAt: true,
          suspensionReason: true,
          rejectedAt: true,
          rejectionReason: true,
          website: true,
          description: true,
          legalName: true,
          taxId: true,
          addressLine: true,
          city: true,
          stateRegion: true,
          postalCode: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          accreditationId: true,
          profileSubmittedAt: true,
          walletAddress: true,
        },
        where: eq(schema.institutions.id, id),
      });
      if (!institution) return app.httpErrors.notFound('Institucion no encontrada');

      const [members, certCounts, activeSubscription] = await Promise.all([
        db
          .select({
            id: schema.institutionMembers.id,
            email: schema.users.email,
            name: schema.users.name,
            role: schema.users.role,
            memberRole: schema.institutionMembers.memberRole,
            createdAt: schema.institutionMembers.createdAt,
          })
          .from(schema.institutionMembers)
          .innerJoin(schema.users, eq(schema.users.id, schema.institutionMembers.userId))
          .where(eq(schema.institutionMembers.institutionId, id))
          .orderBy(desc(schema.institutionMembers.createdAt)),
        db
          .select({ status: schema.certificates.status, n: count() })
          .from(schema.certificates)
          .where(eq(schema.certificates.institutionId, id))
          .groupBy(schema.certificates.status),
        db.query.subscriptionEntitlements.findFirst({
          columns: {
            planCode: true,
          },
          where: and(
            eq(schema.subscriptionEntitlements.institutionId, id),
            eq(schema.subscriptionEntitlements.status, 'active'),
          ),
          orderBy: [desc(schema.subscriptionEntitlements.createdAt)],
        }),
      ]);

      const certificatesByStatus = Object.fromEntries(
        certCounts.map((row) => [row.status, Number(row.n)]),
      );

      return {
        id: institution.id,
        name: institution.name,
        slug: institution.slug,
        country: institution.country,
        plan: institution.plan,
        activePlanCode: activeSubscription?.planCode ?? null,
        status: institution.status,
        certificates: certCounts.reduce((sum, row) => sum + Number(row.n), 0),
        createdAt: institution.createdAt,
        approvedAt: institution.approvedAt,
        suspendedAt: institution.suspendedAt,
        suspensionReason: institution.suspensionReason,
        rejectedAt: institution.rejectedAt,
        rejectionReason: institution.rejectionReason,
        website: institution.website,
        description: institution.description,
        legalName: institution.legalName,
        taxId: institution.taxId,
        addressLine: institution.addressLine,
        city: institution.city,
        stateRegion: institution.stateRegion,
        postalCode: institution.postalCode,
        contactName: institution.contactName,
        contactEmail: institution.contactEmail,
        contactPhone: institution.contactPhone,
        accreditationId: institution.accreditationId,
        profileSubmittedAt: institution.profileSubmittedAt,
        walletAddress: institution.walletAddress,
        members,
        certificatesByStatus,
      };
    },
  );

  app.post(
    '/v1/admin/institutions/:id/approve',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Aprueba una institucion pendiente.' },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const db = getDb();
      const current = await db.query.institutions.findFirst({
        columns: { id: true, name: true, status: true, walletAddress: true, profileSubmittedAt: true },
        where: eq(schema.institutions.id, id),
      });
      if (!current) return app.httpErrors.notFound('Institucion no encontrada');
      // A previously approved institution may need an on-chain reconciliation.
      // Do not block that repair on the optional profile-review state.
      if (!current.profileSubmittedAt && current.status !== 'approved') {
        return app.httpErrors.badRequest(
          'La institucion debe completar y enviar su perfil detallado antes de aprobarse',
        );
      }
      try {
        await approveInstitutionOnchain({
          institution: current.walletAddress as Address,
          name: current.name,
        });
      } catch (err) {
        req.log.error({ err, institutionId: current.id }, 'No se pudo aprobar la institucion on-chain');
        return app.httpErrors.conflict(
          err instanceof Error ? err.message : 'No se pudo aprobar la institucion en TesseraRegistry',
        );
      }
      const [institution] = await db
        .update(schema.institutions)
        .set({
          status: 'approved',
          approvedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.institutions.id, id))
        .returning();
      if (!institution) return app.httpErrors.notFound('Institucion no encontrada');

      // Acreditacion en HashKey Chain: se lanza sin await y su fallo no puede
      // revertir una aprobacion que la red principal ya confirmo. El RPC de
      // HSK testnet es intermitente, asi que esperar aqui dejaria al panel
      // colgado por una cadena secundaria. El estado queda guardado y el admin
      // puede reintentar.
      for (const chainId of activeAccreditationChainIds()) {
        void accreditInstitution({
          institutionId: institution.id,
          walletAddress: institution.walletAddress,
          name: institution.name,
          chainId,
        }).catch((err: unknown) => {
          req.log.warn({ err, institutionId: institution.id, chainId }, 'Fallo la acreditacion');
        });
      }

      return {
        id: institution.id,
        status: institution.status,
        approvedAt: institution.approvedAt,
      };
    },
  );

  // Reintento manual de la acreditacion en una red secundaria.
  //
  // Existe porque el RPC de HSK testnet se cae y vuelve: una acreditacion
  // fallida no es un error de datos, es una red que no respondio. Sin este
  // boton habria que reaprobar la institucion entera para reintentarla.
  app.post(
    '/v1/admin/institutions/:id/accredit/:chainId',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: {
        tags: ['Admin'],
        description: 'Reintenta la acreditacion on-chain de una institucion en una red secundaria.',
      },
    },
    async (req) => {
      const { id, chainId } = req.params as { id: string; chainId: string };
      const db = getDb();
      const institution = await db.query.institutions.findFirst({
        where: eq(schema.institutions.id, id),
      });
      if (!institution) return app.httpErrors.notFound('Institucion no encontrada');
      if (institution.status !== 'approved') {
        return app.httpErrors.conflict('La institucion debe estar aprobada antes de acreditarse');
      }

      return accreditInstitution({
        institutionId: institution.id,
        walletAddress: institution.walletAddress,
        name: institution.name,
        chainId: Number.parseInt(chainId, 10),
      });
    },
  );

  app.post(
    '/v1/admin/institutions/:id/reject',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Rechaza una institucion pendiente.' },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const { reason } = institutionRejectionSchema.parse(req.body);
      const db = getDb();
      const current = await db.query.institutions.findFirst({
        columns: { id: true, status: true, profileSubmittedAt: true },
        where: eq(schema.institutions.id, id),
      });
      if (!current) return app.httpErrors.notFound('Institucion no encontrada');
      if (current.status !== 'pending') {
        return app.httpErrors.badRequest('Solo se pueden rechazar instituciones pendientes');
      }
      if (!current.profileSubmittedAt) {
        return app.httpErrors.badRequest(
          'La institucion debe completar y enviar su perfil detallado antes de rechazarse',
        );
      }
      const [institution] = await db
        .update(schema.institutions)
        .set({
          status: 'revoked',
          approvedAt: null,
          rejectedAt: new Date(),
          rejectionReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(schema.institutions.id, id))
        .returning();
      if (!institution) return app.httpErrors.notFound('Institucion no encontrada');
      return {
        id: institution.id,
        status: institution.status,
        rejectedAt: institution.rejectedAt,
        rejectionReason: institution.rejectionReason,
      };
    },
  );

  app.post(
    '/v1/admin/institutions/:id/suspend',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Suspende una institucion aprobada.' },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const { reason } = institutionSuspensionSchema.parse(req.body);
      const db = getDb();
      const current = await db.query.institutions.findFirst({
        columns: { id: true, status: true },
        where: eq(schema.institutions.id, id),
      });
      if (!current) return app.httpErrors.notFound('Institucion no encontrada');
      if (current.status !== 'approved') {
        return app.httpErrors.badRequest('Solo se pueden suspender instituciones aprobadas');
      }

      const [institution] = await db
        .update(schema.institutions)
        .set({
          status: 'suspended',
          suspendedAt: new Date(),
          suspensionReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(schema.institutions.id, id))
        .returning();
      if (!institution) return app.httpErrors.notFound('Institucion no encontrada');
      const restrictedAdmins = await restrictInstitutionAdmins(id, reason);
      return {
        id: institution.id,
        status: institution.status,
        suspendedAt: institution.suspendedAt,
        suspensionReason: institution.suspensionReason,
        restrictedAdmins,
      };
    },
  );

  app.post(
    '/v1/admin/institutions/:id/reactivate',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Reactiva una institucion suspendida.' },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const db = getDb();
      const current = await db.query.institutions.findFirst({
        columns: { id: true, status: true, suspensionReason: true },
        where: eq(schema.institutions.id, id),
      });
      if (!current) return app.httpErrors.notFound('Institucion no encontrada');
      if (current.status !== 'suspended') {
        return app.httpErrors.badRequest('Solo se pueden reactivar instituciones suspendidas');
      }

      const [institution] = await db
        .update(schema.institutions)
        .set({
          status: 'approved',
          suspendedAt: null,
          suspensionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.institutions.id, id))
        .returning();
      if (!institution) return app.httpErrors.notFound('Institucion no encontrada');
      const reactivatedAdmins = await reactivateInstitutionAdmins(id);
      return {
        id: institution.id,
        status: institution.status,
        suspendedAt: institution.suspendedAt,
        suspensionReason: institution.suspensionReason,
        reactivatedAdmins,
      };
    },
  );

  app.get(
    '/v1/admin/users',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Usuarios reales con institucion asociada.' },
    },
    async (req) => {
      const query = adminUsersQuerySchema.parse(req.query);
      const db = getDb();
      const where = [];

      if (query.role) {
        where.push(eq(schema.users.role, query.role));
      }

      if (query.status === 'active') {
        where.push(
          and(
            isNull(schema.users.deletedAt),
            eq(schema.users.restricted, false),
            isNull(schema.users.deletionScheduledAt),
            isNotNull(schema.users.emailVerifiedAt),
          ),
        );
      }
      if (query.status === 'restricted') {
        where.push(and(eq(schema.users.restricted, true), isNull(schema.users.deletedAt)));
      }
      if (query.status === 'email_unverified') {
        where.push(and(isNull(schema.users.emailVerifiedAt), isNull(schema.users.deletedAt)));
      }
      if (query.status === 'deletion_scheduled') {
        where.push(
          and(isNotNull(schema.users.deletionScheduledAt), isNull(schema.users.deletedAt)),
        );
      }
      if (query.status === 'deleted') {
        where.push(isNotNull(schema.users.deletedAt));
      }
      if (query.status === 'profile_incomplete') {
        where.push(sql<boolean>`(
          exists (
            select 1 from ${schema.userProfiles}
            where ${schema.userProfiles.userId} = ${schema.users.id}
              and ${schema.userProfiles.status} = 'incomplete'
          )
          or (
            ${schema.users.role} in ('student', 'teacher')
            and not exists (
              select 1 from ${schema.userProfiles}
              where ${schema.userProfiles.userId} = ${schema.users.id}
            )
          )
        )`);
      }
      if (query.status === 'profile_pending') {
        where.push(sql<boolean>`exists (
          select 1 from ${schema.userProfiles}
          where ${schema.userProfiles.userId} = ${schema.users.id}
            and ${schema.userProfiles.status} = 'pending'
        )`);
      }
      if (query.status === 'profile_rejected') {
        where.push(sql<boolean>`exists (
          select 1 from ${schema.userProfiles}
          where ${schema.userProfiles.userId} = ${schema.users.id}
            and ${schema.userProfiles.status} = 'rejected'
        )`);
      }
      if (query.q) {
        const pattern = `%${query.q}%`;
        where.push(sql<boolean>`(
          ${schema.users.email} ilike ${pattern}
          or coalesce(${schema.users.name}, '') ilike ${pattern}
          or exists (
            select 1
            from ${schema.institutionMembers}
            inner join ${schema.institutions}
              on ${schema.institutions.id} = ${schema.institutionMembers.institutionId}
            where ${schema.institutionMembers.userId} = ${schema.users.id}
              and ${schema.institutions.name} ilike ${pattern}
          )
          or exists (
            select 1
            from ${schema.institutionStudents}
            inner join ${schema.institutions}
              on ${schema.institutions.id} = ${schema.institutionStudents.institutionId}
            where ${schema.institutionStudents.userId} = ${schema.users.id}
              and ${schema.institutions.name} ilike ${pattern}
          )
          or exists (
            select 1
            from ${schema.enrollments}
            inner join ${schema.courses}
              on ${schema.courses.id} = ${schema.enrollments.courseId}
            inner join ${schema.institutions}
              on ${schema.institutions.id} = ${schema.courses.institutionId}
            where ${schema.enrollments.userId} = ${schema.users.id}
              and ${schema.institutions.name} ilike ${pattern}
          )
          or exists (
            select 1
            from ${schema.courseTeachers}
            inner join ${schema.courses}
              on ${schema.courses.id} = ${schema.courseTeachers.courseId}
            inner join ${schema.institutions}
              on ${schema.institutions.id} = ${schema.courses.institutionId}
            where ${schema.courseTeachers.userId} = ${schema.users.id}
              and ${schema.institutions.name} ilike ${pattern}
          )
        )`);
      }

      const whereClause = where.length > 0 ? and(...where) : undefined;
      const offset = (query.page - 1) * query.limit;

      const [users, filteredTotals, totals] = await Promise.all([
        db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
            role: schema.users.role,
            emailVerifiedAt: schema.users.emailVerifiedAt,
            restricted: schema.users.restricted,
            restrictedAt: schema.users.restrictedAt,
            restrictionReason: schema.users.restrictionReason,
            deletionScheduledAt: schema.users.deletionScheduledAt,
            deletedAt: schema.users.deletedAt,
            createdAt: schema.users.createdAt,
            profileStatus: sql<
              string | null
            >`coalesce(${schema.userProfiles.status}::text, case when ${schema.users.role} in ('student', 'teacher') then 'incomplete' else null end)`,
            profileRejectionReason: schema.userProfiles.rejectionReason,
          })
          .from(schema.users)
          .leftJoin(schema.userProfiles, eq(schema.userProfiles.userId, schema.users.id))
          .where(whereClause)
          .orderBy(desc(schema.users.createdAt))
          .limit(query.limit)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(schema.users)
          .where(whereClause),
        db
          .select({
            total: count(),
            institutionAdmins: sql<number>`count(*) filter (where ${schema.users.role} = 'institution_admin' and ${schema.users.deletedAt} is null)`,
            restricted: sql<number>`count(*) filter (where ${schema.users.restricted} = true and ${schema.users.deletedAt} is null)`,
            deleted: sql<number>`count(*) filter (where ${schema.users.deletedAt} is not null)`,
            pendingVerification: sql<number>`count(*) filter (where ${schema.users.emailVerifiedAt} is null and ${schema.users.deletedAt} is null)`,
            deletionScheduled: sql<number>`count(*) filter (where ${schema.users.deletionScheduledAt} is not null and ${schema.users.deletedAt} is null)`,
            profilePending: sql<number>`(
              select count(*)::int from ${schema.userProfiles}
              inner join ${schema.users} u on u.id = ${schema.userProfiles.userId}
              where ${schema.userProfiles.status} = 'pending'
                and u.deleted_at is null
            )`,
          })
          .from(schema.users),
      ]);
      const filteredTotal = Number(filteredTotals[0]?.total ?? 0);
      const totalPages = Math.max(1, Math.ceil(filteredTotal / query.limit));
      const userIds = users.map((user) => user.id);
      const memberships =
        userIds.length > 0
          ? await db.query.institutionMembers.findMany({
              where: inArray(schema.institutionMembers.userId, userIds),
            })
          : [];
      const studentMemberships =
        userIds.length > 0
          ? await db.query.institutionStudents.findMany({
              where: inArray(schema.institutionStudents.userId, userIds),
            })
          : [];
      const teacherAssignments =
        userIds.length > 0
          ? await db
              .select({
                userId: schema.courseTeachers.userId,
                institutionId: schema.courses.institutionId,
              })
              .from(schema.courseTeachers)
              .innerJoin(schema.courses, eq(schema.courses.id, schema.courseTeachers.courseId))
              .where(inArray(schema.courseTeachers.userId, userIds))
          : [];
      const enrollmentInstitutions =
        userIds.length > 0
          ? await db
              .select({
                userId: schema.enrollments.userId,
                institutionId: schema.courses.institutionId,
              })
              .from(schema.enrollments)
              .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollments.courseId))
              .where(inArray(schema.enrollments.userId, userIds))
          : [];
      const institutionIds = Array.from(
        new Set([
          ...memberships.map((m) => m.institutionId),
          ...studentMemberships.map((m) => m.institutionId),
          ...teacherAssignments.map((m) => m.institutionId),
          ...enrollmentInstitutions.map((m) => m.institutionId),
        ]),
      );
      const institutions =
        institutionIds.length > 0
          ? await db.query.institutions.findMany({
              columns: {
                id: true,
                name: true,
                slug: true,
              },
              where: inArray(schema.institutions.id, institutionIds),
            })
          : [];
      const institutionById = new Map(institutions.map((inst) => [inst.id, inst]));
      const institutionsByUser = new Map<
        string,
        Map<string, { id: string; name: string; slug: string }>
      >();
      const addInstitutionForUser = (userId: string, institutionId: string) => {
        const institution = institutionById.get(institutionId);
        if (!institution) return;
        const current = institutionsByUser.get(userId) ?? new Map();
        current.set(institution.id, {
          id: institution.id,
          name: institution.name,
          slug: institution.slug,
        });
        institutionsByUser.set(userId, current);
      };

      for (const membership of memberships) {
        addInstitutionForUser(membership.userId, membership.institutionId);
      }
      for (const membership of studentMemberships) {
        addInstitutionForUser(membership.userId, membership.institutionId);
      }
      for (const assignment of teacherAssignments) {
        addInstitutionForUser(assignment.userId, assignment.institutionId);
      }
      for (const enrollment of enrollmentInstitutions) {
        addInstitutionForUser(enrollment.userId, enrollment.institutionId);
      }

      return {
        totals: {
          total: Number(totals[0]?.total ?? 0),
          institutionAdmins: Number(totals[0]?.institutionAdmins ?? 0),
          restricted: Number(totals[0]?.restricted ?? 0),
          deleted: Number(totals[0]?.deleted ?? 0),
          pendingVerification: Number(totals[0]?.pendingVerification ?? 0),
          deletionScheduled: Number(totals[0]?.deletionScheduled ?? 0),
          profilePending: Number(totals[0]?.profilePending ?? 0),
        },
        pagination: {
          page: query.page,
          limit: query.limit,
          totalItems: filteredTotal,
          totalPages,
          hasNextPage: query.page < totalPages,
          hasPreviousPage: query.page > 1,
        },
        data: users.map((user) => {
          const userInstitutions = Array.from(institutionsByUser.get(user.id)?.values() ?? []);
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            emailVerifiedAt: user.emailVerifiedAt,
            restricted: user.restricted,
            restrictedAt: user.restrictedAt,
            restrictionReason: user.restrictionReason,
            deletionScheduledAt: user.deletionScheduledAt,
            deletedAt: user.deletedAt,
            createdAt: user.createdAt,
            profileStatus: user.profileStatus,
            profileRejectionReason: user.profileRejectionReason,
            institution: userInstitutions[0] ?? null,
            institutions: userInstitutions,
          };
        }),
      };
    },
  );

  app.get(
    '/v1/admin/users/:id',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Detalle real de un usuario.' },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const db = getDb();
      const user = await db.query.users.findFirst({
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerifiedAt: true,
          restricted: true,
          restrictedAt: true,
          restrictionReason: true,
          deletionScheduledAt: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          walletAddress: true,
        },
        where: eq(schema.users.id, id),
      });
      if (!user) return app.httpErrors.notFound('Usuario no encontrado');

      const profile =
        user.role === 'student' || user.role === 'teacher'
          ? await db.query.userProfiles.findFirst({
              where: eq(schema.userProfiles.userId, id),
            })
          : null;

      const [memberships, studentMemberships, teacherAssignments, enrollmentInstitutions] =
        await Promise.all([
          db.query.institutionMembers.findMany({
            where: eq(schema.institutionMembers.userId, id),
          }),
          db.query.institutionStudents.findMany({
            where: eq(schema.institutionStudents.userId, id),
          }),
          db
            .select({
              institutionId: schema.courses.institutionId,
            })
            .from(schema.courseTeachers)
            .innerJoin(schema.courses, eq(schema.courses.id, schema.courseTeachers.courseId))
            .where(eq(schema.courseTeachers.userId, id)),
          db
            .select({
              institutionId: schema.courses.institutionId,
            })
            .from(schema.enrollments)
            .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollments.courseId))
            .where(eq(schema.enrollments.userId, id)),
        ]);

      const institutionIds = Array.from(
        new Set([
          ...memberships.map((m) => m.institutionId),
          ...studentMemberships.map((m) => m.institutionId),
          ...teacherAssignments.map((m) => m.institutionId),
          ...enrollmentInstitutions.map((m) => m.institutionId),
        ]),
      );
      const institutions =
        institutionIds.length > 0
          ? await db.query.institutions.findMany({
              columns: { id: true, name: true, slug: true, status: true },
              where: inArray(schema.institutions.id, institutionIds),
            })
          : [];

      return {
        ...user,
        profileStatus:
          profile?.status ??
          (user.role === 'student' || user.role === 'teacher' ? 'incomplete' : null),
        profileRejectionReason: profile?.rejectionReason ?? null,
        profile:
          profile ??
          (user.role === 'student' || user.role === 'teacher'
            ? {
                status: 'incomplete',
                rejectionReason: null,
                firstName: null,
                lastName: null,
                documentType: null,
                documentNumber: null,
                birthDate: null,
                phone: null,
                country: null,
                city: null,
                addressLine: null,
                profileCompletedAt: null,
                profileSubmittedAt: null,
                approvedAt: null,
                rejectedAt: null,
                updatedAt: null,
              }
            : null),
        institutions,
      };
    },
  );

  app.post(
    '/v1/admin/users/:id/restrict',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Suspende el acceso de un usuario.' },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const { reason } = userRestrictionSchema.parse(req.body);
      if (id === req.auth!.userId) {
        return app.httpErrors.badRequest('No puedes suspender tu propia cuenta');
      }
      const db = getDb();
      const [user] = await db
        .update(schema.users)
        .set({
          restricted: true,
          restrictedAt: new Date(),
          restrictionReason: reason,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt)))
        .returning();
      if (!user) return app.httpErrors.notFound('Usuario no encontrado');
      return {
        id: user.id,
        restricted: user.restricted,
        restrictedAt: user.restrictedAt,
        restrictionReason: user.restrictionReason,
      };
    },
  );

  app.post(
    '/v1/admin/users/:id/unrestrict',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Reactiva el acceso de un usuario suspendido.' },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const db = getDb();
      const [user] = await db
        .update(schema.users)
        .set({
          restricted: false,
          restrictedAt: null,
          restrictionReason: null,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt)))
        .returning();
      if (!user) return app.httpErrors.notFound('Usuario no encontrado');
      return {
        id: user.id,
        restricted: user.restricted,
        restrictedAt: user.restrictedAt,
        restrictionReason: user.restrictionReason,
      };
    },
  );

  app.post(
    '/v1/admin/users/:id/profile/approve',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Aprueba el perfil detallado de un usuario.' },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const db = getDb();
      const user = await db.query.users.findFirst({
        columns: { id: true, role: true },
        where: and(eq(schema.users.id, id), isNull(schema.users.deletedAt)),
      });
      if (!user) return app.httpErrors.notFound('Usuario no encontrado');
      if (user.role !== 'student') {
        return app.httpErrors.badRequest('Sólo los estudiantes requieren aprobación global');
      }
      const [profile] = await db
        .update(schema.userProfiles)
        .set({
          status: 'approved',
          approvedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.userProfiles.userId, id), eq(schema.userProfiles.status, 'pending')))
        .returning();
      if (!profile) return app.httpErrors.badRequest('El perfil no está pendiente de aprobación');
      return { id: profile.id, userId: profile.userId, status: profile.status };
    },
  );

  app.post(
    '/v1/admin/users/:id/profile/reject',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: {
        tags: ['Admin'],
        description: 'Rechaza el perfil detallado de un usuario.',
        body: userRestrictionSchema,
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const { reason } = userRestrictionSchema.parse(req.body);
      const db = getDb();
      const user = await db.query.users.findFirst({
        columns: { id: true, role: true },
        where: and(eq(schema.users.id, id), isNull(schema.users.deletedAt)),
      });
      if (!user) return app.httpErrors.notFound('Usuario no encontrado');
      if (user.role !== 'student') {
        return app.httpErrors.badRequest('Sólo los estudiantes requieren aprobación global');
      }
      const [profile] = await db
        .update(schema.userProfiles)
        .set({
          status: 'rejected',
          approvedAt: null,
          rejectedAt: new Date(),
          rejectionReason: reason,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.userProfiles.userId, id), eq(schema.userProfiles.status, 'pending')))
        .returning();
      if (!profile) return app.httpErrors.badRequest('El perfil no está pendiente de aprobación');
      return {
        id: profile.id,
        userId: profile.userId,
        status: profile.status,
        rejectionReason: profile.rejectionReason,
      };
    },
  );

  app.delete(
    '/v1/admin/users/:id',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Elimina logicamente una cuenta de usuario.' },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      if (id === req.auth!.userId) {
        return app.httpErrors.badRequest('No puedes eliminar tu propia cuenta');
      }
      const db = getDb();
      const [user] = await db
        .update(schema.users)
        .set({
          restricted: true,
          restrictedAt: new Date(),
          restrictionReason: 'Cuenta eliminada por un administrador.',
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt)))
        .returning();
      if (!user) return app.httpErrors.notFound('Usuario no encontrado');
      return { id: user.id, deleted: true };
    },
  );

  app.get(
    '/v1/admin/alerts',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Alertas operativas derivadas de datos reales.' },
    },
    async () => {
      const db = getDb();
      const [pendingInstitutions, failedCertificates, failedWebhooks] = await Promise.all([
        db.query.institutions.findMany({
          columns: {
            id: true,
            name: true,
            createdAt: true,
          },
          where: eq(schema.institutions.status, 'pending'),
          limit: 20,
          orderBy: [desc(schema.institutions.createdAt)],
        }),
        db.query.certificates.findMany({
          where: eq(schema.certificates.status, 'failed'),
          limit: 20,
          orderBy: [desc(schema.certificates.updatedAt)],
        }),
        db.query.webhookEvents.findMany({
          where: eq(schema.webhookEvents.status, 'failed'),
          limit: 20,
          orderBy: [desc(schema.webhookEvents.createdAt)],
        }),
      ]);

      const institutionIds = Array.from(
        new Set([
          ...failedCertificates.map((cert) => cert.institutionId),
          ...failedWebhooks.map((event) => event.institutionId),
        ]),
      );
      const institutions =
        institutionIds.length > 0
          ? await db.query.institutions.findMany({
              columns: {
                id: true,
                name: true,
              },
              where: inArray(schema.institutions.id, institutionIds),
            })
          : [];
      const institutionById = new Map(institutions.map((inst) => [inst.id, inst]));

      const generatedAlerts = [
        ...pendingInstitutions.map((inst) => ({
          id: `institution:${inst.id}`,
          title: 'Institucion pendiente de aprobacion',
          description: `${inst.name} solicito acceso a la plataforma.`,
          severity: 'info' as const,
          createdAt: inst.createdAt,
          resolved: false,
        })),
        ...failedCertificates.map((cert) => {
          const inst = institutionById.get(cert.institutionId);
          return {
            id: `certificate:${cert.id}`,
            title: 'Emision de certificado fallida',
            description: `${inst?.name ?? 'Institucion'}: ${cert.achievementName} para ${cert.studentEmail}${cert.failureReason ? ` (${cert.failureReason})` : ''}.`,
            severity: 'error' as const,
            createdAt: cert.updatedAt,
            resolved: false,
          };
        }),
        ...failedWebhooks.map((event) => {
          const inst = institutionById.get(event.institutionId);
          return {
            id: `webhook:${event.id}`,
            title: 'Webhook fallando',
            description: `${inst?.name ?? 'Institucion'}: ${event.targetUrl}${event.lastStatusCode ? ` respondio ${event.lastStatusCode}` : ''}${event.lastError ? ` (${event.lastError})` : ''}.`,
            severity: 'warning' as const,
            createdAt: event.lastAttemptAt ?? event.createdAt,
            resolved: false,
          };
        }),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const resolvedRows =
        generatedAlerts.length > 0
          ? await db.query.adminAlertResolutions.findMany({
              where: inArray(
                schema.adminAlertResolutions.alertId,
                generatedAlerts.map((alert) => alert.id),
              ),
            })
          : [];
      const resolvedById = new Map(resolvedRows.map((row) => [row.alertId, row]));
      const alerts = generatedAlerts.map((alert) => {
        const resolution = resolvedById.get(alert.id);
        return {
          ...alert,
          resolved: Boolean(resolution),
          resolvedAt: resolution?.resolvedAt ?? null,
        };
      });
      const openAlerts = alerts.filter((alert) => !alert.resolved);

      return {
        totals: {
          open: openAlerts.length,
          errors: openAlerts.filter((alert) => alert.severity === 'error').length,
          warnings: openAlerts.filter((alert) => alert.severity === 'warning').length,
        },
        data: alerts.slice(0, 50),
      };
    },
  );

  app.get(
    '/v1/admin/suspension-requests',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: {
        tags: ['Admin'],
        description:
          'Señales de usuarios suspendidos que enviaron solicitud de revisión por email.',
      },
    },
    async () => listSuspensionReviewRequests(100),
  );

  app.post(
    '/v1/admin/suspension-requests/:requestId/resolve',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: {
        tags: ['Admin'],
        description: 'Marca una solicitud de revisión de suspensión como revisada.',
      },
    },
    async (req) => {
      const { requestId } = req.params as { requestId: string };
      const body = adminAlertResolutionSchema.parse(req.body ?? {});
      const db = getDb();
      const alertId = suspensionAppealAlertId(requestId);
      const [row] = await db
        .insert(schema.adminAlertResolutions)
        .values({
          alertId,
          resolvedBy: req.auth!.userId,
          note: body.note ?? null,
        })
        .onConflictDoUpdate({
          target: schema.adminAlertResolutions.alertId,
          set: {
            resolvedBy: req.auth!.userId,
            note: body.note ?? null,
            resolvedAt: new Date(),
          },
        })
        .returning();
      if (!row) {
        return app.httpErrors.internalServerError('No se pudo marcar la solicitud como revisada');
      }
      return { requestId, reviewed: true, reviewedAt: row.resolvedAt };
    },
  );

  app.get(
    '/v1/admin/billing-catalog',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Configuración editable de planes y TSC.' },
    },
    async () => ({
      tscPerCertificate: await getTscPerCertificate(),
      tscNominalValueCents: await getTscNominalValueCents(),
      continuityReserveCents: await getContinuityReserveCents(),
      packageValidityMonths: await getPackageValidityMonths(),
      pricingVersion: await getPricingVersion(),
      plans: await getSubscriptionPlans({ includeInactive: true }),
      packages: await getTscPackages({ includeInactive: true }),
    }),
  );

  app.put(
    '/v1/admin/billing-catalog',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Actualiza planes, paquetes y costo por emisión.' },
    },
    async (req) => {
      const body = billingCatalogUpdateSchema.parse(req.body);
      const db = getDb();
      const currentPlans = await getSubscriptionPlans({ includeInactive: true });
      const pricingVersion = createPricingVersion();
      await db.transaction(async (tx) => {
        await tx
          .insert(schema.billingSettings)
          .values({
            key: 'certificate_tsc_cost',
            value: { tsc: body.tscPerCertificate },
          })
          .onConflictDoUpdate({
            target: schema.billingSettings.key,
            set: { value: { tsc: body.tscPerCertificate }, updatedAt: new Date() },
          });
        await tx
          .insert(schema.billingSettings)
          .values({
            key: 'tsc_nominal_value_cents',
            value: { cents: body.tscNominalValueCents },
          })
          .onConflictDoUpdate({
            target: schema.billingSettings.key,
            set: { value: { cents: body.tscNominalValueCents }, updatedAt: new Date() },
          });
        await tx
          .insert(schema.billingSettings)
          .values({
            key: 'continuity_reserve_cents',
            value: { cents: body.continuityReserveCents },
          })
          .onConflictDoUpdate({
            target: schema.billingSettings.key,
            set: { value: { cents: body.continuityReserveCents }, updatedAt: new Date() },
          });
        await tx
          .insert(schema.billingSettings)
          .values({
            key: 'package_validity_months',
            value: { months: body.packageValidityMonths },
          })
          .onConflictDoUpdate({
            target: schema.billingSettings.key,
            set: { value: { months: body.packageValidityMonths }, updatedAt: new Date() },
          });
        await tx
          .insert(schema.billingSettings)
          .values({
            key: 'pricing_version',
            value: { version: pricingVersion },
          })
          .onConflictDoUpdate({
            target: schema.billingSettings.key,
            set: { value: { version: pricingVersion }, updatedAt: new Date() },
          });

        for (const [index, plan] of body.plans.entries()) {
          const copy = resolvePlanCopy(plan.code, currentPlans);
          await tx
            .insert(schema.billingPlans)
            .values({
              code: plan.code,
              name: plan.name,
              description: plan.description || copy.description,
              monthlyTsc: plan.monthlyTsc,
              monthlyPriceCents: plan.monthlyPriceCents,
              launchDiscountBps: plan.launchDiscountBps,
              extraTscPriceMilliCents: Math.round(plan.extraTscPriceCents * 1000),
              minimumCommitmentMonths: plan.minimumCommitmentMonths,
              pricingVersion,
              active: plan.active ? 1 : 0,
              sortOrder: (index + 1) * 10,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: schema.billingPlans.code,
              set: {
                name: plan.name,
                description: plan.description || copy.description,
                monthlyTsc: plan.monthlyTsc,
                monthlyPriceCents: plan.monthlyPriceCents,
                launchDiscountBps: plan.launchDiscountBps,
                extraTscPriceMilliCents: Math.round(plan.extraTscPriceCents * 1000),
                minimumCommitmentMonths: plan.minimumCommitmentMonths,
                pricingVersion,
                active: plan.active ? 1 : 0,
                sortOrder: (index + 1) * 10,
                updatedAt: new Date(),
              },
            });
        }

        for (const [index, bundle] of body.packages.entries()) {
          await tx
            .insert(schema.billingTscPackages)
            .values({
              code: bundle.code,
              name: bundle.name,
              tsc: bundle.tsc,
              priceCents: bundle.priceCents,
              discountBps: bundle.discountBps,
              validityMonths: body.packageValidityMonths,
              pricingVersion,
              currency: bundle.currency,
              active: bundle.active ? 1 : 0,
              sortOrder: (index + 1) * 10,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: schema.billingTscPackages.code,
              set: {
                name: bundle.name,
                tsc: bundle.tsc,
                priceCents: bundle.priceCents,
                discountBps: bundle.discountBps,
                validityMonths: body.packageValidityMonths,
                pricingVersion,
                currency: bundle.currency,
                active: bundle.active ? 1 : 0,
                sortOrder: (index + 1) * 10,
                updatedAt: new Date(),
              },
            });
        }
      });

      return {
        tscPerCertificate: await getTscPerCertificate(),
        tscNominalValueCents: await getTscNominalValueCents(),
        continuityReserveCents: await getContinuityReserveCents(),
        packageValidityMonths: await getPackageValidityMonths(),
        pricingVersion: await getPricingVersion(),
        plans: await getSubscriptionPlans({ includeInactive: true }),
        packages: await getTscPackages({ includeInactive: true }),
      };
    },
  );

  app.post(
    '/v1/admin/alerts/:alertId/resolve',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Marca una alerta derivada como resuelta.' },
    },
    async (req) => {
      const { alertId } = req.params as { alertId: string };
      const body = adminAlertResolutionSchema.parse(req.body ?? {});
      const db = getDb();
      const [row] = await db
        .insert(schema.adminAlertResolutions)
        .values({
          alertId,
          resolvedBy: req.auth!.userId,
          note: body.note ?? null,
        })
        .onConflictDoUpdate({
          target: schema.adminAlertResolutions.alertId,
          set: {
            resolvedBy: req.auth!.userId,
            note: body.note ?? null,
            resolvedAt: new Date(),
          },
        })
        .returning();
      if (!row) return app.httpErrors.internalServerError('No se pudo resolver la alerta');
      return { alertId: row.alertId, resolved: true, resolvedAt: row.resolvedAt };
    },
  );

  app.get(
    '/v1/admin/certificates',
    {
      preHandler: [app.requireAuth(['admin']), app.rateLimit()],
      schema: { tags: ['Admin'], description: 'Certificados reales emitidos en la plataforma.' },
    },
    async (req) => {
      const query = adminCertificatesQuerySchema.parse(req.query);
      const offset = (query.page - 1) * query.limit;
      const db = getDb();
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const [certificates, totals, statusRows, institutionRows] = await Promise.all([
        db
          .select({
            id: schema.certificates.id,
            studentName: schema.certificates.studentName,
            studentEmail: schema.certificates.studentEmail,
            institutionId: schema.certificates.institutionId,
            institutionName: schema.institutions.name,
            achievementName: schema.certificates.achievementName,
            courseTitle: schema.courses.title,
            onchainTokenId: schema.certificates.onchainTokenId,
            txHash: schema.certificates.txHash,
            issuedAt: schema.certificates.issuedAt,
            createdAt: schema.certificates.createdAt,
            status: schema.certificates.status,
          })
          .from(schema.certificates)
          .leftJoin(
            schema.institutions,
            eq(schema.institutions.id, schema.certificates.institutionId),
          )
          .leftJoin(schema.courses, eq(schema.courses.id, schema.certificates.courseId))
          .orderBy(desc(schema.certificates.createdAt))
          .limit(query.limit)
          .offset(offset),
        db
          .select({
            total: count(),
            revoked: sql<number>`count(*) filter (where ${schema.certificates.status} = 'revoked')`,
            issuedToday: sql<number>`count(*) filter (where ${schema.certificates.status} = 'issued' and ${schema.certificates.issuedAt} >= ${today})`,
          })
          .from(schema.certificates),
        db
          .select({
            status: schema.certificates.status,
            count: count(),
          })
          .from(schema.certificates)
          .groupBy(schema.certificates.status),
        db
          .select({
            institutionId: schema.certificates.institutionId,
            institutionName: schema.institutions.name,
            count: count(),
          })
          .from(schema.certificates)
          .leftJoin(
            schema.institutions,
            eq(schema.institutions.id, schema.certificates.institutionId),
          )
          .groupBy(schema.certificates.institutionId, schema.institutions.name),
      ]);

      const topInstitutionRows = institutionRows
        .map((row) => ({
          institutionId: row.institutionId,
          institutionName: row.institutionName,
          count: Number(row.count ?? 0),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      const totalItems = Number(totals[0]?.total ?? 0);
      const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));

      return {
        totals: {
          total: totalItems,
          revoked: Number(totals[0]?.revoked ?? 0),
          issuedToday: Number(totals[0]?.issuedToday ?? 0),
        },
        summary: {
          byStatus: statusRows.map((row) => ({
            status: row.status,
            count: Number(row.count ?? 0),
          })),
          byInstitution: topInstitutionRows.map((row) => ({
            institutionId: row.institutionId,
            institutionName: row.institutionName ?? 'Sin institución',
            count: row.count,
          })),
        },
        pagination: {
          page: query.page,
          limit: query.limit,
          totalItems,
          totalPages,
          hasNextPage: query.page < totalPages,
          hasPreviousPage: query.page > 1,
        },
        data: certificates.map((cert) => ({
          id: cert.id,
          studentName: cert.studentName,
          studentEmail: cert.studentEmail,
          institutionName: cert.institutionName ?? null,
          achievementName: cert.achievementName,
          courseTitle: cert.courseTitle ?? null,
          tokenId: cert.onchainTokenId?.toString() ?? null,
          txHash: cert.txHash,
          issuedAt: cert.issuedAt,
          createdAt: cert.createdAt,
          status: cert.status,
        })),
      };
    },
  );
}
