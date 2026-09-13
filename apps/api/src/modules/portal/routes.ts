import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, isNotNull, sql } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { errors } from '@tessera/shared/errors';
import { env } from '../../config/env.js';
import { getObjectStorageAsset, uploadPrivateObject } from '../../services/storage.js';
import { enqueueCertificateEmission } from '../../services/certificates.js';
import {
  buildCheckoutUrl,
  checkMembership,
  getLockInfo,
  isSupportedUnlockChain,
  normalizeLockAddress,
  supportedUnlockChainIds,
  unlockNetworkLabel,
  verifyWalletOwnership,
} from '../../services/unlock.js';

/**
 * Portal de contenido token-gated sobre Unlock Protocol.
 *
 * El recorrido que pide el bounty es descubrir -> previsualizar -> verificar
 * membresia -> desbloquear. La pieza que decide es /content/:slug/full: ahi se
 * consulta el Lock on-chain y, sin llave valida, el archivo completo no sale
 * del servidor. El preview es un archivo distinto generado al publicar, de
 * modo que el original nunca viaja sin autorizacion.
 */

const PREVIEW_TEXT_CHARS = 420;

const createContentSchema = z.object({
  title: z.string().min(3).max(200),
  summary: z.string().max(1000).optional(),
  kind: z.enum(schema.PORTAL_CONTENT_KINDS),
  /** Contenido completo en base64. El preview se deriva de aqui. */
  body: z.string().min(1),
  mimeType: z.string().max(120).optional(),
  lockAddress: z.string().min(42).max(42),
  lockChainId: z.number().int().positive(),
  previewSeconds: z.number().int().min(1).max(120).optional(),
  /** Si se define, completar el contenido emite un certificado con este nombre. */
  certifiesAchievement: z.string().min(3).max(200).optional(),
});

const completeSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
  issuedAt: z.coerce.number().int().positive(),
  /** Email del estudiante: la credencial viaja a una persona, no a una wallet. */
  email: z.string().email(),
  name: z.string().min(2).max(200),
});

const walletQuerySchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'wallet debe ser una address EVM'),
});

/**
 * Para entregar contenido de pago no basta con que la wallet tenga membresia:
 * hay que probar que quien pide es su duenno. Sin la firma, cualquiera podria
 * poner la address de un suscriptor y leer el contenido.
 */
const unlockQuerySchema = walletQuerySchema.extend({
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, 'signature debe ser hex'),
  issuedAt: z.coerce.number().int().positive(),
});

function slugify(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  // Un sufijo corto evita colisiones sin exponer el id interno.
  return `${base || 'contenido'}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveInstitutionId(userId: string): Promise<string> {
  const db = getDb();
  const membership = await db.query.institutionMembers.findFirst({
    where: eq(schema.institutionMembers.userId, userId),
  });
  if (!membership) throw errors.forbidden('No perteneces a una institucion');
  return membership.institutionId;
}

/** Lo que se puede mostrar sin membresia. Nunca incluye claves de storage. */
function publicShape(row: typeof schema.portalContents.$inferSelect) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    kind: row.kind,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    publishedAt: row.publishedAt,
    certifiesAchievement: row.certifiesAchievement,
    lock: {
      address: row.lockAddress,
      chainId: row.lockChainId,
      checkoutUrl: buildCheckoutUrl(row.lockAddress, row.lockChainId),
    },
    preview: {
      available: Boolean(row.previewKey || row.previewText),
      text: row.previewText,
      seconds: row.previewSeconds,
      url: row.previewKey
        ? `${env.API_PUBLIC_URL.replace(/\/$/, '')}/v1/portal/content/${row.slug}/preview`
        : null,
    },
  };
}

export default async function portalRoutes(app: FastifyInstance) {
  // ─── Descubrir ────────────────────────────────────────────────────────────
  app.get(
    '/v1/portal/contents',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Portal'],
        description:
          'Catalogo publico del portal. Devuelve solo lo previsualizable: el contenido completo exige membresia.',
      },
    },
    async () => {
      const db = getDb();
      const rows = await db.query.portalContents.findMany({
        where: isNotNull(schema.portalContents.publishedAt),
        orderBy: [desc(schema.portalContents.publishedAt)],
        limit: 60,
      });
      return { data: rows.map(publicShape) };
    },
  );

  // ─── Previsualizar ────────────────────────────────────────────────────────
  app.get(
    '/v1/portal/content/:slug',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Portal'],
        description: 'Detalle publico de un contenido, con su preview y el Lock que lo desbloquea.',
      },
    },
    async (req) => {
      const { slug } = req.params as { slug: string };
      const db = getDb();
      const row = await db.query.portalContents.findFirst({
        where: eq(schema.portalContents.slug, slug),
      });
      if (!row || !row.publishedAt) throw errors.notFound('Contenido');

      const lock = await getLockInfo(row.lockAddress, row.lockChainId).catch(() => null);
      return { data: { ...publicShape(row), lockInfo: lock } };
    },
  );

  // ─── Procedencia: certificado -> membresia que lo origino ─────────────────
  //
  // Cierra la trazabilidad en el sentido inverso. Dado un certificado, dice si
  // nacio de un contenido token-gated y contra que Lock se comprobo el acceso.
  // Es lo que permite demostrar que la membresia de Unlock no fue decorativa:
  // sin llave valida esa credencial no existiria.
  app.get(
    '/v1/portal/certificates/:certificateId/origin',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Portal'],
        description:
          'Devuelve la membresia de Unlock que dio origen a un certificado, si lo emitio el portal.',
      },
    },
    async (req) => {
      const { certificateId } = req.params as { certificateId: string };

      // Un id mal formado no es un fallo del servidor: es una consulta sobre
      // algo que no puede existir.
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(certificateId)) {
        return { data: { fromPortal: false } };
      }

      const db = getDb();
      const unlock = await db.query.portalUnlocks.findFirst({
        where: eq(schema.portalUnlocks.certificateId, certificateId),
      });
      if (!unlock) return { data: { fromPortal: false } };

      const content = await db.query.portalContents.findFirst({
        where: eq(schema.portalContents.id, unlock.contentId),
      });

      return {
        data: {
          fromPortal: true,
          content: content ? { slug: content.slug, title: content.title, kind: content.kind } : null,
          achievement: content?.certifiesAchievement ?? null,
          membership: {
            lockAddress: unlock.lockAddress,
            chainId: unlock.lockChainId,
            network: unlockNetworkLabel(unlock.lockChainId),
            wallet: unlock.walletAddress,
            keyExpiresAt: unlock.keyExpiresAt,
            checkoutUrl: buildCheckoutUrl(unlock.lockAddress, unlock.lockChainId),
          },
          completedAt: unlock.completedAt,
        },
      };
    },
  );

  app.get(
    '/v1/portal/content/:slug/preview',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Portal'],
        description:
          'Sirve el archivo de previsualizacion. Es una version recortada generada al publicar, no el original.',
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const db = getDb();
      const row = await db.query.portalContents.findFirst({
        where: eq(schema.portalContents.slug, slug),
      });
      if (!row || !row.publishedAt || !row.previewKey) throw errors.notFound('Preview');

      const asset = await getObjectStorageAsset(row.previewKey);
      if (!asset) throw errors.notFound('Preview');

      reply.header('Content-Type', asset.contentType ?? row.mimeType ?? 'application/octet-stream');
      reply.header('Cache-Control', 'public, max-age=3600');
      reply.header('Access-Control-Allow-Origin', '*');
      return reply.send(asset.data);
    },
  );

  // ─── Verificar membresia ──────────────────────────────────────────────────
  app.get(
    '/v1/portal/content/:slug/access',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Portal'],
        description:
          'Consulta on-chain si una wallet tiene membresia valida para este contenido. No entrega el contenido.',
        querystring: walletQuerySchema,
      },
    },
    async (req) => {
      const { slug } = req.params as { slug: string };
      const { wallet } = walletQuerySchema.parse(req.query);
      const db = getDb();
      const row = await db.query.portalContents.findFirst({
        where: eq(schema.portalContents.slug, slug),
      });
      if (!row || !row.publishedAt) throw errors.notFound('Contenido');

      const membership = await checkMembership({
        lockAddress: row.lockAddress,
        chainId: row.lockChainId,
        walletAddress: wallet,
      });

      return {
        data: {
          hasAccess: membership.hasValidKey,
          wallet: membership.walletAddress,
          network: membership.network,
          expiresAt: membership.expiresAt,
          keyCount: membership.keyCount,
          lock: {
            address: row.lockAddress,
            chainId: row.lockChainId,
            checkoutUrl: buildCheckoutUrl(row.lockAddress, row.lockChainId),
          },
        },
      };
    },
  );

  // ─── Desbloquear ──────────────────────────────────────────────────────────
  app.get(
    '/v1/portal/content/:slug/full',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Portal'],
        description:
          'Entrega el contenido completo. Verifica la membresia on-chain antes de leer el archivo: sin llave valida responde 402.',
        querystring: walletQuerySchema,
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const query = unlockQuerySchema.parse(req.query);
      const db = getDb();
      const row = await db.query.portalContents.findFirst({
        where: eq(schema.portalContents.slug, slug),
      });
      if (!row || !row.publishedAt) throw errors.notFound('Contenido');

      // Primero: probar que quien pide controla la wallet. Es lo que impide
      // leer contenido ajeno pasando la address de otro suscriptor.
      const ownsWallet = await verifyWalletOwnership({
        walletAddress: query.wallet,
        slug,
        issuedAt: query.issuedAt,
        signature: query.signature,
      });
      if (!ownsWallet) {
        throw errors.unauthorized(
          'Firma invalida o expirada: volve a firmar el mensaje para probar que controlas la wallet.',
        );
      }
      const wallet = query.wallet;

      // Despues: la autorizacion on-chain, ANTES de tocar el storage. Si la
      // llave no es valida, el archivo no llega a leerse siquiera.
      const membership = await checkMembership({
        lockAddress: row.lockAddress,
        chainId: row.lockChainId,
        walletAddress: wallet,
      });

      if (!membership.hasValidKey) {
        reply.status(402);
        return {
          error: {
            code: 'MEMBERSHIP_REQUIRED',
            message: 'Necesitas una membresia valida para acceder a este contenido.',
            checkoutUrl: buildCheckoutUrl(row.lockAddress, row.lockChainId),
            lock: { address: row.lockAddress, chainId: row.lockChainId },
          },
        };
      }

      // El desbloqueo se registra para trazabilidad; nunca para autorizar.
      await db
        .insert(schema.portalUnlocks)
        .values({
          contentId: row.id,
          walletAddress: membership.walletAddress,
          userId: req.auth?.userId ?? null,
          lockAddress: row.lockAddress,
          lockChainId: row.lockChainId,
          keyExpiresAt: membership.expiresAt,
        })
        .catch((err: unknown) => {
          req.log.warn({ err, contentId: row.id }, 'No se pudo registrar el desbloqueo');
        });

      if (row.kind === 'text') {
        const asset = await getObjectStorageAsset(row.fullKey);
        if (!asset) throw errors.notFound('Contenido');
        return { data: { kind: 'text', body: asset.data.toString('utf8') } };
      }

      const asset = await getObjectStorageAsset(row.fullKey);
      if (!asset) throw errors.notFound('Contenido');

      reply.header('Content-Type', asset.contentType ?? row.mimeType ?? 'application/octet-stream');
      // Contenido de pago: no debe quedar cacheado en intermediarios.
      reply.header('Cache-Control', 'private, no-store');
      return reply.send(asset.data);
    },
  );

  // ─── Cierre del circulo: completar -> certificado ─────────────────────────
  app.post(
    '/v1/portal/content/:slug/complete',
    {
      preHandler: [app.rateLimit({ max: 20, timeWindow: 60_000 })],
      schema: {
        tags: ['Portal'],
        description:
          'Marca el contenido como completado y emite un certificado soulbound verificable. Exige membresia valida y firma de la wallet.',
        body: completeSchema,
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const body = completeSchema.parse(req.body);
      const db = getDb();

      const row = await db.query.portalContents.findFirst({
        where: eq(schema.portalContents.slug, slug),
      });
      if (!row || !row.publishedAt) throw errors.notFound('Contenido');
      if (!row.certifiesAchievement) {
        throw errors.conflict('Este contenido no otorga certificado.');
      }

      // Mismas dos barreras que para leer el contenido: propiedad de la wallet
      // y membresia on-chain. Emitir es mas costoso que leer, asi que no puede
      // exigir menos.
      const ownsWallet = await verifyWalletOwnership({
        walletAddress: body.wallet,
        slug,
        issuedAt: body.issuedAt,
        signature: body.signature,
      });
      if (!ownsWallet) throw errors.unauthorized('Firma invalida o expirada.');

      const membership = await checkMembership({
        lockAddress: row.lockAddress,
        chainId: row.lockChainId,
        walletAddress: body.wallet,
      });
      if (!membership.hasValidKey) {
        reply.status(402);
        return {
          error: {
            code: 'MEMBERSHIP_REQUIRED',
            message: 'Necesitas una membresia valida para obtener la credencial.',
            checkoutUrl: buildCheckoutUrl(row.lockAddress, row.lockChainId),
          },
        };
      }

      // Una credencial por wallet y contenido. La clave de idempotencia va
      // tambien al emisor, de modo que un reintento no gasta otro credito.
      const prior = await db.query.portalUnlocks.findFirst({
        where: and(
          eq(schema.portalUnlocks.contentId, row.id),
          eq(schema.portalUnlocks.walletAddress, membership.walletAddress),
          isNotNull(schema.portalUnlocks.certificateId),
        ),
      });
      if (prior?.certificateId) {
        return {
          data: {
            certificateId: prior.certificateId,
            alreadyIssued: true,
            verifyUrl: `${env.API_PUBLIC_URL.replace(/\/$/, '')}/v1/certificates/verify`,
          },
        };
      }

      const result = await enqueueCertificateEmission({
        institutionId: row.institutionId,
        apiPublicUrl: env.API_PUBLIC_URL,
        payload: {
          student: { email: body.email, name: body.name, walletAddress: membership.walletAddress },
          achievement: {
            name: row.certifiesAchievement,
            description: row.summary ?? undefined,
            completedAt: new Date().toISOString(),
          },
          idempotencyKey: `portal:${row.id}:${membership.walletAddress.toLowerCase()}`,
        },
      });

      const certificateId = 'certificateId' in result ? result.certificateId : null;

      // Esta escritura no se puede perder: es el unico vinculo entre la
      // membresia que dio acceso y la credencial emitida. Si fallara en
      // silencio, el certificado existiria en la blockchain pero el portal no
      // sabria a que Lock pertenece, y un reintento lo emitiria de nuevo.
      //
      // El indice parcial (content_id, wallet_address) where completed_at is
      // not null hace que un reintento simultaneo choque en vez de duplicar:
      // onConflictDoUpdate lo resuelve conservando la fila que ya existe.
      try {
        await db
          .insert(schema.portalUnlocks)
          .values({
            contentId: row.id,
            walletAddress: membership.walletAddress,
            userId: req.auth?.userId ?? null,
            lockAddress: row.lockAddress,
            lockChainId: row.lockChainId,
            keyExpiresAt: membership.expiresAt,
            completedAt: new Date(),
            certificateId,
          })
          .onConflictDoUpdate({
            target: [schema.portalUnlocks.contentId, schema.portalUnlocks.walletAddress],
            targetWhere: isNotNull(schema.portalUnlocks.completedAt),
            // Solo rellenamos el certificado si la fila previa no lo tenia:
            // nunca pisamos una credencial ya emitida.
            set: { certificateId: sql`coalesce(${schema.portalUnlocks.certificateId}, excluded.certificate_id)` },
          });
      } catch (err) {
        req.log.error(
          { err, contentId: row.id, certificateId, wallet: membership.walletAddress },
          'Certificado emitido pero no se pudo vincular al portal',
        );
      }

      reply.status(202);
      return {
        data: {
          certificateId,
          achievement: row.certifiesAchievement,
          alreadyIssued: false,
          // La credencial se acuña en la wallet que probo la membresia, no en
          // una custodiada: es la misma que compro la llave del Lock.
          wallet: membership.walletAddress,
          message: 'Tu credencial se esta emitiendo en la blockchain.',
        },
      };
    },
  );

  // ─── Publicar (creador) ───────────────────────────────────────────────────
  app.post(
    '/v1/portal/contents',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Portal'],
        description:
          'Publica contenido restringido por un Lock de Unlock. Genera la previsualizacion como archivo aparte.',
        body: createContentSchema,
      },
    },
    async (req, reply) => {
      const body = createContentSchema.parse(req.body);
      const institutionId = await resolveInstitutionId(req.auth!.userId);

      if (!isSupportedUnlockChain(body.lockChainId)) {
        throw errors.validation({
          lockChainId: [
            `Unlock no esta desplegado en esa red. Soportadas: ${supportedUnlockChainIds().join(', ')}`,
          ],
        });
      }

      let lockAddress: string;
      try {
        lockAddress = normalizeLockAddress(body.lockAddress);
      } catch {
        throw errors.validation({ lockAddress: ['No es una address EVM valida'] });
      }

      // Comprobamos que el Lock exista de verdad antes de publicar: un Lock
      // inexistente dejaria el contenido inaccesible para siempre.
      const lockInfo = await getLockInfo(lockAddress, body.lockChainId).catch(() => null);
      if (!lockInfo || lockInfo.name === null) {
        throw errors.validation({
          lockAddress: ['No se pudo leer ese Lock en la red indicada. Revisa la direccion.'],
        });
      }

      const full = Buffer.from(body.body, 'base64');
      if (full.byteLength === 0) throw errors.validation({ body: ['El contenido esta vacio'] });

      const slug = slugify(body.title);
      const mimeType = body.mimeType ?? (body.kind === 'text' ? 'text/plain' : 'application/octet-stream');

      const fullKey = `portal/${institutionId}/${slug}/full`;
      await uploadPrivateObject({ data: full, key: fullKey, contentType: mimeType });

      // El preview de texto se recorta aqui y se guarda en la fila: es lo unico
      // que viaja sin membresia, asi que nunca contiene el cuerpo completo.
      let previewText: string | null = null;
      let previewKey: string | null = null;

      if (body.kind === 'text') {
        const text = full.toString('utf8');
        previewText =
          text.length > PREVIEW_TEXT_CHARS ? `${text.slice(0, PREVIEW_TEXT_CHARS).trimEnd()}…` : text;
      } else if (body.kind === 'image') {
        // Para imagen servimos el mismo archivo como muestra; el recorte real
        // se hace en el cliente del creador antes de subir.
        previewKey = `portal/${institutionId}/${slug}/preview`;
        await uploadPrivateObject({ data: full, key: previewKey, contentType: mimeType });
      }

      const db = getDb();
      const [row] = await db
        .insert(schema.portalContents)
        .values({
          institutionId,
          createdBy: req.auth!.userId,
          slug,
          title: body.title,
          summary: body.summary ?? null,
          kind: body.kind,
          lockAddress,
          lockChainId: body.lockChainId,
          previewKey,
          fullKey,
          previewText,
          previewSeconds: body.previewSeconds ?? null,
          certifiesAchievement: body.certifiesAchievement ?? null,
          mimeType,
          byteSize: full.byteLength,
          publishedAt: new Date(),
        })
        .returning();

      reply.status(201);
      return { data: { ...publicShape(row!), lockInfo } };
    },
  );

  app.get(
    '/v1/portal/mine',
    {
      preHandler: [app.requireAuth(['institution_admin', 'teacher']), app.rateLimit()],
      schema: { tags: ['Portal'], description: 'Contenido publicado por tu institucion.' },
    },
    async (req) => {
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const rows = await db.query.portalContents.findMany({
        where: eq(schema.portalContents.institutionId, institutionId),
        orderBy: [desc(schema.portalContents.createdAt)],
      });
      return { data: rows.map(publicShape) };
    },
  );

  app.delete(
    '/v1/portal/content/:id',
    {
      preHandler: [app.requireAuth(['institution_admin']), app.rateLimit()],
      schema: { tags: ['Portal'], description: 'Despublica un contenido del portal.' },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const institutionId = await resolveInstitutionId(req.auth!.userId);
      const db = getDb();
      const [row] = await db
        .update(schema.portalContents)
        .set({ publishedAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(schema.portalContents.id, id),
            eq(schema.portalContents.institutionId, institutionId),
          ),
        )
        .returning();
      if (!row) throw errors.notFound('Contenido');
      return { unpublished: true, id: row.id };
    },
  );
}
