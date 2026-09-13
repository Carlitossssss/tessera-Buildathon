import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, count, desc, eq, gte, lte } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { errors } from '@tessera/shared/errors';
import {
  issueCertificateSchema,
  revokeCertificateSchema,
  verifyCertificateSchema,
  paginationSchema,
} from '@tessera/shared/schemas';
import { queues } from '../../services/queues.js';
import { contractAddresses, chainClients } from '../../services/nonce.js';
import { enqueueCertificateEmission } from '../../services/certificates.js';
import { assertInstitutionActive } from '../../services/institution-access.js';
import { readCertificateProvenance } from '../../services/provenance.js';
import { certificateAbi } from '@tessera/contracts';
import { env } from '../../config/env.js';
import { renderCertificateSvg } from '../../services/certificate-artwork.js';
import { buildCertificateMetadata } from '../../services/certificate-metadata.js';
import { fetchIpfsAsset, getBrowsableIpfsGateway } from '../../services/ipfs-readiness.js';
import { networkFor } from '../../config/networks.js';
import { getObjectStorageAsset } from '../../services/storage.js';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import {
  buildCertificateDetailResponse,
  buildCertificateListResponse,
  buildCertificateTrackingResponse,
  buildCertificateVerificationResponse,
} from './presenters.js';

/**
 * Forma de un UUID v4 tal y como lo genera la base de datos.
 *
 * Las rutas publicas reciben el identificador desde un tokenURI grabado
 * on-chain, que puede contener cualquier cosa. Comprobarlo antes de consultar
 * evita que un valor con otra forma llegue a una columna `uuid` y convierta un
 * "no existe" en un error del servidor.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PNG ya renderizados, por certificado.
 *
 * Convertir el SVG a PNG cuesta unos dos segundos, y es el mismo resultado
 * cada vez: un certificado emitido no cambia. Ese tiempo importa porque un
 * indexador de NFT pide la imagen una vez, con paciencia corta, y si no llega
 * a tiempo cachea el fallo; la credencial queda entonces sin arte en el
 * explorador aunque el token sea perfectamente valido.
 *
 * El limite existe para que la caché no crezca sin fin en un proceso que vive
 * semanas. Al llenarse se descarta la entrada mas antigua, que en un Map es la
 * primera que devuelve la iteracion.
 */
const PNG_CACHE = new Map<string, Buffer>();
const PNG_CACHE_LIMIT = 200;

/**
 * Logo de la coleccion.
 *
 * Cuadrado, porque es como lo recortan los exploradores y los marketplaces, y
 * sin datos de ningun certificado: representa al emisor, no a una credencial.
 * Se guarda tras el primer render porque el resultado nunca cambia.
 */
let collectionPng: Buffer | undefined;

async function renderCollectionImage(): Promise<Buffer> {
  if (collectionPng) return collectionPng;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B1120"/>
      <stop offset="100%" stop-color="#15243F"/>
    </linearGradient>
    <linearGradient id="seal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <rect x="40" y="40" width="720" height="720" rx="48" fill="none" stroke="#1E3A5F" stroke-width="2"/>
  <circle cx="400" cy="330" r="120" fill="none" stroke="url(#seal)" stroke-width="10"/>
  <path d="M400 250 L455 300 L455 375 L400 415 L345 375 L345 300 Z" fill="url(#seal)" opacity="0.92"/>
  <path d="M368 330 L392 354 L438 302" fill="none" stroke="#0B1120" stroke-width="18"
        stroke-linecap="round" stroke-linejoin="round"/>
  <text x="400" y="545" text-anchor="middle" fill="#F8FAFC"
        font-family="Georgia, 'Times New Roman', serif" font-size="72" letter-spacing="2">Tessera</text>
  <text x="400" y="605" text-anchor="middle" fill="#7DD3FC"
        font-family="Helvetica, Arial, sans-serif" font-size="26" letter-spacing="6">CERTIFICADOS SOULBOUND</text>
  <text x="400" y="680" text-anchor="middle" fill="#64748B"
        font-family="Helvetica, Arial, sans-serif" font-size="22">ERC-721 + ERC-5192 · No transferible</text>
</svg>`;

  collectionPng = await sharp(Buffer.from(svg)).png().toBuffer();
  return collectionPng;
}

async function renderCertificatePng(certificateId: string, svg: Buffer): Promise<Buffer> {
  const cached = PNG_CACHE.get(certificateId);
  if (cached) return cached;

  const png = await sharp(svg).png().toBuffer();

  if (PNG_CACHE.size >= PNG_CACHE_LIMIT) {
    const oldest = PNG_CACHE.keys().next();
    if (!oldest.done) PNG_CACHE.delete(oldest.value);
  }
  PNG_CACHE.set(certificateId, png);
  return png;
}

const listQuery = paginationSchema.extend({
  status: z.enum(['queued', 'processing', 'issued', 'failed', 'revoked']).optional(),
  studentEmail: z.string().email().optional(),
  courseId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export default async function certificateRoutes(app: FastifyInstance) {
  /**
   * Metadata de la coleccion: lo que `contractURI()` del contrato apunta.
   *
   * Da identidad a la ficha del contrato en exploradores y marketplaces:
   * nombre, descripcion e imagen de la coleccion entera. Sin esto la pagina
   * del contrato aparece vacia aunque cada token tenga su metadata.
   *
   * Es estatica --no depende de ningun certificado-- y publica sin
   * autenticacion, porque quien la lee es un indexador, no un usuario.
   */
  app.get(
    '/v1/certificates/collection',
    {
      schema: { tags: ['Verify'], description: 'Metadata ERC-721 de la coleccion (contractURI).' },
    },
    async (_req, reply) => {
      reply.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
      reply.type('application/json; charset=utf-8');

      const base = env.API_PUBLIC_URL.replace(/\/$/, '');
      return {
        name: 'Tessera Certificate',
        description:
          'Credenciales academicas soulbound emitidas por instituciones verificadas on-chain. ' +
          'Cada certificado es un ERC-721 no transferible (ERC-5192) cuyo emisor puede comprobarse ' +
          'en el contrato con certificateIssuer(tokenId), sin pasar por Tessera.',
        image: `${base}/v1/certificates/collection/image.png`,
        banner_image_url: `${base}/v1/certificates/collection/image.png`,
        external_link: env.AUTH_URL,
        // Un certificado no se revende: no hay regalias que declarar.
        seller_fee_basis_points: 0,
      };
    },
  );

  /**
   * Imagen de la coleccion, referenciada desde /collection.
   *
   * Es el logo que el explorador pone junto al nombre del contrato. No depende
   * de ningun certificado, asi que se renderiza una vez y se reutiliza: el
   * dibujo es identico en cada peticion.
   */
  app.get(
    '/v1/certificates/collection/image.png',
    {
      schema: { tags: ['Verify'], description: 'Imagen de la coleccion (contractURI.image).' },
    },
    async (_req, reply) => {
      const png = await renderCollectionImage();

      reply.header('Content-Type', 'image/png');
      reply.header('Cache-Control', 'public, max-age=604800, stale-while-revalidate=604800');
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
      reply.header('Content-Disposition', 'inline; filename="tessera-collection.png"');
      return reply.send(png);
    },
  );

  app.get(
    '/v1/certificates/metadata/:certificateId',
    {
      schema: { tags: ['Verify'], description: 'Metadata ERC-721 publica del certificado.' },
    },
    async (req, reply) => {
      const { certificateId } = req.params as { certificateId: string };

      // El id viaja dentro del tokenURI que quedo grabado on-chain, asi que
      // aqui llega lo que sea que se acuño: hay tokens en Fuji apuntando a
      // `demo-fuji`, que no es un UUID. La columna es `uuid`, de modo que
      // consultarla con ese valor hace que Postgres aborte por tipo y la
      // respuesta salga como 500. Un explorador que ve un 500 asume que el
      // servicio esta caido y reintenta; con un 404 entiende que ese token no
      // tiene metadata y deja de insistir.
      if (!UUID_PATTERN.test(certificateId)) throw errors.notFound('Certificado no encontrado');

      const db = getDb();
      const cert = await db.query.certificates.findFirst({
        where: eq(schema.certificates.id, certificateId),
      });
      if (!cert) throw errors.notFound('Certificado no encontrado');
      const institution = await db.query.institutions.findFirst({
        where: eq(schema.institutions.id, cert.institutionId),
      });
      if (!institution) throw errors.notFound('Institucion');

      // Todas las replicas, no solo las confirmadas.
      //
      // Filtrar por `confirmed` escondia la copia mientras se acuñaba, y el
      // token ya existia en la otra cadena: la metadata declaraba una sola red
      // cuando habia dos. Cada entrada lleva su estado, asi que un indexador
      // distingue una copia viva de una en curso sin que le ocultemos ninguna.
      const mirrors = await db.query.certificateMirrors.findMany({
        where: eq(schema.certificateMirrors.certificateId, cert.id),
      });

      const issuedAt = cert.issuedAt?.toISOString() ?? cert.createdAt.toISOString();
      const readString = (key: string): string | null =>
        typeof cert.metadata?.[key] === 'string' ? (cert.metadata[key] as string) : null;

      const bundleIpfsCid = readString('certificateBundleIpfsCid');
      const imageChildCid = readString('certificateImageIpfsCid');
      const legacyPreviewCid = readString('certificatePreviewIpfsCid');

      // Newest certificates pin the image as a standalone file; older ones kept
      // it inside a folder, and the oldest as its own legacy CID.
      const imageIpfsUri = imageChildCid
        ? `ipfs://${imageChildCid}`
        : bundleIpfsCid
          ? `ipfs://${bundleIpfsCid}/certificate.png`
          : legacyPreviewCid
            ? `ipfs://${legacyPreviewCid}`
            : null;
      const imageUrl =
        readString('certificateImageUrl') ??
        `${env.API_PUBLIC_URL}/v1/certificates/artwork/${cert.id}/certificate.png`;

      // Un certificado emitido no cambia, asi que su metadata se cachea un dia
      // en vez de cinco minutos: los indexadores NFT y las CDN intermedias
      // sirven entonces una copia caliente en lugar de golpear el origen, que
      // es lo que hace la diferencia entre resolverse y agotar el tiempo.
      // stale-while-revalidate deja servir la copia vieja mientras se refresca.
      reply.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
      reply.type('application/json; charset=utf-8');

      // Byte for byte the metadata.json pinned on IPFS, so the token URI, the
      // pinned copy and the verify page can never disagree.
      return buildCertificateMetadata({
        certificateId: cert.id,
        studentWallet: cert.studentWallet,
        institutionWallet: institution.walletAddress,
        network: env.POLYGON_CHAIN,
        issuedAt,
        completedAt:
          typeof cert.metadata?.completedAt === 'string' ? cert.metadata.completedAt : null,
        chainId: env.POLYGON_CHAIN_ID,
        contractAddress: contractAddresses.certificate,
        institutionName: institution.name,
        studentName: cert.studentName,
        achievementName: cert.achievementName,
        courseId: cert.courseId,
        description: cert.achievementDescription,
        grade: cert.grade,
        imageUrl,
        imageIpfsUri,
        externalUrl: `${env.AUTH_URL}/verify?certificateId=${cert.id}`,
        deployments: [
          {
            chainId: env.POLYGON_CHAIN_ID,
            network: env.POLYGON_CHAIN,
            contractAddress: contractAddresses.certificate,
            role: 'primary',
          },
          ...mirrors.flatMap((m) => {
            const net = networkFor(m.chainId);
            return net
              ? [
                  {
                    chainId: m.chainId,
                    network: net.name,
                    contractAddress: net.contracts.certificate,
                    role: 'mirror',
                    status: m.status,
                    ...(m.onchainTokenId !== null
                      ? { tokenId: m.onchainTokenId.toString() }
                      : {}),
                    ...(m.txHash ? { txHash: m.txHash } : {}),
                  },
                ]
              : [];
          }),
        ],
      });
    },
  );

  app.get(
    '/v1/certificates/artwork/:id/preview.jpg',
    {
      schema: { tags: ['Verify'], description: 'Preview JPEG publico para indexadores NFT.' },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const isTokenId = /^\d+$/.test(id);
      if (!isTokenId && !UUID_PATTERN.test(id)) throw errors.notFound('Certificado no encontrado');
      const db = getDb();
      const cert = await db.query.certificates.findFirst({
        where: isTokenId
          ? eq(schema.certificates.onchainTokenId, BigInt(id))
          : eq(schema.certificates.id, id),
      });
      if (!cert) throw errors.notFound('Certificado no encontrado');
      const previewCid =
        typeof cert.metadata?.certificatePreviewIpfsCid === 'string'
          ? cert.metadata.certificatePreviewIpfsCid
          : null;
      const imageCid =
        typeof cert.metadata?.certificateImageIpfsCid === 'string'
          ? cert.metadata.certificateImageIpfsCid
          : null;
      const bundleCid =
        typeof cert.metadata?.certificateBundleIpfsCid === 'string'
          ? cert.metadata.certificateBundleIpfsCid
          : null;
      const sourceCid = bundleCid ?? previewCid ?? imageCid;
      if (!sourceCid) throw errors.notFound('Preview del certificado no encontrado');

      const sourceContentType = bundleCid || previewCid ? 'image/jpeg' : 'image/png';
      const sha256Key =
        bundleCid || previewCid ? 'certificatePreviewSha256' : 'certificateImageSha256';
      const storedSha256 = cert.metadata?.[sha256Key];
      const expectedSha256 = typeof storedSha256 === 'string' ? storedSha256 : undefined;
      let sourceData: Buffer | undefined;
      if (sourceContentType === 'image/jpeg') {
        const stagedPreview = await getObjectStorageAsset(`certificates/${cert.id}/preview.jpg`);
        const stagedSha256 = stagedPreview
          ? createHash('sha256').update(stagedPreview.data).digest('hex')
          : null;
        if (
          stagedPreview?.contentType === 'image/jpeg' &&
          (!expectedSha256 || stagedSha256 === expectedSha256)
        ) {
          sourceData = stagedPreview.data;
        }
      }
      if (!sourceData) {
        const source = await fetchIpfsAsset({
          cid: sourceCid,
          path: bundleCid ? 'preview.jpg' : undefined,
          contentType: sourceContentType,
          expectedSha256,
        }).catch((error: unknown) => {
          req.log.warn({ err: error, certificateId: cert.id }, 'Preview IPFS no disponible');
          throw errors.serviceUnavailable('Preview del certificado no disponible');
        });
        sourceData = source.data;
      }
      const jpeg =
        bundleCid || previewCid
          ? sourceData
          : await sharp(sourceData)
              .flatten({ background: '#ffffff' })
              .resize({ width: 1080, withoutEnlargement: true })
              .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
              .toBuffer();
      reply.header('Content-Type', 'image/jpeg');
      reply.header('Content-Length', String(jpeg.length));
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
      reply.header('Content-Disposition', 'inline; filename="tessera-certificate-preview.jpg"');
      return reply.send(jpeg);
    },
  );

  // ─── Procedencia RWA ──────────────────────────────────────────────────────
  //
  // Un diploma es un activo del mundo real: alguien concreto responde por el.
  // Este endpoint contesta quien lo emitio, si estaba autorizado y si el token
  // puede venderse, leyendo TODO del contrato --nada de nuestra base--.
  //
  // Es publico a proposito: una afirmacion de procedencia que solo puede
  // comprobarse con una API key no prueba nada a un tercero. Devuelve ademas
  // los comandos para repetir la lectura sin usar Tessera.
  app.get(
    '/v1/certificates/:tokenId/provenance',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Verify'],
        description:
          'Procedencia on-chain de un certificado: emisor, si estaba aprobado y si es soulbound. Se lee del contrato, no de la base.',
        querystring: z.object({ chainId: z.coerce.number().int().positive().optional() }),
      },
    },
    async (req, reply) => {
      const { tokenId } = req.params as { tokenId: string };
      if (!/^\d+$/.test(tokenId)) throw errors.validation({ tokenId: ['Debe ser numerico'] });

      const query = z
        .object({ chainId: z.coerce.number().int().positive().optional() })
        .parse(req.query);
      const chainId = query.chainId ?? env.POLYGON_CHAIN_ID;

      const provenance = await readCertificateProvenance({ chainId, tokenId });
      if (!provenance) {
        throw errors.notFound('Red no soportada o tokenId invalido');
      }

      // Lectura on-chain de un token inmutable: cachear es seguro y evita
      // castigar al RPC si varios jurados consultan a la vez.
      reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
      reply.header('Access-Control-Allow-Origin', '*');
      return { data: provenance };
    },
  );

  app.get(
    '/v1/certificates/artwork/:id',
    {
      preHandler: [app.rateLimit()],
      schema: { tags: ['Verify'], description: 'Redireccion al PNG publico del certificado.' },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const download = (req.query as { download?: string }).download === '1';
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
      return reply.redirect(
        `${env.API_PUBLIC_URL}/v1/certificates/artwork/${id}/certificate.png${download ? '?download=1' : ''}`,
      );
    },
  );

  app.get(
    '/v1/certificates/artwork/:id/certificate.png',
    {
      preHandler: [app.rateLimit()],
      schema: { tags: ['Verify'], description: 'Representacion SVG publica de un certificado.' },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const isTokenId = /^\d+$/.test(id);
      if (!isTokenId && !UUID_PATTERN.test(id)) throw errors.notFound('Certificado no encontrado');
      const db = getDb();
      const cert = await db.query.certificates.findFirst({
        where: isTokenId
          ? eq(schema.certificates.onchainTokenId, BigInt(id))
          : eq(schema.certificates.id, id),
      });
      if (!cert) throw errors.notFound('Certificado no encontrado');
      const [institution, template] = await Promise.all([
        db.query.institutions.findFirst({
          where: eq(schema.institutions.id, cert.institutionId),
        }),
        cert.templateId
          ? db.query.certificateTemplates.findFirst({
              where: eq(schema.certificateTemplates.id, cert.templateId),
            })
          : null,
      ]);
      if (!institution) throw errors.notFound('Institucion');

      const svg = renderCertificateSvg({
        certificateId: cert.id,
        institutionName: institution.name,
        studentName: cert.studentName,
        achievementName: cert.achievementName,
        description: cert.achievementDescription,
        grade: cert.grade,
        completedAt:
          typeof cert.metadata?.completedAt === 'string' ? cert.metadata.completedAt : null,
        issuedAt: cert.issuedAt?.toISOString(),
        verificationUrl: cert.onchainTokenId
          ? `${env.AUTH_URL}/verify/${cert.onchainTokenId.toString()}`
          : `${env.AUTH_URL}/verify?certificateId=${cert.id}`,
        template: template
          ? { backgroundUrl: template.backgroundUrl, layout: template.layout }
          : undefined,
      });
      const png = await renderCertificatePng(cert.id, svg);
      const download = (req.query as { download?: string }).download === '1';
      reply.header('Content-Type', 'image/png');
      // La imagen de un certificado emitido tampoco cambia; renderizarla cuesta
      // ~2 s, y ese tiempo es justo el que un indexador no espera.
      reply.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
      // El nombre del fichero lleva el identificador por el que se pidio, no el
      // de la red principal: el mismo certificado se acuña con ids distintos en
      // cada cadena, y descargar la copia de Fuji con el numero de Amoy hace
      // creer que es otro token.
      reply.header(
        'Content-Disposition',
        `${download ? 'attachment' : 'inline'}; filename="tessera-certificate-${id}.png"`,
      );
      return reply.send(png);
    },
  );

  // Emision publica via API key
  app.post(
    '/v1/certificates',
    {
      preHandler: [app.requireApiKey(['certificates:write']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'Certificates'],
        description: 'Encola la emision asincrona de un certificado SBT. Devuelve 202 con jobId.',
        body: issueCertificateSchema,
      },
    },
    async (req, reply) => {
      const payload = issueCertificateSchema.parse(req.body);
      const institutionId = req.apiKey!.institutionId;

      const result = await enqueueCertificateEmission({
        institutionId,
        payload,
        apiPublicUrl: env.API_PUBLIC_URL,
      });
      if ('idempotent' in result) return reply.status(200).send(result);
      reply.status(202);
      return result;
    },
  );

  app.get(
    '/v1/certificates/jobs/:jobId',
    {
      preHandler: [app.requireApiKey(['certificates:read']), app.rateLimit()],
      schema: { tags: ['Certificates'] },
    },
    async (req) => {
      const { jobId } = req.params as { jobId: string };
      const db = getDb();
      const job = await db.query.emissionJobs.findFirst({
        where: and(
          eq(schema.emissionJobs.publicId, jobId),
          eq(schema.emissionJobs.institutionId, req.apiKey!.institutionId),
        ),
      });
      if (!job) throw errors.notFound('Job no encontrado');
      const cert = job.certificateId
        ? await db.query.certificates.findFirst({
            where: eq(schema.certificates.id, job.certificateId),
          })
        : null;
      return {
        jobId: job.publicId,
        status: job.status,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        result: cert
          ? {
              certificateId: cert.id,
              tokenId: cert.onchainTokenId?.toString() ?? null,
              txHash: cert.txHash,
              status: cert.status,
            }
          : job.result,
        error: job.lastError,
      };
    },
  );

  app.get(
    '/v1/certificates',
    {
      preHandler: [app.requireApiKey(['certificates:read']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'Certificates'],
        description: 'Lista los certificados emitidos por la institucion con filtros opcionales.',
        querystring: listQuery,
      },
    },
    async (req) => {
      const q = listQuery.parse(req.query);
      const db = getDb();
      const institutionId = req.apiKey!.institutionId;
      const where = [eq(schema.certificates.institutionId, institutionId)];
      if (q.status) where.push(eq(schema.certificates.status, q.status));
      if (q.studentEmail) where.push(eq(schema.certificates.studentEmail, q.studentEmail));
      if (q.courseId) where.push(eq(schema.certificates.courseId, q.courseId));
      if (q.from) where.push(gte(schema.certificates.createdAt, new Date(q.from)));
      if (q.to) where.push(lte(schema.certificates.createdAt, new Date(q.to)));
      const predicate = and(...where);
      const [rows, totals] = await Promise.all([
        db.query.certificates.findMany({
          where: predicate,
          limit: q.limit,
          offset: (q.page - 1) * q.limit,
          orderBy: [desc(schema.certificates.createdAt)],
        }),
        db.select({ total: count() }).from(schema.certificates).where(predicate),
      ]);
      return buildCertificateListResponse(rows, q.page, q.limit, totals[0]?.total ?? 0);
    },
  );

  app.get(
    '/v1/certificates/:id',
    {
      preHandler: [app.requireApiKey(['certificates:read']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'Certificates'],
        description: 'Detalle de un certificado por id interno o tokenId on-chain.',
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const db = getDb();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const isNumeric = /^\d+$/.test(id);
      const cert = await db.query.certificates.findFirst({
        where: and(
          isUuid
            ? eq(schema.certificates.id, id)
            : isNumeric
              ? eq(schema.certificates.onchainTokenId, BigInt(id))
              : eq(schema.certificates.id, id),
          eq(schema.certificates.institutionId, req.apiKey!.institutionId),
        ),
      });
      if (!cert) throw errors.notFound('Certificado no encontrado');
      const institution = await db.query.institutions.findFirst({
        where: eq(schema.institutions.id, cert.institutionId),
      });
      if (!institution) throw errors.notFound('Institucion');
      return buildCertificateDetailResponse(cert, institution, {
        appUrl: env.AUTH_URL,
        apiPublicUrl: env.API_PUBLIC_URL,
        network: env.POLYGON_CHAIN_ID === 137 ? 'polygon' : 'amoy',
        chainId: env.POLYGON_CHAIN_ID,
        arweaveGateway: env.ARWEAVE_GATEWAY,
        ipfsGateway: getBrowsableIpfsGateway(),
        certificateContractAddress: contractAddresses.certificate,
      });
    },
  );

  // Revocacion
  app.post(
    '/v1/certificates/:id/revoke',
    {
      preHandler: [app.requireApiKey(['certificates:write']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'Certificates'],
        description:
          'Revoca un certificado. Requiere scope certificates:write y rol owner de la institucion emisora.',
        body: revokeCertificateSchema,
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = revokeCertificateSchema.parse(req.body);
      const db = getDb();
      await assertInstitutionActive(req.apiKey!.institutionId);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const isNumeric = /^\d+$/.test(id);
      const cert = await db.query.certificates.findFirst({
        where: and(
          isUuid
            ? eq(schema.certificates.id, id)
            : isNumeric
              ? eq(schema.certificates.onchainTokenId, BigInt(id))
              : eq(schema.certificates.id, id),
          eq(schema.certificates.institutionId, req.apiKey!.institutionId),
        ),
      });
      if (!cert) throw errors.notFound('Certificado no encontrado');
      if (cert.status === 'revoked')
        throw errors.certificateAlreadyRevoked(String(cert.onchainTokenId ?? cert.id));
      if (cert.status !== 'issued')
        throw errors.conflict('Solo se pueden revocar certificados emitidos');

      await db
        .update(schema.certificates)
        .set({
          status: 'revoked',
          revokedAt: new Date(),
          revokeReason: body.reason,
          revokeReasonText: body.reasonText ?? null,
        })
        .where(eq(schema.certificates.id, cert.id));

      const jobPublicId = `rev_${nanoid(16)}`;
      await queues.certificate.add(
        'revoke-certificate',
        { certificateId: cert.id, jobPublicId },
        { jobId: jobPublicId },
      );

      return replyShape(jobPublicId, cert.id);
    },
  );

  // Verificacion publica (sin auth)
  app.post(
    '/v1/certificates/verify',
    {
      preHandler: [app.rateLimit()],
      schema: {
        tags: ['Public API', 'Verify'],
        description: 'Verifica la autenticidad de un certificado on-chain. NO requiere API Key.',
        body: verifyCertificateSchema,
      },
    },
    async (req) => {
      const body = verifyCertificateSchema.parse(req.body);
      const db = getDb();

      let cert;
      if (body.tokenId) {
        cert = await db.query.certificates.findFirst({
          where: eq(schema.certificates.onchainTokenId, BigInt(body.tokenId)),
        });
      } else if (body.txHash) {
        cert = await db.query.certificates.findFirst({
          where: eq(schema.certificates.txHash, body.txHash),
        });
      } else if (body.certificateId) {
        cert = await db.query.certificates.findFirst({
          where: eq(schema.certificates.id, body.certificateId),
        });
      }

      if (!cert || !cert.onchainTokenId) {
        return { valid: false, reason: 'not_found' };
      }

      // consulta on-chain para estado actual
      let onchainRevoked = false;
      try {
        await chainClients.publicClient.readContract({
          address: contractAddresses.certificate,
          abi: certificateAbi,
          functionName: 'ownerOf',
          args: [cert.onchainTokenId],
        });
      } catch (err) {
        // TesseraCertificate revoca quemando el token; ownerOf revierte para
        // tokens quemados. Otros errores se registran y el estado off-chain
        // conserva la decision hasta que el indexador pueda reconciliarla.
        onchainRevoked = cert.status === 'revoked';
        req.log.warn({ err }, 'No se pudo leer ownerOf del certificado on-chain');
      }

      // Las replicas se cargan junto a la institucion: la verificacion publica
      // hablaba solo de la red de emision, asi que una copia existente en
      // Avalanche no aparecia y no habia forma de llegar a ella desde aqui.
      const [institution, mirrors] = await Promise.all([
        db.query.institutions.findFirst({
          where: eq(schema.institutions.id, cert.institutionId),
        }),
        db.query.certificateMirrors.findMany({
          where: eq(schema.certificateMirrors.certificateId, cert.id),
        }),
      ]);
      if (!institution) throw errors.notFound('Institucion');

      return buildCertificateVerificationResponse(
        cert,
        institution,
        !onchainRevoked && cert.status === 'issued',
        {
          appUrl: env.AUTH_URL,
          apiPublicUrl: env.API_PUBLIC_URL,
          network: env.POLYGON_CHAIN_ID === 137 ? 'polygon' : 'amoy',
          chainId: env.POLYGON_CHAIN_ID,
          arweaveGateway: env.ARWEAVE_GATEWAY,
          ipfsGateway: getBrowsableIpfsGateway(),
          certificateContractAddress: contractAddresses.certificate,
          mirrors: mirrors.map((m) => ({
            chainId: m.chainId,
            status: m.status,
            onchainTokenId: m.onchainTokenId,
            txHash: m.txHash,
          })),
        },
      );
    },
  );
}

function replyShape(jobId: string, certificateId: string) {
  return buildCertificateTrackingResponse(env.API_PUBLIC_URL, jobId, certificateId);
}
