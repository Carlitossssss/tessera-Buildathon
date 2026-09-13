import { networkFor, nftUrlFor } from '../../config/networks.js';

export interface CertificatePresenterInput {
  id: string;
  studentEmail: string;
  studentName: string;
  studentWallet: string | null;
  achievementName: string;
  achievementDescription: string | null;
  grade: number | null;
  courseId: string | null;
  status: string;
  onchainTokenId: bigint | null;
  txHash: string | null;
  blockNumber: bigint | null;
  arweaveTxId: string | null;
  ipfsCid: string | null;
  tokenUri: string | null;
  metadata?: Record<string, unknown> | null;
  issuedAt: Date | null;
  revokedAt: Date | null;
  revokeReason: string | null;
  createdAt: Date;
}

export interface InstitutionPresenterInput {
  name: string;
  walletAddress: string;
  /** Identificador publico, para enlazar su acreditacion on-chain. */
  slug?: string;
}

interface CertificatePresenterOptions {
  appUrl: string;
  apiPublicUrl: string;
  network: string;
  arweaveGateway: string;
  ipfsGateway: string;
  certificateContractAddress: string;
  /** Red de emision. Decide en que explorador se abren los enlaces. */
  chainId: number;
  /**
   * Replicas del certificado en otras cadenas.
   *
   * La verificacion publica solo hablaba de la red de emision, asi que una
   * copia existente en Avalanche no aparecia por ningun lado y quien abria la
   * pagina no tenia como llegar a ella.
   */
  mirrors?: CertificateMirrorPresenterInput[];
}

export interface CertificateMirrorPresenterInput {
  chainId: number;
  status: string;
  onchainTokenId: bigint | null;
  txHash: string | null;
}

function safeBigint(value: bigint | null | undefined): number | string | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) ? numeric : value.toString();
}

function polygonscanBase(network: string): string {
  return network === 'polygon' ? 'https://polygonscan.com' : 'https://amoy.polygonscan.com';
}

function artworkUrl(options: CertificatePresenterOptions, tokenId: string | null): string | null {
  return tokenId
    ? `${options.apiPublicUrl}/v1/certificates/artwork/${tokenId}/certificate.png`
    : null;
}

function verifyUrl(appUrl: string, tokenId: string | null): string | null {
  return tokenId ? `${appUrl}/verify/${tokenId}` : null;
}

function storedImageUrl(
  cert: CertificatePresenterInput,
  options: CertificatePresenterOptions,
): string | null {
  const value = cert.metadata?.certificateImageUrl;
  if (typeof value !== 'string') return null;
  if (value.startsWith('https://ipfs.io/ipfs/')) {
    return `https://dweb.link/ipfs/${value.slice('https://ipfs.io/ipfs/'.length)}`;
  }
  if (value.startsWith('ipfs://')) {
    return `${options.ipfsGateway}/ipfs/${value.slice('ipfs://'.length)}`;
  }
  return value;
}

function storedImageIpfsCid(cert: CertificatePresenterInput): string | null {
  const value = cert.metadata?.certificateImageIpfsCid;
  return typeof value === 'string' ? value : null;
}

function storedImageIpfsPath(cert: CertificatePresenterInput): string | null {
  const bundle = cert.metadata?.certificateBundleIpfsCid;
  if (typeof bundle === 'string') return `${bundle}/certificate.png`;
  return storedImageIpfsCid(cert);
}

/**
 * Direct IPFS links to the two files a certificate is made of. Both are plain
 * `/ipfs/<cid>` URLs with no directory path, which is what public gateways and
 * NFT indexers resolve most reliably.
 */
function ipfsFiles(cert: CertificatePresenterInput, options: CertificatePresenterOptions) {
  const metadataCid =
    typeof cert.metadata?.certificateMetadataIpfsCid === 'string'
      ? cert.metadata.certificateMetadataIpfsCid
      : cert.ipfsCid;
  const imageCid = storedImageIpfsCid(cert);
  if (!metadataCid && !imageCid) return null;
  const gateway = options.ipfsGateway;
  return {
    ...(metadataCid
      ? {
          metadataCid,
          metadataUri: `ipfs://${metadataCid}`,
          metadataUrl: `${gateway}/ipfs/${metadataCid}`,
        }
      : {}),
    ...(imageCid
      ? {
          imageCid,
          imageUri: `ipfs://${imageCid}`,
          imageUrl: `${gateway}/ipfs/${imageCid}`,
        }
      : {}),
  };
}

export function buildCertificateTrackingResponse(
  apiPublicUrl: string,
  jobId: string,
  certificateId: string,
) {
  return {
    certificateId,
    jobId,
    status: 'queued',
    estimatedCompletionSeconds: 30,
    trackingUrl: `${apiPublicUrl}/v1/jobs/${jobId}`,
  };
}

export function buildCertificateListResponse(
  rows: CertificatePresenterInput[],
  page: number,
  limit: number,
  total: number,
) {
  return {
    data: rows.map((row) => ({
      certificateId: row.id,
      tokenId: row.onchainTokenId?.toString() ?? null,
      studentEmail: row.studentEmail,
      studentName: row.studentName,
      achievementName: row.achievementName,
      courseId: row.courseId,
      status: row.status,
      txHash: row.txHash,
      issuedAt: row.issuedAt,
      createdAt: row.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
  };
}

export function buildCertificateDetailResponse(
  cert: CertificatePresenterInput,
  institution: InstitutionPresenterInput,
  options: CertificatePresenterOptions,
) {
  const tokenId = cert.onchainTokenId?.toString() ?? null;
  const polygonscanUrl = cert.txHash
    ? `${polygonscanBase(options.network)}/tx/${cert.txHash}`
    : null;
  const imageUrl = artworkUrl(options, tokenId) ?? storedImageUrl(cert, options);

  return {
    tokenId,
    certificateId: cert.id,
    status: cert.status,
    institution: {
      name: institution.name,
      walletAddress: institution.walletAddress,
    },
    student: {
      name: cert.studentName,
      email: cert.studentEmail,
      walletAddress: cert.studentWallet,
    },
    achievement: {
      name: cert.achievementName,
      description: cert.achievementDescription,
      grade: cert.grade,
      courseId: cert.courseId,
      issuedAt: cert.issuedAt,
    },
    metadata: {
      tokenUri: cert.tokenUri,
      arweaveTx: cert.arweaveTxId,
      ipfsCid: cert.ipfsCid,
      imageUrl,
      imageIpfsCid: storedImageIpfsPath(cert),
      ipfsFiles: ipfsFiles(cert, options),
    },
    blockchain: {
      network: options.network,
      txHash: cert.txHash,
      blockNumber: safeBigint(cert.blockNumber),
      polygonscanUrl,
    },
    revokedAt: cert.revokedAt,
    revokeReason: cert.revokeReason,
    verifyUrl: verifyUrl(options.appUrl, tokenId),
    badgeUrl: null,
  };
}

export function buildCertificateVerificationResponse(
  cert: CertificatePresenterInput,
  institution: InstitutionPresenterInput,
  valid: boolean,
  options: CertificatePresenterOptions,
) {
  const tokenId = cert.onchainTokenId?.toString() ?? null;
  const polygonscanUrl = cert.txHash
    ? `${polygonscanBase(options.network)}/tx/${cert.txHash}`
    : null;
  const fallbackArtworkUrl = artworkUrl(options, tokenId);

  return {
    valid,
    certificate: {
      tokenId,
      institution: institution.name,
      achievement: cert.achievementName,
      description:
        cert.achievementDescription ??
        `Certificado de ${cert.achievementName} otorgado a ${cert.studentName} por ${institution.name}.`,
      studentName: cert.studentName,
      grade: cert.grade,
      issuedAt: cert.issuedAt,
      studentWallet: cert.studentWallet,
      issuedByWallet: institution.walletAddress,
      // Permite consultar la acreditacion de quien emitio: un certificado
      // valido de un emisor no acreditado es informacion util, no un detalle.
      institutionSlug: institution.slug ?? null,
    },
    blockchain: {
      confirmed: Boolean(cert.txHash && cert.blockNumber),
      network: options.network,
      blockNumber: safeBigint(cert.blockNumber),
      txHash: cert.txHash,
      polygonscanUrl,
      nftUrl: tokenId
        ? `${polygonscanBase(options.network)}/nft/${options.certificateContractAddress}/${tokenId}`
        : null,
      contractAddress: options.certificateContractAddress,
      contractUrl: `${polygonscanBase(options.network)}/address/${options.certificateContractAddress}`,
      // Autoria auditable sin pasar por Tessera: el contrato guarda la
      // institucion emisora de cada token. Tessera firma y paga el gas, por lo
      // que el pagador no es el emisor.
      issuerOnchainGetter: tokenId ? 'certificateIssuer(uint256)' : null,
      issuerOnchainArgs: tokenId ? [tokenId] : null,
      gasSponsor: 'Tessera',
    },
    storage: {
      arweaveUrl: cert.arweaveTxId ? `${options.arweaveGateway}/${cert.arweaveTxId}` : null,
      ipfsUrl: cert.ipfsCid ? `${options.ipfsGateway}/ipfs/${cert.ipfsCid}` : null,
      imageUrl: fallbackArtworkUrl ?? storedImageUrl(cert, options),
      imageIpfsUrl: storedImageIpfsPath(cert)
        ? `${options.ipfsGateway}/ipfs/${storedImageIpfsPath(cert)}`
        : null,
      downloadUrl: fallbackArtworkUrl ? `${fallbackArtworkUrl}?download=1` : null,
    },
    // Cada red donde vive el certificado, con sus enlaces.
    //
    // La primera es la de emision, que es la que decide su validez; las demas
    // son replicas del mismo contenido. Se publican porque un certificado que
    // existe en Avalanche y no se puede abrir desde aqui es, para quien
    // verifica, un certificado que no existe.
    networks: [
      {
        chainId: options.chainId,
        name: networkFor(options.chainId)?.name ?? options.network,
        role: 'issuance' as const,
        status: cert.txHash ? 'confirmed' : cert.status,
        tokenId,
        nftUrl: tokenId
          ? (nftUrlFor(options.chainId, options.certificateContractAddress, tokenId) ??
            `${polygonscanBase(options.network)}/nft/${options.certificateContractAddress}/${tokenId}`)
          : null,
        txUrl: cert.txHash ? `${polygonscanBase(options.network)}/tx/${cert.txHash}` : null,
        contractUrl: `${polygonscanBase(options.network)}/address/${options.certificateContractAddress}`,
      },
      ...(options.mirrors ?? []).flatMap((mirror) => {
        const net = networkFor(mirror.chainId);
        if (!net) return [];
        const mirrorTokenId = mirror.onchainTokenId?.toString() ?? null;
        const explorer = net.explorer.replace(/\/$/, '');
        return [
          {
            chainId: mirror.chainId,
            name: net.name,
            role: 'mirror' as const,
            status: mirror.status,
            tokenId: mirrorTokenId,
            // El id de la replica no coincide con el de la red principal: cada
            // contrato lleva su propio contador.
            nftUrl: mirrorTokenId
              ? nftUrlFor(mirror.chainId, net.contracts.certificate, mirrorTokenId)
              : null,
            txUrl: mirror.txHash ? `${explorer}/tx/${mirror.txHash}` : null,
            contractUrl: `${explorer}/address/${net.contracts.certificate}`,
          },
        ];
      }),
    ],
    status: valid ? cert.status : 'revoked',
    revokedAt: cert.revokedAt,
    revokeReason: cert.revokeReason,
    verifyUrl: verifyUrl(options.appUrl, tokenId),
  };
}
