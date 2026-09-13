import { UnrecoverableError, type Job } from 'bullmq';
import { eq } from '@tessera/db';
import { schema } from '@tessera/db';
import { createHmac } from 'node:crypto';
import { nanoid } from 'nanoid';
import { getDb } from '../lib/db.js';
import { contractAddresses, chainClients, withNonceLock } from '../services/nonce.js';
import { getSigner } from '../services/signer.js';
import { uploadAsset } from '../services/storage.js';
import {
  assertPinnedAsset,
  computeRawCidV1,
  getPrimaryIpfsGateway,
  PINATA_RAW_BLOCK_LIMIT,
} from '../services/ipfs-readiness.js';
import { buildCertificateMetadata } from '../services/certificate-metadata.js';
import { activeMirrorChainIds, mirrorCertificate } from '../services/certificate-mirror.js';
import { renderCertificateSvg } from '../services/certificate-artwork.js';
import { queues } from '../services/queues.js';
import { logger } from '../lib/logger.js';
import { debitCertificateCredit, refundCertificateCredit } from '../services/credits.js';
import {
  certificateAbi,
  autoIssuerAbi,
  ISSUANCE_TYPES,
  buildIssuanceDomain,
  registryAbi,
  createRpcTransport,
} from '@tessera/contracts';
import { env, isProd } from '../config/env.js';
import { createWalletClient, decodeEventLog, type Address } from 'viem';
import sharp from 'sharp';

export async function processCertificateJob(job: Job) {
  const name = job.name;
  if (name === 'emit-certificate') return emitCertificate(job);
  if (name === 'revoke-certificate') return revokeCertificate(job);
  throw new Error(`Job desconocido: ${name}`);
}

async function emitCertificate(
  job: Job<{ certificateId: string; institutionId: string; jobPublicId: string }>,
) {
  const { certificateId, jobPublicId } = job.data;
  const db = getDb();
  const cert = await db.query.certificates.findFirst({
    where: eq(schema.certificates.id, certificateId),
  });
  if (!cert) throw new Error('Certificado no encontrado');
  if (!cert.studentWallet) throw new Error('Certificado no tiene wallet de estudiante');
  const studentWallet = cert.studentWallet;

  // Debito atomico del costo TSC configurado (idempotente por certificateId).
  // Si no hay saldo, marcamos el certificado como fallido y abortamos.
  const debit = await debitCertificateCredit({
    institutionId: cert.institutionId,
    certificateId: cert.id,
  });
  if (!debit.ok) {
    await db
      .update(schema.certificates)
      .set({ status: 'failed' })
      .where(eq(schema.certificates.id, cert.id));
    await db
      .update(schema.emissionJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        lastError: 'INSUFFICIENT_CREDITS',
      })
      .where(eq(schema.emissionJobs.publicId, jobPublicId));
    logger.warn(
      { certId: cert.id, institutionId: cert.institutionId },
      'Emision abortada: sin creditos',
    );
    return;
  }

  await db
    .update(schema.certificates)
    .set({ status: 'processing' })
    .where(eq(schema.certificates.id, cert.id));
  await db
    .update(schema.emissionJobs)
    .set({ status: 'processing', startedAt: new Date() })
    .where(eq(schema.emissionJobs.publicId, jobPublicId));

  const processingStartedAt = Date.now();
  try {
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
    if (!institution?.walletAddress) {
      throw new Error('Institucion no tiene walletAddress para emision on-chain');
    }

    const issuedAt = new Date().toISOString();
    const certificateSvg = renderCertificateSvg({
      certificateId: cert.id,
      institutionName: institution.name,
      studentName: cert.studentName,
      achievementName: cert.achievementName,
      description: cert.achievementDescription,
      grade: cert.grade,
      completedAt:
        typeof cert.metadata?.completedAt === 'string' ? cert.metadata.completedAt : null,
      issuedAt,
      verificationUrl: `${env.AUTH_URL}/verify?certificateId=${cert.id}`,
      template: template
        ? { backgroundUrl: template.backgroundUrl, layout: template.layout }
        : undefined,
    });
    // Two pins, nothing else: the certificate image and its metadata, each as a
    // standalone file so both are addressed by a plain `/ipfs/<cid>` URL with no
    // directory path. That is the exact shape block explorers were observed to
    // resolve, and it lets the image CID be derived from our own bytes before
    // either upload happens, so the metadata can reference it with no ordering
    // dependency and no self-reference.
    const certificatePng = await sharp(certificateSvg)
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();

    const imageCid = computeRawCidV1(certificatePng);
    if (certificatePng.length > PINATA_RAW_BLOCK_LIMIT) {
      throw new Error(
        `El PNG del certificado supera ${PINATA_RAW_BLOCK_LIMIT} bytes y su CID no puede derivarse`,
      );
    }

    // What goes on-chain has to answer on the FIRST request, cold, because an
    // NFT indexer tries once and caches the failure. A public IPFS gateway does
    // not meet that bar: measured on ipfs.io, the first read of freshly pinned
    // content is a 504 after 28s and only the second one succeeds. Tessera's own
    // endpoints answer in well under two seconds every time, so they carry the
    // token URI and the image, while IPFS keeps the immutable copy referenced by
    // `image_ipfs` and served through the verify page.
    const artworkBase = `${env.API_PUBLIC_URL.replace(/\/$/, '')}/v1/certificates/artwork/${cert.id}`;
    const certificateImageUrl = `${artworkBase}/certificate.png`;

    const metadata = buildCertificateMetadata({
      certificateId: cert.id,
      studentWallet,
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
      // `image` apunta a la API, igual que lo que sirve el endpoint publico.
      //
      // Se probo declararla por pasarela IPFS y rompio la emision entera:
      // assertPublishedMetadata compara campo a campo lo que la API devuelve
      // contra lo que se fijo en IPFS, y el endpoint reconstruye `image` desde
      // `certificateImageUrl` --la URL de la API-- que se guarda unas lineas
      // mas abajo. Las dos nunca coincidian, asi que cada certificado fallaba
      // con "La metadata publicada no coincide con la fijada en IPFS".
      //
      // El CID de la imagen no se pierde: viaja en `image_ipfs`, y quien
      // quiera la copia inmutable la tiene ahi.
      imageUrl: certificateImageUrl,
      imageIpfsUri: `ipfs://${imageCid}`,
      externalUrl: `${env.AUTH_URL}/verify?certificateId=${cert.id}`,
    });
    const metadataBytes = Buffer.from(JSON.stringify(metadata));
    const metadataCid = computeRawCidV1(metadataBytes);

    // El pinning se espera ANTES del mint.
    //
    // Corria en paralelo mientras el tokenURI apuntaba a nuestra API, que
    // responde siempre. Ahora apunta a una pasarela IPFS --porque es lo unico
    // que los exploradores leen-- y acunar antes de que Pinata confirme
    // dejaria al indexador pidiendo un CID que todavia no resuelve. Un
    // indexador lo intenta una vez y cachea el fallo, de modo que el
    // certificado quedaria sin imagen de forma permanente pese a ser valido.
    //
    // El coste es menor de lo que parece: para un CIDv1 raw --el nuestro--
    // assertPinnedAsset verifica por direccionamiento de contenido y vuelve sin
    // esperar a ninguna pasarela.
    const pinning = Promise.all([
      uploadAsset({
        data: certificatePng,
        name: `certificate-${cert.id}.png`,
        contentType: 'image/png',
        stagingKey: `certificates/${cert.id}/certificate.png`,
      }),
      uploadAsset({
        data: metadataBytes,
        name: `certificate-${cert.id}-metadata.json`,
        contentType: 'application/json',
        stagingKey: `certificates/${cert.id}/metadata.json`,
      }),
    ]).then(async ([image, meta]) => {
      // El CID devuelto debe coincidir con el que derivamos localmente; si no,
      // Pinata fijo bytes distintos de los que emitimos.
      if (image.ipfsCid !== imageCid) {
        throw new Error(
          `Pinata devolvio ${image.ipfsCid ?? 'ningun CID'} para la imagen; se esperaba ${imageCid}`,
        );
      }
      if (meta.ipfsCid !== metadataCid) {
        throw new Error(
          `Pinata devolvio ${meta.ipfsCid ?? 'ningun CID'} para la metadata; se esperaba ${metadataCid}`,
        );
      }
      const [imageProof, metadataProof] = await Promise.all([
        assertPinnedAsset({ cid: imageCid, data: certificatePng, contentType: 'image/png' }),
        assertPinnedAsset({
          cid: metadataCid,
          data: metadataBytes,
          contentType: 'application/json',
        }),
      ]);
      return { image, meta, imageProof, metadataProof };
    });

    // Se recoge aqui, antes de acunar: el tokenURI depende de que el CID este
    // fijado. Un fallo no invalida nada todavia --el token aun no existe-- y
    // deja caer la emision a la URL de la API, que siempre responde.
    const pinnedBeforeMint = await pinning.catch((err: unknown) => {
      logger.warn(
        { certificateId: cert.id, err: err instanceof Error ? err.message : String(err) },
        'El pin IPFS no se completo antes del mint; el tokenURI usara la API',
      );
      return null;
    });

    /**
     * A donde apunta el tokenURI que queda grabado on-chain.
     *
     * La pasarela IPFS es la unica forma de que un explorador lea la metadata:
     * medido contra Snowtrace, un tokenURI en nuestro dominio deja la ficha del
     * token vacia y el mismo contenido por pasarela la dibuja completa.
     *
     * Si el pin no se completo no hay CID al que apuntar, y entonces vale mas
     * un certificado legible solo por nuestra API que uno ilegible para todos:
     * el mint es irreversible y no admite corregirlo despues.
     */
    const apiTokenUri = `${env.API_PUBLIC_URL.replace(/\/$/, '')}/v1/certificates/metadata/${cert.id}`;
    const gatewayTokenUri = pinnedBeforeMint
      ? `${getPrimaryIpfsGateway()}/ipfs/${metadataCid}`
      : null;

    /**
     * Cada explorador lee un origen distinto, y no hay uno que sirva a ambos.
     *
     * Medido el 2026-09-12 sobre los mismos contratos y la misma metadata:
     *
     *   PolygonScan  lee tessera.blokis.dev  y rechaza las pasarelas de Pinata
     *   Snowtrace    lee las pasarelas       y rechaza tessera.blokis.dev
     *
     * No es cuestion de latencia --se probo la pasarela dedicada, que responde
     * en 64 ms, y PolygonScan la ignora igual-- ni de usar una pasarela
     * "conocida": nuestros CID devuelven 504 en ipfs.io, dweb.link y w3s.link,
     * porque el contenido solo esta anclado en Pinata.
     *
     * Asi que el tokenURI se elige por cadena. Ambas describen la misma
     * credencial byte a byte; lo unico que cambia es desde donde se sirve, y
     * eso es precisamente lo que decide si el certificado se ve.
     */
    const tokenUri = apiTokenUri;
    const mirrorTokenUri = gatewayTokenUri ?? apiTokenUri;
    const baseStorageMetadata = {
      ...((cert.metadata as Record<string, unknown> | null) ?? {}),
      certificateImageUrl,
      certificateFullImageUrl: certificateImageUrl,
      certificateBundleIpfsCid: null,
      certificateImageIpfsPath: null,
      certificatePreviewIpfsPath: null,
      certificateMetadataIpfsPath: null,
      certificateImageIpfsCid: imageCid,
      certificateMetadataIpfsCid: metadataCid,
      certificatePreviewIpfsCid: null,
      certificatePreviewArweaveTxId: null,
      certificatePreviewSha256: null,
      pinataPreviewFileId: null,
    };
    // Se persisten las referencias derivables de nuestros propios bytes antes
    // del mint, para que un explorador que reaccione al evento Transfer no
    // observe metadata incompleta. Las que dependen de Pinata (ids de archivo,
    // Arweave) se completan al recoger el pinning, mas abajo.
    await db
      .update(schema.certificates)
      .set({
        ipfsCid: metadataCid,
        tokenUri,
        metadata: baseStorageMetadata,
        issuedAt: new Date(issuedAt),
      })
      .where(eq(schema.certificates.id, cert.id));
    await assertPublishedMetadata(tokenUri, metadata);
    const storageReadyAt = Date.now();

    // EIP-712 sign + envio via AutoIssuer
    const signer = await getSigner();

    const onchainApproved = await chainClients.publicClient.readContract({
      address: contractAddresses.registry,
      abi: registryAbi,
      functionName: 'isApprovedInstitution',
      args: [institution.walletAddress as Address],
    });
    if (!onchainApproved) {
      throw new Error(
        `La wallet institucional ${institution.walletAddress} no esta aprobada en TesseraRegistry on-chain. ` +
          'Un owner del Registry debe ejecutar approveInstitution antes de emitir.',
      );
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    const { tokenId, txHash, blockNumber, gasUsed } = await withNonceLock(
      institution.walletAddress as Address,
      async (nonce) => {
        const domain = buildIssuanceDomain({
          verifyingContract: contractAddresses.autoIssuer,
          chainId: env.POLYGON_CHAIN_ID,
        });
        const message = {
          student: studentWallet as Address,
          institution: institution.walletAddress as Address,
          uri: tokenUri,
          nonce,
          deadline,
        };
        const signature = await signer.signTypedData({
          domain,
          types: ISSUANCE_TYPES,
          primaryType: 'IssuancePayload',
          message,
        });

        if (!signer.account) {
          throw new Error('Signer de emisión no disponible');
        }

        const walletClient = createWalletClient({
          account: signer.account,
          chain: chainClients.chain,
          transport: createRpcTransport(env.POLYGON_RPC_URL, env.POLYGON_RPC_URL_FALLBACK),
        });

        const { request } = await chainClients.publicClient.simulateContract({
          address: contractAddresses.autoIssuer,
          abi: autoIssuerAbi,
          functionName: 'triggerIssuance',
          args: [message, signature],
          account: signer.account,
        });
        const hash = await walletClient.writeContract(request);
        const receipt = await chainClients.publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 2,
        });

        // Extract the token ID from the authoritative AutoIssuer event.
        let extracted: bigint | undefined;
        for (const log of receipt.logs) {
          try {
            if (log.address.toLowerCase() !== contractAddresses.autoIssuer.toLowerCase()) continue;
            const decoded = decodeEventLog({
              abi: autoIssuerAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === 'IssuanceTriggered') {
              if (
                decoded.args.student.toLowerCase() !== studentWallet.toLowerCase() ||
                decoded.args.institution.toLowerCase() !==
                  institution.walletAddress.toLowerCase() ||
                decoded.args.nonce !== nonce ||
                decoded.args.uri !== tokenUri
              ) {
                throw new Error('IssuanceTriggered no coincide con la emision firmada');
              }
              extracted = decoded.args.certificateTokenId;
              break;
            }
          } catch (err) {
            if (
              err instanceof Error &&
              err.message.includes('no coincide con la emision firmada')
            ) {
              throw err;
            }
            /* ignore unrelated logs */
          }
        }
        if (extracted === undefined) {
          throw new Error('AutoIssuer no emitió el evento IssuanceTriggered esperado');
        }
        const [owner, onchainTokenUri, locked] = await Promise.all([
          chainClients.publicClient.readContract({
            address: contractAddresses.certificate,
            abi: certificateAbi,
            functionName: 'ownerOf',
            args: [extracted],
          }),
          chainClients.publicClient.readContract({
            address: contractAddresses.certificate,
            abi: certificateAbi,
            functionName: 'tokenURI',
            args: [extracted],
          }),
          chainClients.publicClient.readContract({
            address: contractAddresses.certificate,
            abi: certificateAbi,
            functionName: 'locked',
            args: [extracted],
          }),
        ]);
        if (owner.toLowerCase() !== studentWallet.toLowerCase()) {
          throw new Error('ownerOf no coincide con la wallet del estudiante');
        }
        if (onchainTokenUri !== tokenUri) {
          throw new Error('tokenURI on-chain no coincide con la metadata validada');
        }
        if (!locked) throw new Error('El certificado emitido no esta bloqueado como SBT');
        return {
          tokenId: extracted,
          txHash: hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        };
      },
    );

    // El pin ya se resolvio antes de acunar, porque el tokenURI depende de el.
    const pinned = pinnedBeforeMint;

    const storageMetadata = {
      ...baseStorageMetadata,
      certificateImageArweaveTxId: pinned?.image.arweaveTxId ?? null,
      certificateImageSha256: pinned?.imageProof.sha256 ?? null,
      metadataSha256: pinned?.metadataProof.sha256 ?? null,
      pinataImageFileId: pinned?.image.pinataFileId ?? null,
      pinataMetadataFileId: pinned?.meta.pinataFileId ?? null,
      ipfsPinned: pinned !== null,
    };

    await db
      .update(schema.certificates)
      .set({
        status: 'issued',
        onchainTokenId: tokenId,
        txHash,
        blockNumber,
        gasUsed,
        arweaveTxId: pinned?.meta.arweaveTxId ?? null,
        ipfsCid: metadataCid,
        tokenUri,
        metadata: storageMetadata,
        issuedAt: new Date(issuedAt),
        completedAt: new Date(),
      })
      .where(eq(schema.certificates.id, cert.id));

    await db
      .update(schema.emissionJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        result: { tokenId: tokenId.toString(), txHash, blockNumber: blockNumber.toString() },
      })
      .where(eq(schema.emissionJobs.publicId, jobPublicId));

    // Replica en redes secundarias. Va despues de marcar el certificado como
    // emitido y sin await sobre su resultado: la red principal ya confirmo, y
    // un fallo aqui no puede invalidar un token que ya existe on-chain.
    for (const mirrorChainId of activeMirrorChainIds()) {
      void mirrorCertificate({
        certificateId: cert.id,
        chainId: mirrorChainId,
        recipient: studentWallet as Address,
        institution: institution.walletAddress as Address,
        // La replica apunta a la pasarela IPFS, no a la API.
        //
        // Es el mismo contenido byte a byte que sirve la red principal, pero
        // Snowtrace no lee un tokenURI alojado en un dominio propio --por
        // rapido que responda-- y deja la ficha del token vacia. Este espejo
        // existe justamente para que el certificado se vea en el explorador,
        // asi que se le da el origen que ese explorador si consulta.
        tokenUri: mirrorTokenUri,
      }).catch(() => {
        /* mirrorCertificate ya registra el fallo y lo persiste */
      });
    }

    // notificar via webhooks
    await enqueueWebhook('certificate.issued', cert.institutionId, {
      event: 'certificate.issued',
      jobId: jobPublicId,
      certificate: {
        certificateId: cert.id,
        tokenId: tokenId.toString(),
        txHash,
        verifyUrl: `${env.AUTH_URL}/verify/${tokenId.toString()}`,
        badgeUrl: null,
        arweaveTx: pinned?.meta.arweaveTxId ?? null,
        ipfsCid: metadataCid,
        studentWallet,
      },
    });
    logger.info(
      {
        certId: cert.id,
        tokenId: tokenId.toString(),
        storageDurationMs: storageReadyAt - processingStartedAt,
        mintDurationMs: Date.now() - storageReadyAt,
        totalDurationMs: Date.now() - processingStartedAt,
        pinProof: pinned
          ? { image: pinned.imageProof.verifiedBy, metadata: pinned.metadataProof.verifiedBy }
          : 'pendiente',
      },
      'Certificado emitido y metadata validada',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const attempts = job.opts.attempts ?? 1;
    const attempt = job.attemptsMade + 1;
    // BullMQ stops retrying an UnrecoverableError right away, so this attempt is
    // the last one and the certificate has to be settled and refunded here.
    const finalAttempt = err instanceof UnrecoverableError || attempt >= attempts;

    await db
      .update(schema.emissionJobs)
      .set({
        status: finalAttempt ? 'failed' : 'queued',
        attempts: attempt,
        lastError: message.slice(0, 1000),
        ...(finalAttempt ? { completedAt: new Date() } : {}),
      })
      .where(eq(schema.emissionJobs.publicId, jobPublicId));

    if (finalAttempt) {
      await db
        .update(schema.certificates)
        .set({ status: 'failed', failureReason: message.slice(0, 1000), completedAt: new Date() })
        .where(eq(schema.certificates.id, cert.id));
      await refundCertificateCredit({
        institutionId: cert.institutionId,
        certificateId: cert.id,
        note: `Emision fallida: ${message}`.slice(0, 240),
      }).catch((refundErr) => {
        logger.error({ err: refundErr, certId: cert.id }, 'Fallo el reembolso de credito');
      });
      await enqueueWebhook('certificate.failed', cert.institutionId, {
        event: 'certificate.failed',
        jobId: jobPublicId,
        certificate: { certificateId: cert.id, failureReason: message },
      });
    }
    throw err;
  }
}

/** An indexer gives up long before our own generous IPFS budget. */
const INDEXER_TIMEOUT_MS = 10_000;

/**
 * Fetches the token URI exactly as an NFT indexer would: one attempt, no retry,
 * a short timeout, and the image straight after. Indexers behave that way and
 * cache the failure, so anything that only answers on a second try is as good
 * as broken. Runs before the mint, so a certificate an explorer could not read
 * never reaches the chain.
 */
async function assertPublishedMetadata(
  tokenUri: string,
  expectedMetadata: Record<string, unknown>,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(tokenUri, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(INDEXER_TIMEOUT_MS),
    });
  } catch (err) {
    // The worker reaches its own public URL through the edge. A transport error
    // says nothing about the metadata, which was already verified byte for byte
    // inside the IPFS bundle, so it must not block an otherwise valid issuance.
    logger.warn({ err, tokenUri }, 'No se pudo releer el token URI publicado');
    return;
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('application/json')) {
    throw new Error(
      `El token URI publicado no devuelve metadata JSON (${response.status} ${contentType})`,
    );
  }
  const metadata = (await response.json()) as Record<string, unknown>;

  const explorerFields = [
    'name',
    'description',
    'image',
    'image_url',
    'image_ipfs',
    'external_url',
    'attributes',
    'files',
    'properties',
  ];
  const mismatchedFields = explorerFields.filter(
    (field) => JSON.stringify(metadata[field]) !== JSON.stringify(expectedMetadata[field]),
  );
  if (mismatchedFields.length > 0) {
    throw new Error(
      `La metadata publicada no coincide con la fijada en IPFS: ${mismatchedFields.join(', ')}`,
    );
  }

  const attributes = metadata.attributes;
  if (!Array.isArray(attributes) || attributes.length === 0) {
    throw new Error('La metadata publicada no expone attributes para los exploradores');
  }
  if (typeof metadata.description !== 'string' || !metadata.description.trim()) {
    throw new Error('La metadata publicada no expone description');
  }

  const imageUrl = metadata.image;
  // Production must publish HTTPS; local development runs the API over plain
  // HTTP, and rejecting that would make the pipeline untestable off-server.
  const validImageUrl =
    typeof imageUrl === 'string' &&
    (isProd ? /^https:\/\//i.test(imageUrl) : /^https?:\/\//i.test(imageUrl));
  if (!validImageUrl) {
    // Deterministic and config-driven: retrying re-renders and re-pins for
    // nothing, so fail now and give the operator the value to correct.
    throw new UnrecoverableError(
      `La metadata publica una imagen no valida (${String(imageUrl)}). ` +
        'Revisa API_PUBLIC_URL: debe ser una URL absoluta con esquema, por ejemplo ' +
        'https://tessera.blokis.dev/backend',
    );
  }
  const startedAt = Date.now();
  const imageResponse = await fetch(imageUrl, {
    headers: { Accept: 'image/png,image/jpeg' },
    signal: AbortSignal.timeout(INDEXER_TIMEOUT_MS),
  });
  const imageType = imageResponse.headers.get('content-type') ?? '';
  const image = Buffer.from(await imageResponse.arrayBuffer());
  const isPng = image.length > 8 && image[0] === 0x89 && image[1] === 0x50;
  const isJpeg =
    image.length > 4 && image[0] === 0xff && image[1] === 0xd8 && image.at(-1) === 0xd9;
  if (!imageResponse.ok || (!isPng && !isJpeg)) {
    throw new Error(
      `La imagen publicada para los exploradores no es una imagen valida (${imageResponse.status} ${imageType})`,
    );
  }
  logger.info(
    { tokenUri, imageUrl, imageMs: Date.now() - startedAt, bytes: image.length },
    'Token URI e imagen respondieron en frio como lo hace un indexador',
  );
}

async function revokeCertificate(job: Job<{ certificateId: string; jobPublicId: string }>) {
  const { certificateId } = job.data;
  const db = getDb();
  const cert = await db.query.certificates.findFirst({
    where: eq(schema.certificates.id, certificateId),
  });
  if (!cert || !cert.onchainTokenId) return;
  const signer = await getSigner();
  if (!signer.account) {
    logger.warn('walletClient no configurado, revocacion solo off-chain');
    return;
  }
  const walletClient = createWalletClient({
    account: signer.account,
    chain: chainClients.chain,
    transport: createRpcTransport(env.POLYGON_RPC_URL, env.POLYGON_RPC_URL_FALLBACK),
  });
  const { request } = await chainClients.publicClient.simulateContract({
    address: contractAddresses.certificate,
    abi: certificateAbi,
    functionName: 'revoke',
    args: [cert.onchainTokenId, cert.revokeReason ?? 'unspecified'],
    account: signer.account,
  });
  const hash = await walletClient.writeContract(request);
  await chainClients.publicClient.waitForTransactionReceipt({ hash });
  await db
    .update(schema.certificates)
    .set({ revokeTxHash: hash })
    .where(eq(schema.certificates.id, cert.id));
  await enqueueWebhook('certificate.revoked', cert.institutionId, {
    event: 'certificate.revoked',
    jobId: job.data.jobPublicId,
    certificate: {
      certificateId: cert.id,
      tokenId: cert.onchainTokenId.toString(),
      revokeTxHash: hash,
      revokedAt: new Date().toISOString(),
    },
  });
}

async function enqueueWebhook(
  eventType: string,
  institutionId: string,
  payload: Record<string, unknown>,
) {
  const db = getDb();
  const endpoints = await db.query.webhookEndpoints.findMany({
    where: eq(schema.webhookEndpoints.institutionId, institutionId),
  });
  for (const ep of endpoints) {
    if (!ep.events.includes(eventType) || ep.disabledAt) continue;
    const eventId = `evt_${nanoid(20)}`;
    const expiresAt = new Date(Date.now() + env.WEBHOOK_TTL_DAYS * 86_400_000);
    const [row] = await db
      .insert(schema.webhookEvents)
      .values({
        eventId,
        eventType,
        endpointId: ep.id,
        institutionId,
        payload,
        targetUrl: ep.url,
        status: 'pending',
        expiresAt,
      })
      .returning();
    await queues.webhook.add('deliver', { webhookEventId: row!.id });
  }
  void createHmac;
}
