import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { and, count, desc, eq, gte, inArray, isNotNull, lt, or, sql } from '@tessera/db';
import { schema } from '@tessera/db';
import { type Address } from 'viem';
import { getDb } from '../../lib/db.js';
import { errors } from '@tessera/shared/errors';
import { chainClients, contractAddresses } from '../../services/nonce.js';
import { addressUrlFor, networkFor, nftUrlFor } from '../../config/networks.js';
import { mirrorCertificate } from '../../services/certificate-mirror.js';
import { issueCertificateSchema, paginationSchema } from '@tessera/shared/schemas';
import { getCreditBalance } from '../../services/credits.js';
import {
  applyBillingDiscount,
  findSubscriptionPlan,
  findTscPackage,
  getSubscriptionPlans,
  getTscPackages,
  getTscPerCertificate,
} from '../../services/payments/catalog.js';
import {
  cancelStripeSubscription,
  createStripeCheckoutSession,
  resolveStripePrice,
} from '../../services/payments/stripe.js';
import { stopSubscriptionEntitlement } from '../../services/payments/subscriptions.js';
import {
  autoIssueCourseCertificate,
  enqueueCertificateEmission,
} from '../../services/certificates.js';
import { env } from '../../config/env.js';
import { assertInstitutionActive } from '../../services/institution-access.js';
import {
  buildCheckoutUrl,
  formatKeyPrice,
  getLockInfo,
  isSupportedUnlockChain,
  normalizeLockAddress,
  supportedUnlockChainIds,
} from '../../services/unlock.js';
import {
  diagnoseLock,
  formatKeyCap,
  formatLockDuration,
  sameAddress,
} from '../../services/lock-health.js';
import { sendEmail } from '../../services/email.js';
import { provisionCustodialWallet } from '../../services/custodial-wallet.js';

const certListQuery = paginationSchema.extend({
  status: z.enum(['queued', 'processing', 'issued', 'failed', 'revoked']).optional(),
  studentEmail: z.string().email().optional(),
});

const stripeSubscriptionPriceByCode = {
  essential: () => env.STRIPE_PRICE_ESSENTIAL_MONTHLY,
  growth: () => env.STRIPE_PRICE_GROWTH_MONTHLY,
  institutional: () => env.STRIPE_PRICE_INSTITUTIONAL_MONTHLY,
  scale: () => env.STRIPE_PRICE_SCALE_MONTHLY,
} as const;

const stripePackagePriceByCode = {
  initial: () => env.STRIPE_PRICE_PACKAGE_200,
  growth: () => env.STRIPE_PRICE_PACKAGE_500,
  institutional: () => env.STRIPE_PRICE_PACKAGE_1000,
  scale: () => env.STRIPE_PRICE_PACKAGE_2000,
} as const;

const settingsSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  website: z.string().url().optional(),
  description: z.string().min(20).max(2000).optional(),
  country: z.string().length(2).optional(),
  legalName: z.string().min(2).max(240).optional(),
  taxId: z.string().min(2).max(80).optional(),
  addressLine: z.string().min(2).max(240).optional(),
  city: z.string().min(2).max(120).optional(),
  stateRegion: z.string().min(2).max(120).optional(),
  postalCode: z.string().max(40).optional(),
  contactName: z
    .string()
    .min(2)
    .max(200)
    .regex(/^[^\d]+$/)
    .optional(),
  contactEmail: z.string().email().max(255).optional(),
  contactPhone: z
    .string()
    .min(6)
    .max(60)
    .regex(/^\+?[0-9\s().-]{6,60}$/)
    .optional(),
  accreditationId: z.string().min(2).max(120).optional(),

  /**
   * Lock de Unlock por defecto. Se propone al crear cursos y contenido del
   * portal, para no tener que pegar la direccion en cada uno.
   *
   * Aceptan null explicito para poder desconfigurarlo. Van siempre juntos:
   * una direccion sin red no sirve para construir un checkout, y la base lo
   * exige con un CHECK.
   */
  defaultLockAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Lock invalido')
    .nullable()
    .optional(),
  defaultLockChainId: z.number().int().positive().nullable().optional(),
});

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function resolveInstitutionId(userId: string): Promise<string> {
  const db = getDb();
  const m = await db.query.institutionMembers.findFirst({
    where: eq(schema.institutionMembers.userId, userId),
  });
  if (!m) throw errors.forbidden('No perteneces a una institucion');
  const user = await db.query.users.findFirst({
    columns: { role: true },
    where: eq(schema.users.id, userId),
  });
  if (user?.role !== 'teacher') {
    await assertInstitutionActive(m.institutionId);
  }
  return m.institutionId;
}

async function resolveInstitutionIdForSettings(userId: string): Promise<string> {
  const db = getDb();
  const m = await db.query.institutionMembers.findFirst({
    where: eq(schema.institutionMembers.userId, userId),
  });
  if (!m) throw errors.forbidden('No perteneces a una institucion');
  return m.institutionId;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasDetailedInstitutionProfile(institution: {
  name?: string | null;
  website?: string | null;
  description?: string | null;
  country?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  addressLine?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  accreditationId?: string | null;
}) {
  const required = [
    institution.name,
    institution.website,
    institution.description,
    institution.country,
    institution.legalName,
    institution.taxId,
    institution.addressLine,
    institution.city,
    institution.stateRegion,
    institution.contactName,
    institution.contactEmail,
    institution.contactPhone,
    institution.accreditationId,
  ];
  if (!required.every((value) => typeof value === 'string' && value.trim().length > 0)) {
    return false;
  }

  const website = institution.website?.trim() ?? '';
  const description = institution.description?.trim() ?? '';
  const contactEmail = institution.contactEmail?.trim() ?? '';
  const contactPhone = institution.contactPhone?.trim() ?? '';
  return (
    isHttpUrl(website) &&
    description.length >= 20 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) &&
    /^\+?[0-9\s().-]{6,60}$/.test(contactPhone)
  );
}

export default async function meRoutes(app: FastifyInstance) {
  // ─── Stats / KPIs ───────────────────────────────────────────────────────────
  app.get(
    '/v1/me/stats',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'], description: 'KPIs agregados de la institucion del usuario.' },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();

      const startOfMonth = new Date();
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);

      const [issuedTotal, issuedThisMonth, queued, failed, revoked, students, members] =
        await Promise.all([
          db
            .select({ n: count() })
            .from(schema.certificates)
            .where(
              and(
                eq(schema.certificates.institutionId, institutionId),
                eq(schema.certificates.status, 'issued'),
              ),
            ),
          db
            .select({ n: count() })
            .from(schema.certificates)
            .where(
              and(
                eq(schema.certificates.institutionId, institutionId),
                eq(schema.certificates.status, 'issued'),
                gte(schema.certificates.issuedAt, startOfMonth),
              ),
            ),
          db
            .select({ n: count() })
            .from(schema.certificates)
            .where(
              and(
                eq(schema.certificates.institutionId, institutionId),
                eq(schema.certificates.status, 'queued'),
              ),
            ),
          db
            .select({ n: count() })
            .from(schema.certificates)
            .where(
              and(
                eq(schema.certificates.institutionId, institutionId),
                eq(schema.certificates.status, 'failed'),
              ),
            ),
          db
            .select({ n: count() })
            .from(schema.certificates)
            .where(
              and(
                eq(schema.certificates.institutionId, institutionId),
                eq(schema.certificates.status, 'revoked'),
              ),
            ),
          db
            .select({ n: sql<number>`count(distinct ${schema.enrollments.userId})::int` })
            .from(schema.enrollments)
            .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollments.courseId))
            .where(eq(schema.courses.institutionId, institutionId)),
          db
            .select({ n: count() })
            .from(schema.institutionMembers)
            .where(eq(schema.institutionMembers.institutionId, institutionId)),
        ]);

      return {
        certificates: {
          issuedTotal: issuedTotal[0]?.n ?? 0,
          issuedThisMonth: issuedThisMonth[0]?.n ?? 0,
          queued: queued[0]?.n ?? 0,
          failed: failed[0]?.n ?? 0,
          revoked: revoked[0]?.n ?? 0,
        },
        students: students[0]?.n ?? 0,
        teamMembers: members[0]?.n ?? 0,
      };
    },
  );

  // ─── Wallet (identidad emisora on-chain) ──────────────────────────────────
  // La institucion NO paga MATIC: Tessera firma y cubre el gas. El balance MATIC
  // de esta direccion es irrelevante para la emision. Solo se reporta la
  // direccion (issuer identity) y disponibilidad del nodo Polygon.
  app.get(
    '/v1/me/wallet',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description:
          'Identidad emisora on-chain de la institucion. Tessera firma las emisiones y cubre el gas; aqui no se reporta balance MATIC porque no se usa.',
      },
    },
    async (req) => {
      const db = getDb();
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const inst = await db.query.institutions.findFirst({
        where: eq(schema.institutions.id, institutionId),
      });
      if (!inst) throw errors.notFound('Institucion');

      const address = inst.walletAddress as Address;
      let chainOk = true;
      try {
        // ping ligero: si el nodo responde, asumimos disponibilidad
        await chainClients.publicClient.getBlockNumber();
      } catch (err) {
        chainOk = false;
        req.log.warn({ err }, 'Nodo Polygon no responde');
      }

      return {
        walletAddress: address,
        network: env.POLYGON_CHAIN,
        chainId: env.POLYGON_CHAIN_ID,
        chainAvailable: chainOk,
        issuerOnly: true,
      };
    },
  );

  // ─── Lista de certificados (JWT, no API key) ──────────────────────────────
  app.get(
    '/v1/me/certificates',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'], querystring: certListQuery },
    },
    async (req) => {
      const q = certListQuery.parse(req.query);
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();

      const where = [eq(schema.certificates.institutionId, institutionId)];
      if (q.status) where.push(eq(schema.certificates.status, q.status));
      if (q.studentEmail) where.push(eq(schema.certificates.studentEmail, q.studentEmail));
      const predicate = and(...where);
      const polygonscanBase =
        env.POLYGON_CHAIN_ID === 137 ? 'https://polygonscan.com' : 'https://amoy.polygonscan.com';

      const [rows, totals] = await Promise.all([
        db.query.certificates.findMany({
          where: predicate,
          limit: q.limit,
          offset: (q.page - 1) * q.limit,
          orderBy: [desc(schema.certificates.createdAt)],
        }),
        db.select({ total: count() }).from(schema.certificates).where(predicate),
      ]);

      return {
        page: q.page,
        limit: q.limit,
        total: totals[0]?.total ?? 0,
        data: rows.map((r) => ({
          id: r.id,
          status: r.status,
          studentName: r.studentName,
          studentEmail: r.studentEmail,
          achievementName: r.achievementName,
          grade: r.grade,
          tokenId: r.onchainTokenId?.toString() ?? null,
          txHash: r.txHash,
          transactionUrl: r.txHash ? `${polygonscanBase}/tx/${r.txHash}` : null,
          issuedAt: r.issuedAt,
          createdAt: r.createdAt,
          revokedAt: r.revokedAt,
          failureReason: r.failureReason,
        })),
      };
    },
  );

  app.post(
    '/v1/me/certificates/issue',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Encola la emision de uno o varios certificados desde el panel.',
        body: z.union([issueCertificateSchema, z.array(issueCertificateSchema).min(1).max(500)]),
      },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const body = z
        .union([issueCertificateSchema, z.array(issueCertificateSchema)])
        .parse(req.body);
      const payloads = Array.isArray(body) ? body : [body];
      const results = [];

      for (const payload of payloads) {
        results.push(
          await enqueueCertificateEmission({
            institutionId,
            payload,
            apiPublicUrl: env.API_PUBLIC_URL,
            issuedBy: req.auth!.userId,
          }),
        );
      }

      reply.status(202);
      return { data: results };
    },
  );

  app.get(
    '/v1/me/certificates/:id',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      const db = getDb();
      const cert = await db.query.certificates.findFirst({
        where: and(
          eq(schema.certificates.id, id),
          eq(schema.certificates.institutionId, institutionId),
        ),
      });
      if (!cert) throw errors.notFound('Certificado no encontrado');

      const polygonscanBase =
        env.POLYGON_CHAIN_ID === 137 ? 'https://polygonscan.com' : 'https://amoy.polygonscan.com';

      const [course, template, mirrors] = await Promise.all([
        cert.courseId
          ? db.query.courses.findFirst({ where: eq(schema.courses.id, cert.courseId) })
          : null,
        cert.templateId
          ? db.query.certificateTemplates.findFirst({
              where: eq(schema.certificateTemplates.id, cert.templateId),
            })
          : null,
        db.query.certificateMirrors.findMany({
          where: eq(schema.certificateMirrors.certificateId, cert.id),
        }),
      ]);

      return {
        id: cert.id,
        status: cert.status,
        studentName: cert.studentName,
        studentEmail: cert.studentEmail,
        studentWallet: cert.studentWallet,
        achievementName: cert.achievementName,
        achievementDescription: cert.achievementDescription,
        grade: cert.grade,
        courseId: cert.courseId,
        courseTitle: course?.title ?? null,
        templateId: cert.templateId,
        templateName: template?.name ?? null,
        tokenId: cert.onchainTokenId?.toString() ?? null,
        txHash: cert.txHash,
        blockNumber: cert.blockNumber?.toString() ?? null,
        arweaveTxId: cert.arweaveTxId,
        ipfsCid: cert.ipfsCid,
        tokenUri: cert.tokenUri,
        imageUrl: cert.onchainTokenId
          ? `${env.API_PUBLIC_URL}/v1/certificates/artwork/${cert.onchainTokenId.toString()}/certificate.png`
          : null,
        imageIpfsCid:
          typeof cert.metadata?.certificateBundleIpfsCid === 'string'
            ? `${cert.metadata.certificateBundleIpfsCid}/certificate.png`
            : typeof cert.metadata?.certificateImageIpfsCid === 'string'
              ? cert.metadata.certificateImageIpfsCid
              : null,
        downloadUrl: cert.onchainTokenId
          ? `${env.API_PUBLIC_URL}/v1/certificates/artwork/${cert.onchainTokenId.toString()}/certificate.png?download=1`
          : null,
        transactionUrl: cert.txHash ? `${polygonscanBase}/tx/${cert.txHash}` : null,
        contractUrl: `${polygonscanBase}/address/${contractAddresses.certificate}`,
        // Red principal + replicas. La principal decide si el certificado
        // existe; las demas son copias visibles en otros exploradores.
        chains: [
          {
            chainId: env.POLYGON_CHAIN_ID,
            name: networkFor(env.POLYGON_CHAIN_ID)?.name ?? env.POLYGON_CHAIN,
            role: 'primary' as const,
            status: cert.status === 'issued' ? 'confirmed' : cert.status,
            tokenId: cert.onchainTokenId?.toString() ?? null,
            explorerUrl: cert.onchainTokenId
              ? (nftUrlFor(
                  env.POLYGON_CHAIN_ID,
                  contractAddresses.certificate,
                  cert.onchainTokenId.toString(),
                ) ??
                `${polygonscanBase}/nft/${contractAddresses.certificate}/${cert.onchainTokenId.toString()}`)
              : `${polygonscanBase}/address/${contractAddresses.certificate}`,
          },
          ...mirrors.map((m) => {
            const net = networkFor(m.chainId);
            return {
              chainId: m.chainId,
              name: net?.name ?? `chain ${m.chainId}`,
              role: 'mirror' as const,
              status: m.status,
              tokenId: m.onchainTokenId?.toString() ?? null,
              // Sin el motivo, un "failed" obliga a abrir los logs del worker
              // para saber si falto gas, aprobacion o el RPC estaba caido.
              failureReason: m.failureReason,
              attempts: m.attempts,
              // A donde lleva "Ver".
              //
              // Con la replica confirmada se abre la ficha del NFT, que es lo
              // que alguien quiere mirar: el certificado dibujado. Mientras no
              // hay tokenId todavia no existe esa ficha, asi que se enlaza el
              // contrato, donde se ve si la emision llego a la cadena.
              explorerUrl: m.onchainTokenId
                ? nftUrlFor(m.chainId, net?.contracts.certificate ?? '', m.onchainTokenId.toString())
                : net
                  ? addressUrlFor(m.chainId, net.contracts.certificate)
                  : null,
            };
          }),
        ],
        issuedAt: cert.issuedAt,
        createdAt: cert.createdAt,
        revokedAt: cert.revokedAt,
        failureReason: cert.failureReason,
      };
    },
  );

  // ─── Settings de institucion ──────────────────────────────────────────────
  app.patch(
    '/v1/me/institution',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: settingsSchema },
    },
    async (req) => {
      const institutionId = await resolveInstitutionIdForSettings(req.auth!.userId);
      const body = settingsSchema.parse(req.body);
      const db = getDb();
      const current = await db.query.institutions.findFirst({
        where: eq(schema.institutions.id, institutionId),
      });
      if (!current) throw errors.notFound('Institucion');

      // El Lock por defecto se valida sobre el estado RESULTANTE: mandar solo
      // la direccion, o solo la red, dejaria la pareja incompleta y el CHECK
      // de la base rechazaria la escritura con un error opaco.
      const nextLockAddress =
        body.defaultLockAddress !== undefined ? body.defaultLockAddress : current.defaultLockAddress;
      const nextLockChainId =
        body.defaultLockChainId !== undefined ? body.defaultLockChainId : current.defaultLockChainId;

      if (Boolean(nextLockAddress) !== Boolean(nextLockChainId)) {
        throw errors.validation({
          defaultLockAddress: ['La direccion del Lock y su red deben configurarse juntas.'],
        });
      }
      if (nextLockChainId && !isSupportedUnlockChain(nextLockChainId)) {
        throw errors.validation({
          defaultLockChainId: [
            `Unlock no esta desplegado en esa red. Soportadas: ${supportedUnlockChainIds().join(', ')}`,
          ],
        });
      }

      /**
       * El Lock se comprueba contra la cadena antes de guardarlo.
       *
       * Hasta ahora bastaba con que el texto tuviera forma de direccion: la
       * pantalla decia "CONFIGURADO" aunque no existiera ese contrato, y el
       * curso quedaba imposible de matricular sin que nadie se enterara. El
       * portal ya validaba asi al publicar; esta pantalla no, y era el mismo
       * dato con dos criterios distintos.
       *
       * Solo se rechaza lo que la cadena desmiente. Si no responde nada, se
       * guarda igual: no se puede distinguir un RPC caido de una direccion
       * inventada, y castigar a quien la pego bien seria peor.
       */
      const lockChanged =
        body.defaultLockAddress !== undefined &&
        !sameAddress(nextLockAddress, current.defaultLockAddress);

      if (lockChanged && nextLockAddress && nextLockChainId) {
        const info = await getLockInfo(nextLockAddress, nextLockChainId).catch(() => null);
        const verdict = info
          ? diagnoseLock({
              reading: {
                name: info.name,
                publicLockVersion: info.publicLockVersion,
                owner: info.owner,
                keyPriceWei: info.keyPriceWei,
                expirationDuration: info.expirationDuration,
                totalSupply: info.totalSupply,
                hasCode: info.hasCode ?? undefined,
              },
              /**
               * Sin wallets que comparar, a proposito.
               *
               * `institutions.walletAddress` NO es la wallet de la
               * institucion: es una wallet custodiada que genera Tessera al
               * crear el workspace, con la clave en OpenBao. Un Lock se
               * despliega desde MetaMask, asi que su dueno nunca coincidira
               * con ella, y compararlos hacia saltar "este Lock no es tuyo"
               * en todos los casos --incluido el Lock correcto--.
               *
               * Un aviso que nadie puede satisfacer no protege de nada: solo
               * ensena a ignorar los avisos.
               */
              expectedOwners: [],
            })
          : ({ status: 'unreadable' } as const);

        // El error mas frecuente: pegar la wallet dueña en vez del Lock. Se
        // dice con esas palabras, porque "no responde como un Lock" no ayuda
        // a quien acaba de copiar la direccion equivocada.
        if (verdict.status === 'not-a-contract') {
          throw errors.validation({
            defaultLockAddress: [
              'Esa direccion es una wallet, no un contrato. El Lock es el contrato que despliega Unlock: copialo desde app.unlock-protocol.com, en la ficha de tu Lock.',
            ],
          });
        }
        if (verdict.status === 'not-a-lock') {
          throw errors.validation({
            defaultLockAddress: [
              'Esa direccion es un contrato, pero no responde como un Lock de Unlock. Revisa que sea el Lock y no otro contrato.',
            ],
          });
        }
        // 'foreign-owner' no bloquea: una institucion puede desplegar desde
        // una wallet personal y cobrar ahi a proposito. El aviso se da en la
        // pantalla, que es donde se puede explicar.
      }

      const merged = { ...current, ...body };
      const profileIsComplete = hasDetailedInstitutionProfile(merged);
      const shouldMarkSubmitted = !current.profileSubmittedAt && profileIsComplete;
      const shouldResubmitRejected = current.status === 'revoked' && profileIsComplete;
      const [row] = await db
        .update(schema.institutions)
        .set({
          ...body,
          ...(shouldMarkSubmitted || shouldResubmitRejected
            ? { profileSubmittedAt: new Date() }
            : {}),
          ...(shouldResubmitRejected
            ? { status: 'pending' as const, rejectedAt: null, rejectionReason: null }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.institutions.id, institutionId))
        .returning();
      return row;
    },
  );

  // ─── Verificación de un Lock ──────────────────────────────────────────────
  //
  // Lee el Lock contra la cadena y cuenta lo que encontró. No guarda nada: la
  // pantalla lo usa para mostrar precio, duración, dueño y llaves vendidas
  // ANTES de que la institución confirme, que es justo lo que faltaba.
  //
  // Sin esto, pegar una dirección era un acto de fe: la tarjeta decía
  // "configurado" sin haber leído una sola función del contrato.
  app.post(
    '/v1/me/lock/verify',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description:
          'Lee un Lock de Unlock on-chain y devuelve su estado, precio, duración y dueño. No guarda nada.',
        body: z.object({
          lockAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Lock inválido'),
          lockChainId: z.number().int().positive(),
        }),
      },
    },
    async (req) => {
      const body = z
        .object({
          lockAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Lock inválido'),
          lockChainId: z.number().int().positive(),
        })
        .parse(req.body);

      if (!isSupportedUnlockChain(body.lockChainId)) {
        throw errors.validation({
          lockChainId: [
            `Unlock no está desplegado en esa red. Soportadas: ${supportedUnlockChainIds().join(', ')}`,
          ],
        });
      }

      const institutionId = await resolveInstitutionIdForSettings(req.auth!.userId);
      const db = getDb();
      const institution = await db.query.institutions.findFirst({
        where: eq(schema.institutions.id, institutionId),
      });
      if (!institution) throw errors.notFound('Institucion');

      let address: string;
      try {
        address = normalizeLockAddress(body.lockAddress);
      } catch {
        throw errors.validation({ lockAddress: ['No es una dirección EVM válida.'] });
      }

      const info = await getLockInfo(address, body.lockChainId).catch(() => null);
      const verdict = info
        ? diagnoseLock({
            reading: {
              name: info.name,
              publicLockVersion: info.publicLockVersion,
              owner: info.owner,
              keyPriceWei: info.keyPriceWei,
              expirationDuration: info.expirationDuration,
              totalSupply: info.totalSupply,
              hasCode: info.hasCode ?? undefined,
            },
            // Ver la nota del guardado: la wallet custodiada de Tessera no
            // sirve para juzgar de quien es un Lock.
            expectedOwners: [],
          })
        : ({ status: 'unreadable' } as const);

      return {
        data: {
          status: verdict.status,
          address,
          chainId: body.lockChainId,
          network: info?.network ?? null,
          name: info?.name ?? null,
          /** Precio ya formateado: "0.001 ETH", o "Gratis" si el Lock no cobra. */
          price: formatKeyPrice(info?.keyPriceWei ?? null, body.lockChainId),
          duration: formatLockDuration(info?.expirationDuration),
          keysSold: info?.totalSupply ?? null,
          keyCap: formatKeyCap(info?.maxNumberOfKeys),
          version: info?.publicLockVersion ?? null,
          owner: info?.owner ?? null,
          /** La wallet con la que se comparó, para que la pantalla la muestre. */
          institutionWallet: institution.walletAddress,
          checkoutUrl: info?.checkoutUrl ?? buildCheckoutUrl(address, body.lockChainId),
        },
      };
    },
  );

  // ─── Cursos ───────────────────────────────────────────────────────────────
  const courseCreateSchema = z.object({
    title: z.string().min(2).max(200),
    slug: z
      .string()
      .min(2)
      .max(200)
      .regex(/^[a-z0-9-]+$/, 'Solo minusculas, numeros y guiones'),
    description: z.string().max(2000).optional(),
    priceCents: z.number().int().min(0).default(0),
    currency: z.string().length(3).default('USD'),
    passingScore: z.number().int().min(0).max(100).default(70),
    durationHours: z.number().min(0).optional(),
    autoIssueEnabled: z.boolean().default(true),
    templateId: z.string().uuid().nullable().optional(),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    visibility: z
      .enum(['public_free', 'public_paid', 'private_code', 'hybrid', 'token_gated'])
      .default('private_code'),
    /**
     * Lock de Unlock que concede la matrícula. Sólo tiene sentido con
     * visibility 'token_gated'; se valida más abajo, junto con la red, para
     * no crear un curso que nadie pueda abrir.
     */
    lockAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Lock inválido').nullable().optional(),
    lockChainId: z.number().int().positive().nullable().optional(),
    /**
     * Si el acceso concedido caduca con la membresía.
     *
     * 'perpetual' es pago único: quien entró conserva el curso. 'subscription'
     * revalida el Lock al entrar, que es lo que hace de Unlock una suscripción
     * de verdad; sin esto, pagar un mes dejaba el curso para siempre.
     */
    accessMode: z.enum(['perpetual', 'subscription']).default('perpetual'),
    /** Módulos abiertos como muestra antes de exigir la membresía. */
    previewModuleCount: z.number().int().min(0).max(50).default(1),
  });
  const courseUpdateSchema = courseCreateSchema.partial();

  /**
   * Un curso token-gated sin Lock válido sería inaccesible para siempre:
   * aparecería en el catálogo y nadie podría matricularse. Se comprueba al
   * crear y al actualizar, sobre el estado resultante y no sólo sobre lo que
   * llega en el body, porque cambiar únicamente la visibility también puede
   * dejar el curso en ese estado.
   */
  /**
   * Comprueba el Lock de un curso contra la cadena.
   *
   * `assertGateConfigured` solo mira la forma: que haya direccion y que la red
   * este soportada. Con eso, la direccion que se hereda del ajuste de la
   * institucion entraba sin verificar --y si esa era una wallet en vez del
   * Lock, el curso quedaba imposible de matricular sin que nadie se enterara
   * hasta que un alumno lo intentaba--.
   *
   * Se comprueba aqui ademas de en el ajuste porque cada curso puede usar un
   * Lock propio: verificar solo el de la institucion dejaria sin comprobar
   * justo los que se pegan a mano, que son los que mas se equivocan.
   *
   * Solo rechaza lo que la cadena desmiente. Si el RPC no responde se acepta:
   * no se puede distinguir un proveedor caido de una direccion inventada, y
   * bloquear la creacion de un curso por un fallo nuestro seria peor.
   */
  async function assertCourseLockIsUsable(next: {
    visibility?: string | null;
    lockAddress?: string | null;
    lockChainId?: number | null;
  }) {
    if (next.visibility !== 'token_gated') return;
    if (!next.lockAddress || !next.lockChainId) return;

    const info = await getLockInfo(next.lockAddress, next.lockChainId).catch(() => null);
    if (!info) return;

    const verdict = diagnoseLock({
      reading: {
        name: info.name,
        publicLockVersion: info.publicLockVersion,
        owner: info.owner,
        keyPriceWei: info.keyPriceWei,
        expirationDuration: info.expirationDuration,
        totalSupply: info.totalSupply,
        hasCode: info.hasCode ?? undefined,
      },
      // Ver la nota del guardado del ajuste: la wallet custodiada que Tessera
      // genera no puede ser la que despliega un Lock, asi que no sirve para
      // juzgar de quien es.
      expectedOwners: [],
    });

    if (verdict.status === 'not-a-contract') {
      throw errors.validation({
        lockAddress: [
          'Esa direccion es una wallet, no un contrato. El Lock es el contrato que despliega Unlock: copialo desde la ficha de tu Lock en app.unlock-protocol.com.',
        ],
      });
    }
    if (verdict.status === 'not-a-lock') {
      throw errors.validation({
        lockAddress: [
          'Esa direccion es un contrato, pero no responde como un Lock de Unlock. Revisa que sea el Lock y no otro contrato.',
        ],
      });
    }
    // 'foreign-owner' no bloquea: se puede desplegar desde una wallet
    // personal y cobrar ahi a proposito.
  }

  function assertGateConfigured(next: {
    visibility?: string | null;
    lockAddress?: string | null;
    lockChainId?: number | null;
    accessMode?: string | null;
  }) {
    // Una suscripción sin Lock no tendría llave que revalidar, así que el
    // curso quedaría cerrado para siempre. La base lo impide con un CHECK;
    // aquí se dice con un mensaje que explica qué corregir.
    if (next.accessMode === 'subscription' && next.visibility !== 'token_gated') {
      throw errors.validation({
        accessMode: ['Sólo un curso con membresía puede cobrarse por suscripción.'],
      });
    }

    if (next.visibility !== 'token_gated') return;

    if (!next.lockAddress || !next.lockChainId) {
      throw errors.validation({
        lockAddress: ['Un curso con membresía necesita la dirección del Lock y su red.'],
      });
    }
    if (!isSupportedUnlockChain(next.lockChainId)) {
      throw errors.validation({
        lockChainId: [
          `Unlock no está desplegado en esa red. Soportadas: ${supportedUnlockChainIds().join(', ')}`,
        ],
      });
    }
  }

  /** Genera un código de canje legible (sin chars confundibles 0/O/1/I). */
  function generateAccessCode(len = 10) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    const buf = randomBytes(len);
    for (let i = 0; i < len; i++) out += alphabet[buf[i]! % alphabet.length];
    return out;
  }

  function visibilityNeedsCode(v: string) {
    return v === 'private_code' || v === 'hybrid';
  }

  app.get(
    '/v1/me/courses',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description:
          'Lista cursos visibles para el caller. Los docentes sólo ven los que tienen asignados.',
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const role = req.auth!.role;
      const userId = req.auth!.userId;

      const baseSelect = {
        id: schema.courses.id,
        title: schema.courses.title,
        slug: schema.courses.slug,
        description: schema.courses.description,
        status: schema.courses.status,
        visibility: schema.courses.visibility,
        accessCode: schema.courses.accessCode,
        priceCents: schema.courses.priceCents,
        currency: schema.courses.currency,
        passingScore: schema.courses.passingScore,
        durationHours: schema.courses.durationHours,
        autoIssueEnabled: schema.courses.autoIssueEnabled,
        createdAt: schema.courses.createdAt,
      };

      async function withEnrollmentCounts<T extends { id: string }>(rows: T[]) {
        if (rows.length === 0) return rows.map((row) => ({ ...row, enrollments: 0 }));
        const counts = await db
          .select({ courseId: schema.enrollments.courseId, total: count() })
          .from(schema.enrollments)
          .where(
            inArray(
              schema.enrollments.courseId,
              rows.map((row) => row.id),
            ),
          )
          .groupBy(schema.enrollments.courseId);
        const byCourse = new Map(counts.map((row) => [row.courseId, Number(row.total)]));
        return rows.map((row) => ({ ...row, enrollments: byCourse.get(row.id) ?? 0 }));
      }

      if (role === 'teacher') {
        // Sólo los cursos donde está asignado. Los borradores también, para que pueda prepararlos.
        const rows = await db
          .select(baseSelect)
          .from(schema.courses)
          .innerJoin(schema.courseTeachers, eq(schema.courseTeachers.courseId, schema.courses.id))
          .where(
            and(
              eq(schema.courses.institutionId, institutionId),
              eq(schema.courseTeachers.userId, userId),
            ),
          )
          .orderBy(desc(schema.courses.createdAt));
        return { data: await withEnrollmentCounts(rows) };
      }

      const rows = await db
        .select(baseSelect)
        .from(schema.courses)
        .where(eq(schema.courses.institutionId, institutionId))
        .orderBy(desc(schema.courses.createdAt));
      return { data: await withEnrollmentCounts(rows) };
    },
  );

  /**
   * Reintenta la replica en una red espejo. El certificado principal ya existe,
   * asi que esto solo vuelve a intentar una copia: nunca altera el original.
   */
  app.post(
    '/v1/me/certificates/:id/mirrors/:chainId/retry',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id, chainId } = req.params as { id: string; chainId: string };
      const db = getDb();

      const cert = await db.query.certificates.findFirst({
        where: and(
          eq(schema.certificates.id, id),
          eq(schema.certificates.institutionId, institutionId),
        ),
      });
      if (!cert) throw errors.notFound('Certificado no encontrado');
      if (cert.status !== 'issued' || !cert.tokenUri || !cert.studentWallet) {
        throw errors.validation({
          certificate: ['Solo se puede replicar un certificado ya emitido'],
        });
      }

      const institution = await db.query.institutions.findFirst({
        where: eq(schema.institutions.id, institutionId),
      });
      if (!institution?.walletAddress) {
        throw errors.validation({ institution: ['La institucion no tiene wallet on-chain'] });
      }

      const result = await mirrorCertificate({
        certificateId: cert.id,
        chainId: Number.parseInt(chainId, 10),
        recipient: cert.studentWallet as `0x${string}`,
        institution: institution.walletAddress as `0x${string}`,
        tokenUri: cert.tokenUri,
      });

      return {
        chainId: result.chainId,
        status: result.status,
        tokenId: result.tokenId?.toString() ?? null,
        error: result.error ?? null,
      };
    },
  );

  app.post(
    '/v1/me/courses',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: courseCreateSchema },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const body = courseCreateSchema.parse(req.body);
      const db = getDb();
      const existing = await db.query.courses.findFirst({
        where: and(
          eq(schema.courses.institutionId, institutionId),
          eq(schema.courses.slug, body.slug),
        ),
      });
      if (existing) {
        throw errors.conflict('Ya tienes un curso con este slug');
      }
      if (body.templateId) {
        const template = await db.query.certificateTemplates.findFirst({
          where: and(
            eq(schema.certificateTemplates.id, body.templateId),
            eq(schema.certificateTemplates.institutionId, institutionId),
          ),
        });
        if (!template) throw errors.notFound('Plantilla no encontrada');
      }
      assertGateConfigured({
        visibility: body.visibility,
        lockAddress: body.lockAddress,
        lockChainId: body.lockChainId,
        accessMode: body.accessMode,
      });
      // Y contra la cadena: la direccion que se hereda del ajuste de la
      // institucion --o la que se pega a mano aqui-- entraba sin comprobar, y
      // una wallet puesta donde va el Lock dejaba el curso imposible de
      // matricular sin aviso.
      await assertCourseLockIsUsable({
        visibility: body.visibility,
        lockAddress: body.lockAddress,
        lockChainId: body.lockChainId,
      });

      const [row] = await db
        .insert(schema.courses)
        .values({
          institutionId,
          title: body.title,
          slug: body.slug,
          description: body.description,
          priceCents: body.priceCents,
          currency: body.currency,
          passingScore: body.passingScore,
          durationHours: body.durationHours?.toString(),
          autoIssueEnabled: body.autoIssueEnabled,
          templateId: body.templateId ?? null,
          status: body.status,
          visibility: body.visibility,
          accessCode: visibilityNeedsCode(body.visibility) ? generateAccessCode() : null,
          // El Lock sólo se guarda si el curso es token-gated: dejarlo puesto
          // en otros modos confundiría al panel y al catálogo.
          lockAddress: body.visibility === 'token_gated' ? (body.lockAddress ?? null) : null,
          lockChainId: body.visibility === 'token_gated' ? (body.lockChainId ?? null) : null,
          // Igual que el Lock: fuera de token_gated vuelve a pago único, para
          // que un cambio de visibilidad no deje un modo que ya no aplica.
          accessMode: body.visibility === 'token_gated' ? body.accessMode : 'perpetual',
          previewModuleCount: body.previewModuleCount,
        })
        .returning();
      reply.status(201);
      return row;
    },
  );

  app.patch(
    '/v1/me/courses/:id',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: courseUpdateSchema },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      const body = courseUpdateSchema.parse(req.body);
      const db = getDb();

      // Validar slug único si cambió
      if (body.slug) {
        const collide = await db.query.courses.findFirst({
          where: and(
            eq(schema.courses.institutionId, institutionId),
            eq(schema.courses.slug, body.slug),
          ),
        });
        if (collide && collide.id !== id) {
          throw errors.conflict('Ya tienes un curso con este slug');
        }
      }

      if (body.templateId) {
        const template = await db.query.certificateTemplates.findFirst({
          where: and(
            eq(schema.certificateTemplates.id, body.templateId),
            eq(schema.certificateTemplates.institutionId, institutionId),
          ),
        });
        if (!template) throw errors.notFound('Plantilla no encontrada');
      }

      // La validación del gate se hace sobre el estado RESULTANTE, no sobre
      // el body: pasar un curso a 'token_gated' sin tocar el Lock, o borrar
      // el Lock de uno que ya lo era, lo dejaría inaccesible.
      const current = await db.query.courses.findFirst({
        where: and(eq(schema.courses.id, id), eq(schema.courses.institutionId, institutionId)),
      });
      if (!current) throw errors.notFound('Curso no encontrado');

      const nextVisibility = body.visibility ?? current.visibility;
      const nextLockAddress =
        body.lockAddress !== undefined ? body.lockAddress : current.lockAddress;
      const nextLockChainId =
        body.lockChainId !== undefined ? body.lockChainId : current.lockChainId;
      const nextAccessMode = body.accessMode ?? current.accessMode;

      assertGateConfigured({
        visibility: nextVisibility,
        lockAddress: nextLockAddress,
        lockChainId: nextLockChainId,
        accessMode: nextAccessMode,
      });
      // Solo si el Lock cambia: revalidar contra la cadena en cada edicion
      // del curso anadiria una llamada RPC a cada guardado de titulo.
      if (body.lockAddress !== undefined && !sameAddress(nextLockAddress, current.lockAddress)) {
        await assertCourseLockIsUsable({
          visibility: nextVisibility,
          lockAddress: nextLockAddress,
          lockChainId: nextLockChainId,
        });
      }

      const [row] = await db
        .update(schema.courses)
        .set({
          ...body,
          durationHours: body.durationHours?.toString(),
          // Al salir de 'token_gated' el Lock deja de aplicar, así que se
          // limpia: conservarlo sugeriría una membresía que ya no decide nada.
          lockAddress: nextVisibility === 'token_gated' ? nextLockAddress : null,
          lockChainId: nextVisibility === 'token_gated' ? nextLockChainId : null,
          // Fuera de 'token_gated' no hay llave que revalidar, así que el modo
          // vuelve a pago único: dejar 'subscription' cerraría el curso para
          // siempre, sin membresía que pudiera reabrirlo.
          accessMode: nextVisibility === 'token_gated' ? nextAccessMode : 'perpetual',
          updatedAt: new Date(),
        })
        .where(and(eq(schema.courses.id, id), eq(schema.courses.institutionId, institutionId)))
        .returning();
      if (!row) throw errors.notFound('Curso no encontrado');

      // Si la nueva visibility requiere código y aún no hay, generamos uno;
      // si pasamos a un modo público sin código, lo limpiamos.
      if (body.visibility) {
        if (visibilityNeedsCode(body.visibility) && !row.accessCode) {
          const [updated] = await db
            .update(schema.courses)
            .set({ accessCode: generateAccessCode(), updatedAt: new Date() })
            .where(eq(schema.courses.id, id))
            .returning();
          return updated ?? row;
        }
        if (!visibilityNeedsCode(body.visibility) && row.accessCode) {
          const [updated] = await db
            .update(schema.courses)
            .set({ accessCode: null, updatedAt: new Date() })
            .where(eq(schema.courses.id, id))
            .returning();
          return updated ?? row;
        }
      }
      return row;
    },
  );

  app.post(
    '/v1/me/courses/:id/access-code/regenerate',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Regenera el código de canje del curso (sólo para visibility con código).',
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      const db = getDb();
      const course = await assertCourseOwned(id, institutionId);
      if (!visibilityNeedsCode(course.visibility)) {
        throw errors.conflict('Este curso no usa código de canje');
      }
      const [row] = await db
        .update(schema.courses)
        .set({ accessCode: generateAccessCode(), updatedAt: new Date() })
        .where(eq(schema.courses.id, id))
        .returning();
      return { accessCode: row?.accessCode ?? null };
    },
  );

  // ─── Detalle de curso ─────────────────────────────────────────────────────
  app.get(
    '/v1/me/courses/:id',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Detalle de curso con módulos, docentes y métricas.',
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      const db = getDb();

      const course = await assertCourseAccessible(
        id,
        institutionId,
        req.auth!.role,
        req.auth!.userId,
      );

      const [modulesList, teachersList, enrollmentAgg, certCount] = await Promise.all([
        db
          .select()
          .from(schema.modules)
          .where(eq(schema.modules.courseId, id))
          .orderBy(schema.modules.orderIndex),
        db
          .select({
            id: schema.courseTeachers.id,
            userId: schema.users.id,
            email: schema.users.email,
            name: schema.users.name,
            avatarUrl: schema.users.avatarUrl,
            assignmentRole: schema.courseTeachers.assignmentRole,
            assignedAt: schema.courseTeachers.assignedAt,
          })
          .from(schema.courseTeachers)
          .innerJoin(schema.users, eq(schema.users.id, schema.courseTeachers.userId))
          .where(eq(schema.courseTeachers.courseId, id))
          .orderBy(desc(schema.courseTeachers.assignedAt)),
        db
          .select({
            total: sql<number>`count(*)::int`,
            completed: sql<number>`count(*) filter (where ${schema.enrollments.completedAt} is not null)::int`,
            inProgress: sql<number>`count(*) filter (where ${schema.enrollments.startedAt} is not null and ${schema.enrollments.completedAt} is null)::int`,
            avgScore: sql<number | null>`avg(${schema.enrollments.finalScore})::float`,
          })
          .from(schema.enrollments)
          .where(eq(schema.enrollments.courseId, id)),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.certificates)
          .where(
            and(
              eq(schema.certificates.courseId, id),
              eq(schema.certificates.institutionId, course.institutionId),
            ),
          ),
      ]);

      return {
        course: {
          ...course,
          durationHours: course.durationHours,
        },
        modules: modulesList,
        teachers: teachersList,
        metrics: {
          enrollments: enrollmentAgg[0]?.total ?? 0,
          completed: enrollmentAgg[0]?.completed ?? 0,
          inProgress: enrollmentAgg[0]?.inProgress ?? 0,
          avgScore: enrollmentAgg[0]?.avgScore ?? null,
          certificatesIssued: certCount[0]?.n ?? 0,
        },
      };
    },
  );

  // ─── Cancelar / archivar curso ────────────────────────────────────────────
  app.post(
    '/v1/me/courses/:id/archive',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Archiva un curso. Sigue siendo visible pero no acepta nuevas inscripciones.',
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      const db = getDb();
      const [row] = await db
        .update(schema.courses)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(and(eq(schema.courses.id, id), eq(schema.courses.institutionId, institutionId)))
        .returning();
      if (!row) throw errors.notFound('Curso no encontrado');
      return row;
    },
  );

  // ─── Eliminar curso ───────────────────────────────────────────────────────
  // Sólo se permite si NO hay inscritos ni certificados emitidos. Para "cerrar"
  // un curso con historial usar el endpoint /archive.
  app.delete(
    '/v1/me/courses/:id',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Elimina un curso si no tiene inscritos ni certificados.',
      },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      const db = getDb();

      const course = await db.query.courses.findFirst({
        where: and(eq(schema.courses.id, id), eq(schema.courses.institutionId, institutionId)),
      });
      if (!course) throw errors.notFound('Curso no encontrado');

      const [enrolls] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.enrollments)
        .where(eq(schema.enrollments.courseId, id));
      const [certs] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.certificates)
        .where(eq(schema.certificates.courseId, id));

      if ((enrolls?.n ?? 0) > 0) {
        throw errors.conflict(
          'No puedes eliminar un curso con estudiantes inscritos. Archívalo en su lugar.',
        );
      }
      if ((certs?.n ?? 0) > 0) {
        throw errors.conflict(
          'No puedes eliminar un curso con certificados emitidos. Archívalo en su lugar.',
        );
      }

      await db.delete(schema.courses).where(eq(schema.courses.id, id));
      reply.status(204);
      return null;
    },
  );

  // ─── Módulos ──────────────────────────────────────────────────────────────
  const moduleCreateSchema = z.object({
    title: z.string().min(2).max(200),
    description: z.string().max(2000).optional(),
    contentType: z.enum(['video', 'article', 'quiz', 'assignment', 'live']).default('article'),
    content: z.record(z.unknown()).optional(),
    weight: z.number().int().min(0).max(100).default(0),
    isRequired: z.boolean().default(true),
    /**
     * Lock propio del modulo, para material premium dentro de un curso
     * abierto. Opcional: sin el, el modulo hereda el acceso del curso.
     * Aceptan null explicito para poder quitarlo.
     */
    lockAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, 'Lock invalido')
      .nullable()
      .optional(),
    lockChainId: z.number().int().positive().nullable().optional(),
  });
  const moduleUpdateSchema = moduleCreateSchema.partial();

  /**
   * Un Lock incompleto dejaria el modulo cerrado sin forma de abrirlo: no se
   * podria consultar la llave ni construir el checkout. La base lo impide con
   * un CHECK; aqui se devuelve un error claro en vez de dejar que reviente.
   */
  function assertModuleGate(next: { lockAddress?: string | null; lockChainId?: number | null }) {
    const hasAddress = Boolean(next.lockAddress);
    const hasChain = Boolean(next.lockChainId);
    if (hasAddress !== hasChain) {
      throw errors.validation({
        lockAddress: ['La direccion del Lock y su red deben configurarse juntas.'],
      });
    }
    if (next.lockChainId && !isSupportedUnlockChain(next.lockChainId)) {
      throw errors.validation({
        lockChainId: [
          `Unlock no esta desplegado en esa red. Soportadas: ${supportedUnlockChainIds().join(', ')}`,
        ],
      });
    }
  }

  async function assertCourseOwned(courseId: string, institutionId: string) {
    const db = getDb();
    const c = await db.query.courses.findFirst({
      where: and(eq(schema.courses.id, courseId), eq(schema.courses.institutionId, institutionId)),
    });
    if (!c) throw errors.notFound('Curso no encontrado');
    return c;
  }

  /**
   * Comprueba que el caller puede acceder al curso:
   *  - institution_admin → cualquier curso de su institución.
   *  - teacher → sólo cursos donde está asignado en course_teachers
   *    (incluye borradores que se le asignaron).
   * Devuelve el curso si está autorizado, lanza notFound si no.
   */
  async function assertCourseAccessible(
    courseId: string,
    institutionId: string,
    role: string,
    userId: string,
  ) {
    if (role === 'teacher') {
      const db = getDb();
      const assignment = await db.query.courseTeachers.findFirst({
        where: and(
          eq(schema.courseTeachers.courseId, courseId),
          eq(schema.courseTeachers.userId, userId),
        ),
      });
      if (!assignment) throw errors.notFound('Curso no encontrado');
      const course = await db.query.courses.findFirst({
        where: eq(schema.courses.id, courseId),
      });
      if (!course) throw errors.notFound('Curso no encontrado');
      await assertInstitutionActive(course.institutionId);
      return course;
    }
    const c = await assertCourseOwned(courseId, institutionId);
    if (role === 'institution_admin') return c;
    throw errors.forbidden('Sin acceso al curso');
  }

  app.get(
    '/v1/me/courses/:id/modules',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      await assertCourseAccessible(id, institutionId, req.auth!.role, req.auth!.userId);
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.modules)
        .where(eq(schema.modules.courseId, id))
        .orderBy(schema.modules.orderIndex);
      return { data: rows };
    },
  );

  app.post(
    '/v1/me/courses/:id/modules',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: moduleCreateSchema },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      await assertCourseAccessible(id, institutionId, req.auth!.role, req.auth!.userId);
      const body = moduleCreateSchema.parse(req.body);
      assertModuleGate(body);
      const db = getDb();

      const [last] = await db
        .select({ n: sql<number>`coalesce(max(${schema.modules.orderIndex}), -1)::int` })
        .from(schema.modules)
        .where(eq(schema.modules.courseId, id));
      const nextOrder = (last?.n ?? -1) + 1;

      const [row] = await db
        .insert(schema.modules)
        .values({
          courseId: id,
          title: body.title,
          description: body.description,
          contentType: body.contentType,
          content: body.content,
          weight: body.weight,
          isRequired: body.isRequired,
          lockAddress: body.lockAddress ?? null,
          lockChainId: body.lockChainId ?? null,
          orderIndex: nextOrder,
        })
        .returning();

      // Crear filas de progreso para inscritos existentes
      const existingEnrollments = await db
        .select({ id: schema.enrollments.id })
        .from(schema.enrollments)
        .where(eq(schema.enrollments.courseId, id));
      if (existingEnrollments.length > 0) {
        await db.insert(schema.moduleProgress).values(
          existingEnrollments.map((e) => ({
            enrollmentId: e.id,
            moduleId: row!.id,
          })),
        );
      }

      reply.status(201);
      return row;
    },
  );

  app.patch(
    '/v1/me/courses/:id/modules/:moduleId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: moduleUpdateSchema },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id, moduleId } = req.params as { id: string; moduleId: string };
      await assertCourseAccessible(id, institutionId, req.auth!.role, req.auth!.userId);
      const body = moduleUpdateSchema.parse(req.body);
      const db = getDb();

      // Se valida el estado RESULTANTE: mandar solo la direccion, o solo la
      // red, dejaria la pareja incompleta y el CHECK fallaria con un error
      // opaco.
      const current = await db.query.modules.findFirst({
        where: and(eq(schema.modules.id, moduleId), eq(schema.modules.courseId, id)),
      });
      if (!current) throw errors.notFound('Módulo no encontrado');
      assertModuleGate({
        lockAddress: body.lockAddress !== undefined ? body.lockAddress : current.lockAddress,
        lockChainId: body.lockChainId !== undefined ? body.lockChainId : current.lockChainId,
      });

      const [row] = await db
        .update(schema.modules)
        .set(body)
        .where(and(eq(schema.modules.id, moduleId), eq(schema.modules.courseId, id)))
        .returning();
      if (!row) throw errors.notFound('Módulo no encontrado');
      return row;
    },
  );

  app.delete(
    '/v1/me/courses/:id/modules/:moduleId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id, moduleId } = req.params as { id: string; moduleId: string };
      await assertCourseAccessible(id, institutionId, req.auth!.role, req.auth!.userId);
      const db = getDb();
      await db
        .delete(schema.modules)
        .where(and(eq(schema.modules.id, moduleId), eq(schema.modules.courseId, id)));
      reply.status(204);
      return null;
    },
  );

  app.post(
    '/v1/me/courses/:id/modules/reorder',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        body: z.object({ order: z.array(z.string().uuid()).min(1) }),
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      await assertCourseAccessible(id, institutionId, req.auth!.role, req.auth!.userId);
      const { order } = z.object({ order: z.array(z.string().uuid()) }).parse(req.body);
      const db = getDb();
      // Actualizamos en transacción ligera secuencial
      for (let i = 0; i < order.length; i++) {
        await db
          .update(schema.modules)
          .set({ orderIndex: i })
          .where(and(eq(schema.modules.id, order[i]!), eq(schema.modules.courseId, id)));
      }
      return { ok: true };
    },
  );

  // ─── Asignación de docentes a curso ───────────────────────────────────────
  app.get(
    '/v1/me/courses/:id/teachers',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      await assertCourseAccessible(id, institutionId, req.auth!.role, req.auth!.userId);
      const db = getDb();
      const rows = await db
        .select({
          id: schema.courseTeachers.id,
          userId: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
          walletAddress: schema.users.walletAddress,
          avatarUrl: schema.users.avatarUrl,
          assignmentRole: schema.courseTeachers.assignmentRole,
          assignedAt: schema.courseTeachers.assignedAt,
        })
        .from(schema.courseTeachers)
        .innerJoin(schema.users, eq(schema.users.id, schema.courseTeachers.userId))
        .where(eq(schema.courseTeachers.courseId, id))
        .orderBy(desc(schema.courseTeachers.assignedAt));
      return { data: rows };
    },
  );

  app.post(
    '/v1/me/courses/:id/teachers',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        body: z.object({
          userId: z.string().uuid(),
          assignmentRole: z.enum(['owner', 'assistant']).default('owner'),
        }),
      },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      await assertCourseAccessible(id, institutionId, req.auth!.role, req.auth!.userId);
      const body = z
        .object({
          userId: z.string().uuid(),
          assignmentRole: z.enum(['owner', 'assistant']).default('owner'),
        })
        .parse(req.body);
      const db = getDb();

      // El usuario debe pertenecer al equipo de la institución
      const member = await db.query.institutionMembers.findFirst({
        where: and(
          eq(schema.institutionMembers.institutionId, institutionId),
          eq(schema.institutionMembers.userId, body.userId),
        ),
      });
      if (!member) {
        throw errors.conflict(
          'La persona debe pertenecer al equipo de la institución antes de asignarse a un curso.',
        );
      }
      const exists = await db.query.courseTeachers.findFirst({
        where: and(
          eq(schema.courseTeachers.courseId, id),
          eq(schema.courseTeachers.userId, body.userId),
        ),
      });
      if (exists) throw errors.conflict('Esa persona ya está asignada a este curso');

      const [row] = await db
        .insert(schema.courseTeachers)
        .values({
          courseId: id,
          userId: body.userId,
          assignmentRole: body.assignmentRole,
        })
        .returning();
      reply.status(201);
      return row;
    },
  );

  app.delete(
    '/v1/me/courses/:id/teachers/:assignmentId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id, assignmentId } = req.params as { id: string; assignmentId: string };
      await assertCourseAccessible(id, institutionId, req.auth!.role, req.auth!.userId);
      const db = getDb();
      await db
        .delete(schema.courseTeachers)
        .where(
          and(eq(schema.courseTeachers.id, assignmentId), eq(schema.courseTeachers.courseId, id)),
        );
      reply.status(204);
      return null;
    },
  );

  // ─── Inscripciones del curso ──────────────────────────────────────────────
  app.get(
    '/v1/me/courses/:id/enrollments',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Lista de inscritos del curso con avance agregado.',
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      await assertCourseAccessible(id, institutionId, req.auth!.role, req.auth!.userId);
      const db = getDb();

      const totalModules = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.modules)
        .where(eq(schema.modules.courseId, id));
      const required = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.modules)
        .where(and(eq(schema.modules.courseId, id), eq(schema.modules.isRequired, true)));

      const rows = await db
        .select({
          id: schema.enrollments.id,
          userId: schema.users.id,
          email: schema.users.email,
          studentEmail: schema.enrollments.studentEmail,
          studentName: schema.enrollments.studentName,
          name: schema.users.name,
          walletAddress: schema.users.walletAddress,
          avatarUrl: schema.users.avatarUrl,
          source: schema.enrollments.enrollmentSource,
          startedAt: schema.enrollments.startedAt,
          completedAt: schema.enrollments.completedAt,
          finalScore: schema.enrollments.finalScore,
          createdAt: schema.enrollments.createdAt,
          completedModules: sql<number>`(select count(*) from ${schema.moduleProgress} where ${schema.moduleProgress.enrollmentId} = ${schema.enrollments.id} and ${schema.moduleProgress.status} = 'completed')::int`,
          inProgressModules: sql<number>`(select count(*) from ${schema.moduleProgress} where ${schema.moduleProgress.enrollmentId} = ${schema.enrollments.id} and ${schema.moduleProgress.status} = 'in_progress')::int`,
        })
        .from(schema.enrollments)
        .innerJoin(schema.users, eq(schema.users.id, schema.enrollments.userId))
        .where(eq(schema.enrollments.courseId, id))
        .orderBy(desc(schema.enrollments.createdAt));

      return {
        totals: {
          totalModules: totalModules[0]?.n ?? 0,
          requiredModules: required[0]?.n ?? 0,
          enrollments: rows.length,
        },
        data: rows,
      };
    },
  );

  app.post(
    '/v1/me/courses/:id/enrollments',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Inscribe manualmente a un estudiante (por email). Lo crea si no existe.',
        body: z.object({
          email: z.string().email(),
          name: z.string().min(2).max(200).optional(),
        }),
      },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id } = req.params as { id: string };
      const course = await assertCourseAccessible(
        id,
        institutionId,
        req.auth!.role,
        req.auth!.userId,
      );
      const body = z
        .object({
          email: z.string().email().toLowerCase(),
          name: z.string().min(2).max(200).optional(),
        })
        .parse(req.body);
      const db = getDb();

      let user = await db.query.users.findFirst({
        where: eq(schema.users.email, body.email),
      });
      if (!user) {
        const tempPassword = randomBytes(16).toString('base64url');
        const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });
        const walletAddress = await provisionCustodialWallet();
        const [u] = await db
          .insert(schema.users)
          .values({
            email: body.email,
            name: body.name ?? body.email.split('@')[0],
            passwordHash,
            role: 'student',
            walletAddress,
            emailVerifiedAt: new Date(),
          })
          .returning();
        user = u!;
      } else if (user.role !== 'student') {
        throw errors.conflict('Ese correo pertenece a una cuenta que no es de estudiante');
      }

      const dup = await db.query.enrollments.findFirst({
        where: and(eq(schema.enrollments.courseId, id), eq(schema.enrollments.userId, user.id)),
      });
      if (dup) throw errors.conflict('Ese estudiante ya está inscrito en este curso');

      const [enrollment] = await db
        .insert(schema.enrollments)
        .values({
          courseId: id,
          userId: user.id,
          studentEmail: user.email,
          studentName: body.name ?? user.name ?? null,
          enrollmentSource: 'manual',
        })
        .returning();

      await db
        .insert(schema.institutionStudents)
        .values({
          institutionId: course.institutionId,
          userId: user.id,
        })
        .onConflictDoNothing();

      // Bootstrap de progreso por módulo
      const mods = await db
        .select({ id: schema.modules.id })
        .from(schema.modules)
        .where(eq(schema.modules.courseId, id));
      if (mods.length > 0) {
        await db
          .insert(schema.moduleProgress)
          .values(mods.map((m) => ({ enrollmentId: enrollment!.id, moduleId: m.id })));
      }

      reply.status(201);
      return enrollment;
    },
  );

  app.delete(
    '/v1/me/courses/:id/enrollments/:enrollmentId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Cancela una inscripción si todavía no está completada.',
      },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id, enrollmentId } = req.params as { id: string; enrollmentId: string };
      await assertCourseAccessible(id, institutionId, req.auth!.role, req.auth!.userId);
      const db = getDb();
      const enrollment = await db.query.enrollments.findFirst({
        where: and(eq(schema.enrollments.id, enrollmentId), eq(schema.enrollments.courseId, id)),
      });
      if (!enrollment) throw errors.notFound('Inscripción no encontrada');
      if (enrollment.completedAt) {
        throw errors.conflict('No puedes cancelar una inscripción ya completada');
      }
      await db.delete(schema.enrollments).where(eq(schema.enrollments.id, enrollmentId));
      reply.status(204);
      return null;
    },
  );

  // ─── Avance por módulo de una inscripción ─────────────────────────────────
  app.get(
    '/v1/me/courses/:id/enrollments/:enrollmentId/progress',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Avance módulo a módulo del estudiante (estilo timeline).',
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id, enrollmentId } = req.params as { id: string; enrollmentId: string };
      await assertCourseAccessible(id, institutionId, req.auth!.role, req.auth!.userId);
      const db = getDb();

      const enrollment = await db.query.enrollments.findFirst({
        where: and(eq(schema.enrollments.id, enrollmentId), eq(schema.enrollments.courseId, id)),
      });
      if (!enrollment) throw errors.notFound('Inscripción no encontrada');

      const rows = await db
        .select({
          moduleId: schema.modules.id,
          title: schema.modules.title,
          orderIndex: schema.modules.orderIndex,
          weight: schema.modules.weight,
          isRequired: schema.modules.isRequired,
          contentType: schema.modules.contentType,
          status: schema.moduleProgress.status,
          score: schema.moduleProgress.score,
          note: schema.moduleProgress.note,
          startedAt: schema.moduleProgress.startedAt,
          completedAt: schema.moduleProgress.completedAt,
          progressId: schema.moduleProgress.id,
          updatedAt: schema.moduleProgress.updatedAt,
        })
        .from(schema.modules)
        .leftJoin(
          schema.moduleProgress,
          and(
            eq(schema.moduleProgress.moduleId, schema.modules.id),
            eq(schema.moduleProgress.enrollmentId, enrollmentId),
          ),
        )
        .where(eq(schema.modules.courseId, id))
        .orderBy(schema.modules.orderIndex);

      const moduleIds = rows.map((row) => row.moduleId);
      const assessments = moduleIds.length
        ? await db
            .select({
              id: schema.assessments.id,
              moduleId: schema.assessments.moduleId,
              title: schema.assessments.title,
              type: schema.assessments.type,
            })
            .from(schema.assessments)
            .where(inArray(schema.assessments.moduleId, moduleIds))
            .orderBy(schema.assessments.orderIndex)
        : [];
      const assessmentIds = assessments.map((assessment) => assessment.id);
      const attempts = assessmentIds.length
        ? await db
            .select({
              id: schema.assessmentAttempts.id,
              assessmentId: schema.assessmentAttempts.assessmentId,
              attemptNumber: schema.assessmentAttempts.attemptNumber,
              status: schema.assessmentAttempts.status,
              answers: schema.assessmentAttempts.answers,
              score: schema.assessmentAttempts.score,
              startedAt: schema.assessmentAttempts.startedAt,
              submittedAt: schema.assessmentAttempts.submittedAt,
              gradedAt: schema.assessmentAttempts.gradedAt,
            })
            .from(schema.assessmentAttempts)
            .where(
              and(
                eq(schema.assessmentAttempts.enrollmentId, enrollmentId),
                inArray(schema.assessmentAttempts.assessmentId, assessmentIds),
              ),
            )
            .orderBy(desc(schema.assessmentAttempts.submittedAt))
        : [];

      return {
        enrollment,
        modules: rows.map((row) => ({
          ...row,
          assessments: assessments
            .filter((assessment) => assessment.moduleId === row.moduleId)
            .map((assessment) => ({
              ...assessment,
              attempts: attempts.filter((attempt) => attempt.assessmentId === assessment.id),
            })),
        })),
      };
    },
  );

  app.patch(
    '/v1/me/courses/:id/enrollments/:enrollmentId/progress/:moduleId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        body: z.object({
          status: z.enum(['not_started', 'in_progress', 'completed']),
          score: z.number().int().min(0).max(100).optional(),
          note: z.string().max(2000).optional(),
        }),
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { id, enrollmentId, moduleId } = req.params as {
        id: string;
        enrollmentId: string;
        moduleId: string;
      };
      await assertCourseAccessible(id, institutionId, req.auth!.role, req.auth!.userId);
      const body = z
        .object({
          status: z.enum(['not_started', 'in_progress', 'completed']),
          score: z.number().int().min(0).max(100).optional(),
          note: z.string().max(2000).optional(),
        })
        .parse(req.body);
      const db = getDb();

      const enrollment = await db.query.enrollments.findFirst({
        where: and(eq(schema.enrollments.id, enrollmentId), eq(schema.enrollments.courseId, id)),
      });
      if (!enrollment) throw errors.notFound('Inscripción no encontrada');
      const moduleRow = await db.query.modules.findFirst({
        where: and(eq(schema.modules.id, moduleId), eq(schema.modules.courseId, id)),
      });
      if (!moduleRow) throw errors.notFound('Módulo no encontrado');

      const now = new Date();
      const completedAt = body.status === 'completed' ? now : null;
      const startedAt = body.status === 'not_started' ? null : (enrollment.startedAt ?? now);

      // Upsert manual: intentamos update y si no existe insertamos.
      const [existing] = await db
        .select()
        .from(schema.moduleProgress)
        .where(
          and(
            eq(schema.moduleProgress.enrollmentId, enrollmentId),
            eq(schema.moduleProgress.moduleId, moduleId),
          ),
        );

      if (body.status === 'completed' && body.score == null && existing?.score == null) {
        throw errors.badRequest('Debes ingresar un score para completar el módulo.');
      }
      const nextScore =
        body.status === 'not_started'
          ? null
          : body.score !== undefined
            ? body.score
            : body.status === 'completed'
              ? (existing?.score ?? null)
              : null;

      let row;
      if (existing) {
        [row] = await db
          .update(schema.moduleProgress)
          .set({
            status: body.status,
            score: nextScore,
            note: body.note ?? null,
            startedAt: body.status === 'not_started' ? null : (existing.startedAt ?? now),
            completedAt,
            updatedBy: req.auth!.userId,
            updatedAt: now,
          })
          .where(eq(schema.moduleProgress.id, existing.id))
          .returning();
      } else {
        [row] = await db
          .insert(schema.moduleProgress)
          .values({
            enrollmentId,
            moduleId,
            status: body.status,
            score: nextScore,
            note: body.note ?? null,
            startedAt: body.status === 'not_started' ? null : now,
            completedAt,
            updatedBy: req.auth!.userId,
          })
          .returning();
      }

      // Recalcular estado global de la inscripción
      const totals = await db
        .select({
          required: sql<number>`count(*) filter (where ${schema.modules.isRequired} = true)::int`,
          completedRequired: sql<number>`count(*) filter (where ${schema.modules.isRequired} = true and ${schema.moduleProgress.status} = 'completed')::int`,
          weightedScore: sql<
            number | null
          >`(case when sum(${schema.modules.weight}) > 0 then sum(${schema.modules.weight} * coalesce(${schema.moduleProgress.score}, 0))::float / sum(${schema.modules.weight})::float else null end)`,
        })
        .from(schema.modules)
        .leftJoin(
          schema.moduleProgress,
          and(
            eq(schema.moduleProgress.moduleId, schema.modules.id),
            eq(schema.moduleProgress.enrollmentId, enrollmentId),
          ),
        )
        .where(eq(schema.modules.courseId, id));

      const t = totals[0];
      const allRequiredDone = t && t.required > 0 && t.completedRequired >= t.required;
      const finalScore =
        t?.weightedScore !== null && t?.weightedScore !== undefined
          ? Math.round(t.weightedScore as number)
          : (enrollment.finalScore ?? null);

      await db
        .update(schema.enrollments)
        .set({
          startedAt,
          completedAt: allRequiredDone ? (completedAt ?? now) : null,
          finalScore,
        })
        .where(eq(schema.enrollments.id, enrollmentId));

      if (allRequiredDone) {
        await autoIssueCourseCertificate({
          courseId: id,
          enrollmentId,
          issuedBy: req.auth!.userId,
        }).catch(() => null);
      }

      return { progress: row, enrollmentCompleted: Boolean(allRequiredDone), finalScore };
    },
  );

  // ─── Estudiantes ──────────────────────────────────────────────────────────
  app.get(
    '/v1/me/students',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Lista de estudiantes registrados o inscritos en la institucion.',
        querystring: paginationSchema,
      },
    },
    async (req) => {
      const q = paginationSchema.parse(req.query);
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const offset = (q.page - 1) * q.limit;
      const role = req.auth!.role;
      const accessibleCourses =
        role === 'teacher'
          ? await db
              .select({
                id: schema.courses.id,
                title: schema.courses.title,
              })
              .from(schema.courseTeachers)
              .innerJoin(schema.courses, eq(schema.courses.id, schema.courseTeachers.courseId))
              .where(eq(schema.courseTeachers.userId, req.auth!.userId))
          : await db
              .select({
                id: schema.courses.id,
                title: schema.courses.title,
              })
              .from(schema.courses)
              .where(eq(schema.courses.institutionId, institutionId));
      const accessibleCourseIds = accessibleCourses.map((course) => course.id);

      const [enrollmentRows, certificateRows] = await Promise.all([
        accessibleCourseIds.length
          ? db
              .select({
                userId: schema.users.id,
                email: schema.users.email,
                name: schema.users.name,
                wallet: schema.users.walletAddress,
                seenAt: schema.enrollments.createdAt,
                courseId: schema.courses.id,
                courseTitle: schema.courses.title,
              })
              .from(schema.enrollments)
              .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollments.courseId))
              .innerJoin(schema.users, eq(schema.users.id, schema.enrollments.userId))
              .where(inArray(schema.enrollments.courseId, accessibleCourseIds))
          : Promise.resolve([]),
        accessibleCourseIds.length === 0
          ? Promise.resolve([])
          : db
              .select({
                email: sql<string>`lower(${schema.certificates.studentEmail})`,
                name: sql<string | null>`max(${schema.certificates.studentName})`,
                wallet: sql<string | null>`max(${schema.certificates.studentWallet})`,
                totalIssued: sql<number>`count(*) filter (where ${schema.certificates.status} = 'issued')::int`,
                totalAll: sql<number>`count(*)::int`,
                firstSeen: sql<Date>`min(${schema.certificates.createdAt})`,
                lastSeen: sql<Date>`max(${schema.certificates.createdAt})`,
              })
              .from(schema.certificates)
              .where(
                and(
                  eq(schema.certificates.institutionId, institutionId),
                  inArray(schema.certificates.courseId, accessibleCourseIds),
                ),
              )
              .groupBy(sql`lower(${schema.certificates.studentEmail})`)
              .catch((err: unknown) => {
                req.log.warn(
                  { err, institutionId, role },
                  'No se pudo agregar certificados para la lista de estudiantes',
                );
                return [];
              }),
      ]);

      const byEmail = new Map<
        string,
        {
          userId: string | null;
          email: string;
          name: string | null;
          wallet: string | null;
          totalIssued: number;
          totalAll: number;
          enrollments: number;
          courses: Map<string, string>;
          firstSeen: Date;
          lastSeen: Date;
        }
      >();

      function toDate(value: Date | string | null | undefined): Date | null {
        if (!value) return null;
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      }

      function upsertStudent(input: {
        userId?: string | null;
        email: string | null;
        name?: string | null;
        wallet?: string | null;
        seenAt: Date | string | null;
        enrollments?: number;
        totalIssued?: number;
        totalAll?: number;
        courseId?: string | null;
        courseTitle?: string | null;
      }) {
        if (!input.email) return;
        const seenAt = toDate(input.seenAt);
        if (!seenAt) return;
        const key = input.email.toLowerCase();
        const existing = byEmail.get(key);
        if (!existing) {
          const courses = new Map<string, string>();
          if (input.courseId) courses.set(input.courseId, input.courseTitle ?? 'Curso');
          byEmail.set(key, {
            userId: input.userId ?? null,
            email: input.email,
            name: input.name ?? null,
            wallet: input.wallet ?? null,
            totalIssued: input.totalIssued ?? 0,
            totalAll: input.totalAll ?? 0,
            enrollments: input.enrollments ?? 0,
            courses,
            firstSeen: seenAt,
            lastSeen: seenAt,
          });
          return;
        }

        existing.userId ||= input.userId ?? null;
        existing.name ||= input.name ?? null;
        existing.wallet ||= input.wallet ?? null;
        existing.totalIssued += input.totalIssued ?? 0;
        existing.totalAll += input.totalAll ?? 0;
        existing.enrollments += input.enrollments ?? 0;
        if (input.courseId) existing.courses.set(input.courseId, input.courseTitle ?? 'Curso');
        if (seenAt < existing.firstSeen) existing.firstSeen = seenAt;
        if (seenAt > existing.lastSeen) existing.lastSeen = seenAt;
      }

      for (const row of enrollmentRows) {
        upsertStudent({ ...row, enrollments: 1 });
      }
      for (const row of certificateRows) {
        if (!row.email) continue;
        const existing = byEmail.get(row.email.toLowerCase());
        if (!existing) continue;
        upsertStudent({
          email: row.email,
          name: row.name,
          wallet: row.wallet,
          seenAt: row.lastSeen,
          totalIssued: Number(row.totalIssued ?? 0),
          totalAll: Number(row.totalAll ?? 0),
        });
      }

      const students = Array.from(byEmail.values()).sort(
        (a, b) => b.lastSeen.getTime() - a.lastSeen.getTime(),
      );
      const data = students.slice(offset, offset + q.limit).map((student) => ({
        userId: student.userId,
        email: student.email,
        name: student.name,
        wallet: student.wallet,
        totalIssued: student.totalIssued,
        totalAll: student.totalAll,
        enrollments: student.enrollments,
        courses: Array.from(student.courses.entries()).map(([id, title]) => ({ id, title })),
        firstSeen: student.firstSeen,
        lastSeen: student.lastSeen,
      }));

      return {
        page: q.page,
        limit: q.limit,
        total: students.length,
        data,
      };
    },
  );

  // ─── Equipo ───────────────────────────────────────────────────────────────
  app.get(
    '/v1/me/team',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'], description: 'Miembros del equipo de la institucion.' },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const data = await db
        .select({
          id: schema.institutionMembers.id,
          userId: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
          role: schema.users.role,
          memberRole: schema.institutionMembers.memberRole,
          createdAt: schema.institutionMembers.createdAt,
          avatarUrl: schema.users.avatarUrl,
          walletAddress: schema.users.walletAddress,
          profileStatus: schema.userProfiles.status,
          firstName: schema.userProfiles.firstName,
          lastName: schema.userProfiles.lastName,
          documentType: schema.userProfiles.documentType,
          documentNumber: schema.userProfiles.documentNumber,
          birthDate: schema.userProfiles.birthDate,
          phone: schema.userProfiles.phone,
          country: schema.userProfiles.country,
          city: schema.userProfiles.city,
          addressLine: schema.userProfiles.addressLine,
          profileCompletedAt: schema.userProfiles.profileCompletedAt,
          profileSubmittedAt: schema.userProfiles.profileSubmittedAt,
          profileApprovedAt: schema.userProfiles.approvedAt,
        })
        .from(schema.institutionMembers)
        .innerJoin(schema.users, eq(schema.users.id, schema.institutionMembers.userId))
        .leftJoin(schema.userProfiles, eq(schema.userProfiles.userId, schema.users.id))
        .where(eq(schema.institutionMembers.institutionId, institutionId))
        .orderBy(desc(schema.institutionMembers.createdAt));
      return { data };
    },
  );

  app.get(
    '/v1/me/team/invitations',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Historial de invitaciones enviadas al equipo académico.',
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(15).default(15),
        }),
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const query = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(15).default(15),
        })
        .parse(req.query);
      const offset = (query.page - 1) * query.limit;
      const db = getDb();
      const [totalRows, data] = await Promise.all([
        db
          .select({ total: count() })
          .from(schema.teamInvitations)
          .where(eq(schema.teamInvitations.institutionId, institutionId)),
        db
          .select({
            id: schema.teamInvitations.id,
            email: schema.teamInvitations.email,
            name: schema.teamInvitations.name,
            memberRole: schema.teamInvitations.memberRole,
            courseId: schema.teamInvitations.courseId,
            courseTitle: schema.courses.title,
            expiresAt: schema.teamInvitations.expiresAt,
            acceptedAt: schema.teamInvitations.acceptedAt,
            createdAt: schema.teamInvitations.createdAt,
            createdByEmail: schema.users.email,
            createdByName: schema.users.name,
          })
          .from(schema.teamInvitations)
          .leftJoin(schema.courses, eq(schema.courses.id, schema.teamInvitations.courseId))
          .leftJoin(schema.users, eq(schema.users.id, schema.teamInvitations.createdBy))
          .where(eq(schema.teamInvitations.institutionId, institutionId))
          .orderBy(desc(schema.teamInvitations.createdAt))
          .limit(query.limit)
          .offset(offset),
      ]);
      const total = Number(totalRows[0]?.total ?? 0);
      const totalPages = Math.max(1, Math.ceil(total / query.limit));
      return {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        data,
      };
    },
  );

  // ─── Invitar miembro al equipo ─────────────────────────────────────────────
  // Decisión arquitectónica:
  // Un usuario tiene UN role global (student/teacher/institution_admin/admin) +
  // membresías por institución (memberRole). Al invitar por email:
  //   - Si NO existe el user → se crea una invitación por email. La cuenta
  //     docente recién se crea cuando la persona acepta el link y define password.
  //   - Si existe con otro rol → se rechaza para evitar elevación de privilegios.
  //   - Si ya es 'teacher' o 'institution_admin' → acepta desde el link y se
  //     añade la membresía/asignación pendiente.
  const inviteMemberSchema = z.object({
    email: z.string().email().toLowerCase(),
    memberRole: z.enum(['admin', 'teacher', 'reviewer']).default('teacher'),
    courseId: z.string().uuid().optional(),
  });

  app.post(
    '/v1/me/team/invite',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        body: inviteMemberSchema,
        description: 'Invita un miembro al equipo de la institución.',
      },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const body = inviteMemberSchema.parse(req.body);
      const db = getDb();

      const user = await db.query.users.findFirst({
        where: eq(schema.users.email, body.email),
      });
      const institution = await db.query.institutions.findFirst({
        columns: { name: true },
        where: eq(schema.institutions.id, institutionId),
      });
      const roleLabel =
        body.memberRole === 'reviewer'
          ? 'Revisor'
          : body.memberRole === 'admin'
            ? 'Admin institucional'
            : 'Docente';
      const teamName = institution?.name ?? 'Tessera';

      if (user && user.role !== 'teacher' && user.role !== 'institution_admin') {
        throw errors.conflict(
          'Este email ya pertenece a una cuenta con otro rol y no puede añadirse por invitación.',
        );
      }

      let courseTitle: string | null = null;
      if (body.courseId) {
        const course = await assertCourseAccessible(
          body.courseId,
          institutionId,
          req.auth!.role,
          req.auth!.userId,
        );
        courseTitle = course.title;
      }

      const existingMembership = user
        ? await db.query.institutionMembers.findFirst({
            where: and(
              eq(schema.institutionMembers.institutionId, institutionId),
              eq(schema.institutionMembers.userId, user.id),
            ),
          })
        : null;
      if (existingMembership && !body.courseId) {
        throw errors.conflict('Esta persona ya pertenece al equipo');
      }

      if (user && body.courseId) {
        const existingCourseAssignment = await db.query.courseTeachers.findFirst({
          where: and(
            eq(schema.courseTeachers.courseId, body.courseId),
            eq(schema.courseTeachers.userId, user.id),
          ),
        });
        if (existingCourseAssignment) {
          throw errors.conflict('Esta persona ya está asignada a este curso');
        }
      }

      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [invitation] = await db
        .insert(schema.teamInvitations)
        .values({
          institutionId,
          courseId: body.courseId,
          email: body.email,
          name: null,
          memberRole: body.memberRole,
          tokenHash: hashToken(token),
          expiresAt,
          createdBy: req.auth!.userId,
        })
        .returning();

      const path = user
        ? `/login?role=teacher&invite=${encodeURIComponent(token)}`
        : `/register?role=teacher&invite=${encodeURIComponent(token)}`;
      const inviteUrl = `${env.AUTH_URL.replace(/\/$/, '')}${path}`;

      await sendEmail({
        to: body.email,
        subject: courseTitle
          ? `Invitación al curso ${courseTitle}`
          : `Invitación al equipo de ${teamName}`,
        text: [
          `Te invitaron a colaborar en el equipo académico de ${teamName}.`,
          ...(courseTitle ? [`Curso: ${courseTitle}.`] : []),
          `Rol: ${roleLabel}.`,
          '',
          `Abre este enlace para aceptar la invitación: ${inviteUrl}`,
          '',
          'El enlace expira en 7 días.',
        ].join('\n'),
        html: `
          <p>Te invitaron a colaborar en el equipo académico de <strong>${teamName}</strong>.</p>
          ${courseTitle ? `<p>Curso: <strong>${courseTitle}</strong>.</p>` : ''}
          <p>Rol: <strong>${roleLabel}</strong>.</p>
          <p><a href="${inviteUrl}">Aceptar invitación</a></p>
          <p>El enlace expira en 7 días.</p>
        `,
        tags: { type: 'team_invitation' },
      });

      reply.status(201);
      return {
        invitationId: invitation!.id,
        email: body.email,
        name: null,
        memberRole: invitation!.memberRole,
        courseId: invitation!.courseId,
        courseTitle,
        existingUser: Boolean(user),
        expiresAt: invitation!.expiresAt,
        createdAt: invitation!.createdAt,
        inviteUrl: env.NODE_ENV !== 'production' ? inviteUrl : null,
      };
    },
  );

  // ─── Cambiar role de miembro ──────────────────────────────────────────────
  const updateMemberSchema = z.object({
    memberRole: z.enum(['admin', 'teacher', 'reviewer']),
  });
  app.patch(
    '/v1/me/team/:memberId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: updateMemberSchema },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { memberId } = req.params as { memberId: string };
      const body = updateMemberSchema.parse(req.body);
      const db = getDb();

      const member = await db.query.institutionMembers.findFirst({
        where: and(
          eq(schema.institutionMembers.id, memberId),
          eq(schema.institutionMembers.institutionId, institutionId),
        ),
      });
      if (!member) throw errors.notFound('Miembro no encontrado');

      // No permitir auto-degradación si es el único admin
      if (member.userId === req.auth!.userId && body.memberRole !== 'admin') {
        const [admins] = await db
          .select({ n: count() })
          .from(schema.institutionMembers)
          .where(
            and(
              eq(schema.institutionMembers.institutionId, institutionId),
              eq(schema.institutionMembers.memberRole, 'admin'),
            ),
          );
        if ((admins?.n ?? 0) <= 1) {
          throw errors.conflict('Debe quedar al menos un admin en la institución');
        }
      }

      const [row] = await db
        .update(schema.institutionMembers)
        .set({ memberRole: body.memberRole })
        .where(eq(schema.institutionMembers.id, memberId))
        .returning();

      // Sincronizar role global si subimos a admin
      if (body.memberRole === 'admin') {
        await db
          .update(schema.users)
          .set({ role: 'institution_admin', updatedAt: new Date() })
          .where(eq(schema.users.id, member.userId));
      }

      return row;
    },
  );

  // ─── Quitar miembro ───────────────────────────────────────────────────────
  app.delete(
    '/v1/me/team/:memberId',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'] },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { memberId } = req.params as { memberId: string };
      const db = getDb();

      const member = await db.query.institutionMembers.findFirst({
        where: and(
          eq(schema.institutionMembers.id, memberId),
          eq(schema.institutionMembers.institutionId, institutionId),
        ),
      });
      if (!member) throw errors.notFound('Miembro no encontrado');

      if (member.userId === req.auth!.userId) {
        throw errors.conflict('No puedes quitarte a ti mismo del equipo');
      }
      if (member.memberRole === 'admin') {
        const [admins] = await db
          .select({ n: count() })
          .from(schema.institutionMembers)
          .where(
            and(
              eq(schema.institutionMembers.institutionId, institutionId),
              eq(schema.institutionMembers.memberRole, 'admin'),
            ),
          );
        if ((admins?.n ?? 0) <= 1) {
          throw errors.conflict('Debe quedar al menos un admin en la institución');
        }
      }

      await db.delete(schema.institutionMembers).where(eq(schema.institutionMembers.id, memberId));

      reply.status(204);
      return null;
    },
  );

  // ─── Solicitud de cambio de plan ──────────────────────────────────────────
  // Legacy plan changes remain manual until their subscription catalog is configured.
  const planChangeSchema = z.object({
    targetPlan: z.enum(['starter', 'pro', 'pro_extended']),
    note: z.string().max(2000).optional(),
  });
  app.post(
    '/v1/me/plan/request-change',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: planChangeSchema },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const body = planChangeSchema.parse(req.body);
      const db = getDb();

      const inst = await db.query.institutions.findFirst({
        where: eq(schema.institutions.id, institutionId),
      });
      if (!inst) throw errors.notFound('Institución');

      if (inst.plan === body.targetPlan) {
        throw errors.conflict('Ya estás en este plan');
      }

      // Logueamos la solicitud para que el equipo de Tessera la procese.
      req.log.info(
        {
          event: 'plan_change_request',
          institutionId,
          institutionName: inst.name,
          currentPlan: inst.plan,
          targetPlan: body.targetPlan,
          requestedBy: req.auth!.userId,
          note: body.note,
        },
        'Solicitud de cambio de plan',
      );

      const supportEmail = 'soporte@tessera.app';
      return {
        ok: true,
        mode: 'manual' as const,
        currentPlan: inst.plan,
        targetPlan: body.targetPlan,
        contactEmail: supportEmail,
        message:
          'Hemos recibido tu solicitud de cambio de plan. Te contactaremos para coordinar el alta.',
      };
    },
  );

  // ─── Badge collections ────────────────────────────────────────────────────
  const badgeCollectionCreateSchema = z.object({
    name: z.string().min(2).max(200),
    description: z.string().max(2000).optional(),
    imageUrl: z.string().url().optional(),
    maxSupply: z.number().int().positive().optional(),
  });

  app.get(
    '/v1/me/badge-collections',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Lista colecciones de badges (ERC-1155) de la institucion.',
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const rows = await db
        .select({
          id: schema.badgeCollections.id,
          name: schema.badgeCollections.name,
          description: schema.badgeCollections.description,
          imageUrl: schema.badgeCollections.imageUrl,
          maxSupply: schema.badgeCollections.maxSupply,
          onchainCollectionId: schema.badgeCollections.onchainCollectionId,
          createdAt: schema.badgeCollections.createdAt,
          minted: sql<number>`(select count(*)::int from ${schema.badges} where ${schema.badges.collectionId} = ${schema.badgeCollections.id})`,
        })
        .from(schema.badgeCollections)
        .where(eq(schema.badgeCollections.institutionId, institutionId))
        .orderBy(desc(schema.badgeCollections.createdAt));
      return {
        data: rows.map((r) => ({
          ...r,
          onchainCollectionId: r.onchainCollectionId?.toString() ?? null,
        })),
      };
    },
  );

  app.post(
    '/v1/me/badge-collections',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: badgeCollectionCreateSchema },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const body = badgeCollectionCreateSchema.parse(req.body);
      const db = getDb();
      const [row] = await db
        .insert(schema.badgeCollections)
        .values({
          institutionId,
          name: body.name,
          description: body.description,
          imageUrl: body.imageUrl,
          maxSupply: body.maxSupply,
        })
        .returning();
      reply.status(201);
      return row;
    },
  );

  // ─── Plantillas de certificado ────────────────────────────────────────────
  const templateBackgroundSchema = z.union([
    z.string().url(),
    z.string().regex(/^data:image\/(png|jpe?g|webp);base64,/),
  ]);
  const templateLayoutSchema = z.record(z.string(), z.unknown());
  const templateCreateSchema = z.object({
    name: z.string().min(2).max(200),
    backgroundUrl: templateBackgroundSchema.optional(),
    layout: templateLayoutSchema.optional(),
  });

  app.get(
    '/v1/me/templates',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Dashboard'], description: 'Plantillas de certificado disponibles.' },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const rows = await db
        .select({
          id: schema.certificateTemplates.id,
          name: schema.certificateTemplates.name,
          backgroundUrl: schema.certificateTemplates.backgroundUrl,
          layout: schema.certificateTemplates.layout,
          createdAt: schema.certificateTemplates.createdAt,
          usage: sql<number>`(select count(*)::int from ${schema.certificates} where ${schema.certificates.templateId} = ${schema.certificateTemplates.id})`,
        })
        .from(schema.certificateTemplates)
        .where(eq(schema.certificateTemplates.institutionId, institutionId))
        .orderBy(desc(schema.certificateTemplates.createdAt));
      return { data: rows };
    },
  );

  app.post(
    '/v1/me/templates',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Dashboard'], body: templateCreateSchema },
    },
    async (req, reply) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const body = templateCreateSchema.parse(req.body);
      const db = getDb();
      const [row] = await db
        .insert(schema.certificateTemplates)
        .values({
          institutionId,
          name: body.name,
          backgroundUrl: body.backgroundUrl,
          layout: body.layout,
        })
        .returning();
      reply.status(201);
      return row;
    },
  );

  app.put(
    '/v1/me/templates/:id',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        params: z.object({ id: z.string().uuid() }),
        body: templateCreateSchema.partial().refine((body) => Object.keys(body).length > 0, {
          message: 'No hay cambios para guardar',
        }),
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = templateCreateSchema.partial().parse(req.body);
      const db = getDb();
      const [row] = await db
        .update(schema.certificateTemplates)
        .set(body)
        .where(
          and(
            eq(schema.certificateTemplates.id, params.id),
            eq(schema.certificateTemplates.institutionId, institutionId),
          ),
        )
        .returning();
      if (!row) throw errors.notFound('Plantilla no encontrada');
      return row;
    },
  );

  app.delete(
    '/v1/me/templates/:id',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const db = getDb();
      const template = await db.query.certificateTemplates.findFirst({
        where: and(
          eq(schema.certificateTemplates.id, params.id),
          eq(schema.certificateTemplates.institutionId, institutionId),
        ),
      });
      if (!template) throw errors.notFound('Plantilla no encontrada');

      const [usage] = await db
        .select({ total: count() })
        .from(schema.certificates)
        .where(eq(schema.certificates.templateId, params.id));
      if ((usage?.total ?? 0) > 0) {
        throw errors.conflict(
          'No se puede eliminar una plantilla que ya fue usada para emitir certificados.',
        );
      }

      await db
        .update(schema.courses)
        .set({ templateId: null })
        .where(
          and(
            eq(schema.courses.institutionId, institutionId),
            eq(schema.courses.templateId, params.id),
          ),
        );
      const [deleted] = await db
        .delete(schema.certificateTemplates)
        .where(
          and(
            eq(schema.certificateTemplates.id, params.id),
            eq(schema.certificateTemplates.institutionId, institutionId),
          ),
        )
        .returning({ id: schema.certificateTemplates.id });

      if (!deleted) throw errors.notFound('Plantilla no encontrada');
      return { deleted: true, id: deleted.id };
    },
  );

  // ─── Analytics: KPIs reales por curso + serie temporal últimos 30 días ────
  app.get(
    '/v1/me/analytics/overview',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'KPIs de analytics agregados desde datos reales.',
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();

      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const startOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const previous30Start = new Date(last30.getTime() - 30 * 24 * 60 * 60 * 1000);
      const seriesStart = new Date(
        Date.UTC(last30.getUTCFullYear(), last30.getUTCMonth(), last30.getUTCDate()),
      );
      const seriesEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );

      const [
        issuedThisMonth,
        issuedPrevMonth,
        activeCourses,
        totalCourses,
        distinctStudentsLast30,
        distinctStudentsPrev30,
        completionTotals,
        coursePerf,
        issuedSeriesRows,
      ] = await Promise.all([
        db
          .select({ n: count() })
          .from(schema.certificates)
          .where(
            and(
              eq(schema.certificates.institutionId, institutionId),
              eq(schema.certificates.status, 'issued'),
              gte(schema.certificates.issuedAt, startOfMonth),
            ),
          ),
        db
          .select({ n: count() })
          .from(schema.certificates)
          .where(
            and(
              eq(schema.certificates.institutionId, institutionId),
              eq(schema.certificates.status, 'issued'),
              gte(schema.certificates.issuedAt, startOfPrevMonth),
              lt(schema.certificates.issuedAt, startOfMonth),
            ),
          ),
        db
          .select({ n: count() })
          .from(schema.courses)
          .where(
            and(
              eq(schema.courses.institutionId, institutionId),
              eq(schema.courses.status, 'published'),
            ),
          ),
        db
          .select({ n: count() })
          .from(schema.courses)
          .where(eq(schema.courses.institutionId, institutionId)),
        db
          .select({ n: sql<number>`count(distinct ${schema.enrollments.userId})::int` })
          .from(schema.enrollments)
          .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollments.courseId))
          .where(
            and(
              eq(schema.courses.institutionId, institutionId),
              or(
                gte(schema.enrollments.createdAt, last30),
                gte(schema.enrollments.startedAt, last30),
                gte(schema.enrollments.completedAt, last30),
              ),
            ),
          ),
        db
          .select({ n: sql<number>`count(distinct ${schema.enrollments.userId})::int` })
          .from(schema.enrollments)
          .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollments.courseId))
          .where(
            and(
              eq(schema.courses.institutionId, institutionId),
              or(
                and(
                  gte(schema.enrollments.createdAt, previous30Start),
                  lt(schema.enrollments.createdAt, last30),
                ),
                and(
                  gte(schema.enrollments.startedAt, previous30Start),
                  lt(schema.enrollments.startedAt, last30),
                ),
                and(
                  gte(schema.enrollments.completedAt, previous30Start),
                  lt(schema.enrollments.completedAt, last30),
                ),
              ),
            ),
          ),
        db
          .select({
            enrollments: count(),
            completions: sql<number>`count(*) filter (where ${schema.enrollments.completedAt} is not null)::int`,
          })
          .from(schema.enrollments)
          .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollments.courseId))
          .where(eq(schema.courses.institutionId, institutionId)),
        db
          .select({
            id: schema.courses.id,
            title: schema.courses.title,
            priceCents: schema.courses.priceCents,
            currency: schema.courses.currency,
            enrollments: sql<number>`count(${schema.enrollments.id})::int`,
            completions: sql<number>`(count(${schema.enrollments.id}) filter (where ${schema.enrollments.completedAt} is not null))::int`,
            revenueCents: sql<number>`(
              (count(${schema.enrollments.id}) filter (where ${schema.enrollments.paidAt} is not null))::int
              * coalesce(${schema.courses.priceCents}, 0)
            )`,
          })
          .from(schema.courses)
          .leftJoin(schema.enrollments, eq(schema.enrollments.courseId, schema.courses.id))
          .where(eq(schema.courses.institutionId, institutionId))
          .groupBy(
            schema.courses.id,
            schema.courses.title,
            schema.courses.priceCents,
            schema.courses.currency,
            schema.courses.createdAt,
          )
          .orderBy(desc(schema.courses.createdAt))
          .limit(20),
        db
          .select({ issuedAt: schema.certificates.issuedAt })
          .from(schema.certificates)
          .where(
            and(
              eq(schema.certificates.institutionId, institutionId),
              eq(schema.certificates.status, 'issued'),
              isNotNull(schema.certificates.issuedAt),
              gte(schema.certificates.issuedAt, seriesStart),
            ),
          ),
      ]);

      const issuedM = issuedThisMonth[0]?.n ?? 0;
      const issuedP = issuedPrevMonth[0]?.n ?? 0;
      const monthDelta =
        issuedP === 0 ? (issuedM > 0 ? 100 : 0) : Math.round(((issuedM - issuedP) / issuedP) * 100);

      const studentsM = distinctStudentsLast30[0]?.n ?? 0;
      const studentsP = distinctStudentsPrev30[0]?.n ?? 0;
      const studentsDelta =
        studentsP === 0
          ? studentsM > 0
            ? 100
            : 0
          : Math.round(((studentsM - studentsP) / studentsP) * 100);

      const courses = coursePerf.map((c) => ({
        id: c.id,
        title: c.title,
        currency: c.currency,
        priceCents: c.priceCents,
        enrollments: c.enrollments,
        completions: c.completions,
        completionRate: c.enrollments > 0 ? Math.round((c.completions / c.enrollments) * 100) : 0,
        revenueCents: c.revenueCents ?? 0,
      }));

      const totalEnrollments = completionTotals[0]?.enrollments ?? 0;
      const totalCompletions = completionTotals[0]?.completions ?? 0;
      const completionRateGlobal =
        totalEnrollments > 0 ? Math.round((totalCompletions / totalEnrollments) * 100) : 0;

      const issuedByDay = new Map<string, number>();
      for (const row of issuedSeriesRows) {
        if (!row.issuedAt) continue;
        const day = row.issuedAt.toISOString().slice(0, 10);
        issuedByDay.set(day, (issuedByDay.get(day) ?? 0) + 1);
      }

      const series: Array<{ day: string; issued: number }> = [];
      for (
        const cursor = new Date(seriesStart);
        cursor <= seriesEnd;
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      ) {
        const day = cursor.toISOString().slice(0, 10);
        series.push({ day, issued: issuedByDay.get(day) ?? 0 });
      }

      return {
        kpis: {
          issuedThisMonth: issuedM,
          issuedMonthDeltaPct: monthDelta,
          activeStudents30d: studentsM,
          activeStudentsDeltaPct: studentsDelta,
          activeCourses: activeCourses[0]?.n ?? 0,
          totalCourses: totalCourses[0]?.n ?? 0,
          completionRate: completionRateGlobal,
        },
        courses,
        series,
      };
    },
  );

  // ─── Revenue: ingresos reales y splits según plan ─────────────────────────
  app.get(
    '/v1/me/revenue/summary',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Resumen de ingresos calculado desde enrollments pagados.',
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const now = new Date();

      const inst = await db.query.institutions.findFirst({
        where: eq(schema.institutions.id, institutionId),
      });
      if (!inst) throw errors.notFound('Institucion');

      const activeSubscription = await db.query.subscriptionEntitlements.findFirst({
        columns: {
          planCode: true,
        },
        where: and(
          eq(schema.subscriptionEntitlements.institutionId, institutionId),
          eq(schema.subscriptionEntitlements.status, 'active'),
        ),
        orderBy: [desc(schema.subscriptionEntitlements.createdAt)],
      });

      const monetizationEnabled = Boolean(activeSubscription);
      const tesseraSharePct = monetizationEnabled ? 12 : 0;
      const processorFeePct = 5.5;
      const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

      const payoutRows = await db
        .select({
          payoutAt: schema.payouts.payoutAt,
          createdAt: schema.payouts.createdAt,
          grossCents: schema.payouts.grossCents,
          processorFeeCents: schema.payouts.paddleFeeCents,
          tesseraFeeCents: schema.payouts.tesseraCommissionCents,
          institutionPayoutCents: schema.payouts.institutionPayoutCents,
          currency: schema.payouts.currency,
        })
        .from(schema.payouts)
        .where(
          and(
            eq(schema.payouts.institutionId, institutionId),
            gte(schema.payouts.createdAt, sixMonthsAgo),
          ),
        )
        .orderBy(desc(schema.payouts.createdAt));

      const periodsMap = new Map<
        string,
        {
          month: string;
          currency: string;
          paidCount: number;
          grossCents: number;
          processorFeeCents: number;
          tesseraFeeCents: number;
          institutionPayoutCents: number;
        }
      >();

      if (payoutRows.length > 0) {
        for (const row of payoutRows) {
          const sourceDate = row.payoutAt ?? row.createdAt;
          const month = new Date(Date.UTC(sourceDate.getUTCFullYear(), sourceDate.getUTCMonth(), 1))
            .toISOString()
            .slice(0, 10);
          const key = `${month}:${row.currency}`;
          const current = periodsMap.get(key) ?? {
            month,
            currency: row.currency,
            paidCount: 0,
            grossCents: 0,
            processorFeeCents: 0,
            tesseraFeeCents: 0,
            institutionPayoutCents: 0,
          };
          current.paidCount += 1;
          current.grossCents += row.grossCents;
          current.processorFeeCents += row.processorFeeCents;
          current.tesseraFeeCents += row.tesseraFeeCents;
          current.institutionPayoutCents += row.institutionPayoutCents;
          periodsMap.set(key, current);
        }
      } else {
        const paidEnrollmentRows = await db
          .select({
            paidAt: schema.enrollments.paidAt,
            priceCents: schema.courses.priceCents,
            currency: schema.courses.currency,
          })
          .from(schema.enrollments)
          .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollments.courseId))
          .where(
            and(
              eq(schema.courses.institutionId, institutionId),
              isNotNull(schema.enrollments.paidAt),
              gte(schema.enrollments.paidAt, sixMonthsAgo),
            ),
          )
          .orderBy(desc(schema.enrollments.paidAt));

        for (const row of paidEnrollmentRows) {
          if (!row.paidAt) continue;
          const month = new Date(Date.UTC(row.paidAt.getUTCFullYear(), row.paidAt.getUTCMonth(), 1))
            .toISOString()
            .slice(0, 10);
          const key = `${month}:${row.currency}`;
          const grossCents = row.priceCents ?? 0;
          const processorFeeCents = Math.round((grossCents * processorFeePct) / 100);
          const netAfterProcessor = grossCents - processorFeeCents;
          const tesseraFeeCents = Math.round((netAfterProcessor * tesseraSharePct) / 100);
          const institutionPayoutCents = netAfterProcessor - tesseraFeeCents;
          const current = periodsMap.get(key) ?? {
            month,
            currency: row.currency,
            paidCount: 0,
            grossCents: 0,
            processorFeeCents: 0,
            tesseraFeeCents: 0,
            institutionPayoutCents: 0,
          };
          current.paidCount += 1;
          current.grossCents += grossCents;
          current.processorFeeCents += processorFeeCents;
          current.tesseraFeeCents += tesseraFeeCents;
          current.institutionPayoutCents += institutionPayoutCents;
          periodsMap.set(key, current);
        }
      }

      const periods = Array.from(periodsMap.values()).sort((a, b) =>
        b.month.localeCompare(a.month),
      );

      const current = periods[0];

      return {
        plan: inst.plan,
        activePlanCode: activeSubscription?.planCode ?? null,
        monetizationEnabled,
        splits: { processorFeePct, tesseraSharePct, institutionSharePct: 100 - tesseraSharePct },
        currency: current?.currency ?? 'USD',
        currentMonth: current
          ? {
              grossCents: current.grossCents,
              processorFeeCents: current.processorFeeCents,
              tesseraFeeCents: current.tesseraFeeCents,
              institutionPayoutCents: current.institutionPayoutCents,
              paidCount: current.paidCount,
            }
          : null,
        periods,
      };
    },
  );

  // ─── Creditos: saldo, ledger, bundles, checkout ───────────────────────────
  app.get(
    '/v1/me/credits',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Saldo de creditos, historial reciente y consumo del mes.',
      },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();

      const startOfMonth = new Date();
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);
      const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [
        balance,
        tscPerCertificate,
        ledgerRows,
        monthEmittedRow,
        last30EmittedRow,
        lastPurchaseRow,
      ] = await Promise.all([
        getCreditBalance(institutionId),
        getTscPerCertificate(),
        db
          .select({
            id: schema.creditLedger.id,
            delta: schema.creditLedger.delta,
            reason: schema.creditLedger.reason,
            referenceType: schema.creditLedger.referenceType,
            referenceId: schema.creditLedger.referenceId,
            bundleCode: schema.creditLedger.bundleCode,
            unitCostCents: schema.creditLedger.unitCostCents,
            currency: schema.creditLedger.currency,
            note: schema.creditLedger.note,
            createdAt: schema.creditLedger.createdAt,
          })
          .from(schema.creditLedger)
          .where(eq(schema.creditLedger.institutionId, institutionId))
          .orderBy(desc(schema.creditLedger.createdAt))
          .limit(30),
        db
          .select({ n: sql<number>`coalesce(sum(${schema.creditLedger.delta}) * -1, 0)::int` })
          .from(schema.creditLedger)
          .where(
            and(
              eq(schema.creditLedger.institutionId, institutionId),
              eq(schema.creditLedger.reason, 'emit'),
              gte(schema.creditLedger.createdAt, startOfMonth),
            ),
          ),
        db
          .select({ n: sql<number>`coalesce(sum(${schema.creditLedger.delta}) * -1, 0)::int` })
          .from(schema.creditLedger)
          .where(
            and(
              eq(schema.creditLedger.institutionId, institutionId),
              eq(schema.creditLedger.reason, 'emit'),
              gte(schema.creditLedger.createdAt, last30),
            ),
          ),
        db
          .select({
            createdAt: schema.creditLedger.createdAt,
            tsc: schema.creditLedger.delta,
            bundleCode: schema.creditLedger.bundleCode,
            unitCostCents: schema.creditLedger.unitCostCents,
            currency: schema.creditLedger.currency,
          })
          .from(schema.creditLedger)
          .where(
            and(
              eq(schema.creditLedger.institutionId, institutionId),
              eq(schema.creditLedger.reason, 'purchase'),
            ),
          )
          .orderBy(desc(schema.creditLedger.createdAt))
          .limit(1),
      ]);

      const monthEmitted = monthEmittedRow[0]?.n ?? 0;
      const last30Emitted = last30EmittedRow[0]?.n ?? 0;
      const lastPurchase = lastPurchaseRow[0] ?? null;

      // proyeccion de "dias restantes" basada en consumo de los ultimos 30 dias
      const dailyAvg = last30Emitted > 0 ? last30Emitted / 30 : 0;
      const daysRemaining = dailyAvg > 0 ? Math.floor(balance / dailyAvg) : null;
      const lowBalanceThreshold = tscPerCertificate * 10;

      return {
        balance,
        tscPerCertificate,
        lowBalance: balance > 0 && balance < lowBalanceThreshold,
        emittedThisMonth: monthEmitted,
        emittedLast30Days: last30Emitted,
        avgDailyConsumption: Number(dailyAvg.toFixed(2)),
        daysRemaining,
        lastPurchase,
        ledger: ledgerRows,
      };
    },
  );

  app.get(
    '/v1/me/credits/bundles',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description: 'Lista los bundles de creditos disponibles para compra.',
      },
    },
    async () => ({ bundles: await getTscPackages() }),
  );

  app.post(
    '/v1/me/credits/checkout',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: {
        tags: ['Dashboard'],
        description:
          'Inicia una sesión Stripe Checkout para un paquete de TSC del catálogo del servidor.',
        body: z.object({ bundleCode: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const { bundleCode } = z.object({ bundleCode: z.string().min(1) }).parse(req.body);
      const bundle = await findTscPackage(bundleCode);
      if (!bundle) throw errors.notFound('Paquete TSC');
      const configuredPriceId =
        stripePackagePriceByCode[bundle.code as keyof typeof stripePackagePriceByCode]?.();
      if (!configuredPriceId)
        throw errors.validation({ bundleCode: ['Paquete Stripe no configurado'] });
      const amountCents = applyBillingDiscount(bundle.priceCents, bundle.discountBps);
      const stripePrice = await resolveStripePrice(configuredPriceId);
      if (
        !stripePrice.active ||
        stripePrice.currency.toUpperCase() !== bundle.currency ||
        stripePrice.unit_amount !== amountCents ||
        stripePrice.recurring
      ) {
        throw errors.validation({ payment: ['El precio Stripe no coincide con este paquete TSC'] });
      }

      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const [localOrder] = await db
        .insert(schema.paymentOrders)
        .values({
          institutionId,
          provider: 'stripe',
          kind: 'package',
          catalogCode: bundle.code,
          snapshot: { ...bundle },
          amountCents,
          currency: bundle.currency,
        })
        .returning({ id: schema.paymentOrders.id });
      const checkout = await createStripeCheckoutSession({
        mode: 'payment',
        priceId: stripePrice.id,
        paymentOrderId: localOrder!.id,
        catalogCode: bundle.code,
        institutionId,
        successUrl: `${env.AUTH_URL}/institution/credits?stripe_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${env.AUTH_URL}/institution/credits?stripe_checkout=cancelled`,
      });
      if (!checkout.url) throw new Error('Stripe no devolvió URL de Checkout');
      await db
        .update(schema.paymentOrders)
        .set({ providerOrderId: checkout.id, status: 'checkout_pending', updatedAt: new Date() })
        .where(eq(schema.paymentOrders.id, localOrder!.id));
      return reply.status(200).send({
        mode: 'stripe',
        checkoutUrl: checkout.url,
        paymentOrderId: localOrder!.id,
        providerOrderId: checkout.id,
      });
    },
  );

  app.get(
    '/v1/me/subscriptions/catalog',
    { preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()] },
    async () => ({ plans: await getSubscriptionPlans() }),
  );

  app.post(
    '/v1/me/subscriptions/checkout',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { body: z.object({ planCode: z.string().min(1) }) },
    },
    async (req) => {
      const { planCode } = z.object({ planCode: z.string().min(1) }).parse(req.body);
      const plan = await findSubscriptionPlan(planCode);
      if (!plan) throw errors.notFound('Plan');
      const configuredPriceId =
        plan.code === 'enterprise'
          ? undefined
          : stripeSubscriptionPriceByCode[
              plan.code as keyof typeof stripeSubscriptionPriceByCode
            ]();
      if (!configuredPriceId)
        throw errors.validation({ planCode: ['Este plan requiere coordinación comercial'] });
      const amountCents = applyBillingDiscount(plan.monthlyPriceCents, plan.launchDiscountBps);
      const stripePrice = await resolveStripePrice(configuredPriceId);
      if (
        !stripePrice.active ||
        stripePrice.currency.toUpperCase() !== 'USD' ||
        stripePrice.unit_amount !== amountCents ||
        stripePrice.recurring?.interval !== 'month' ||
        stripePrice.recurring.interval_count !== 1
      ) {
        throw errors.validation({
          payment: ['El precio Stripe no coincide con el catálogo de Tessera'],
        });
      }
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const [localOrder] = await db
        .insert(schema.paymentOrders)
        .values({
          institutionId,
          provider: 'stripe',
          kind: 'subscription',
          catalogCode: plan.code,
          snapshot: { ...plan },
          amountCents,
          currency: 'USD',
        })
        .returning({ id: schema.paymentOrders.id });
      const checkout = await createStripeCheckoutSession({
        mode: 'subscription',
        priceId: stripePrice.id,
        paymentOrderId: localOrder!.id,
        catalogCode: plan.code,
        institutionId,
        successUrl: `${env.AUTH_URL}/institution/plan?stripe_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${env.AUTH_URL}/institution/plan?stripe_checkout=cancelled`,
      });
      if (!checkout.url) throw new Error('Stripe no devolvió URL de Checkout');
      await db
        .update(schema.paymentOrders)
        .set({ providerOrderId: checkout.id, status: 'checkout_pending', updatedAt: new Date() })
        .where(eq(schema.paymentOrders.id, localOrder!.id));
      return {
        checkoutUrl: checkout.url,
        paymentOrderId: localOrder!.id,
        providerOrderId: checkout.id,
      };
    },
  );

  app.get(
    '/v1/me/subscriptions',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const subscriptions = await db.query.subscriptionEntitlements.findMany({
        where: eq(schema.subscriptionEntitlements.institutionId, institutionId),
        orderBy: desc(schema.subscriptionEntitlements.createdAt),
      });
      return { subscriptions };
    },
  );

  app.post(
    '/v1/me/subscriptions/:subscriptionId/cancel',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { params: z.object({ subscriptionId: z.string().min(1).max(128) }) },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const { subscriptionId } = z
        .object({ subscriptionId: z.string().min(1).max(128) })
        .parse(req.params);
      const db = getDb();
      const entitlement = await db.query.subscriptionEntitlements.findFirst({
        where: and(
          eq(schema.subscriptionEntitlements.institutionId, institutionId),
          eq(schema.subscriptionEntitlements.provider, 'stripe'),
          eq(schema.subscriptionEntitlements.providerSubscriptionId, subscriptionId),
        ),
      });
      if (!entitlement) throw errors.notFound('Suscripción');
      if (entitlement.status === 'cancelled') return { cancelled: true, idempotent: true };
      await cancelStripeSubscription(subscriptionId);
      const result = await stopSubscriptionEntitlement({
        providerSubscriptionId: subscriptionId,
        status: 'cancelled',
      });
      if (!result.handled)
        throw new Error(`Entitlement disappeared after cancelling ${subscriptionId}`);
      return { cancelled: true, idempotent: result.idempotent };
    },
  );
}
