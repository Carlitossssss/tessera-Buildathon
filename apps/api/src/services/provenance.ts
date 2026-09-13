import { createPublicClient, fallback, getAddress, http, type Address, type PublicClient } from 'viem';
import { certificateAbi, registryAbi } from '@tessera/contracts';
import { networkFor, nftUrlFor, type TesseraNetwork } from '../config/networks.js';
import { logger } from '../lib/logger.js';

/**
 * Procedencia on-chain de un certificado.
 *
 * Un diploma es un activo del mundo real: existe fuera de la cadena y alguien
 * concreto responde por el. Para que sea auditable no basta con que el token
 * exista; hay que poder contestar tres preguntas SIN pasar por Tessera:
 *
 *   1. Quien lo emitio          -> certificateIssuer(tokenId)
 *   2. Estaba autorizado        -> isApprovedInstitution(issuer)
 *   3. Puede haberse vendido    -> locked(tokenId)  (ERC-5192)
 *
 * Las tres se leen del contrato. Si nuestra API desapareciera manana, la
 * respuesta seguiria estando disponible para cualquiera con un RPC, que es
 * exactamente lo que una cadena orientada a RWA necesita poder demostrar.
 */

/** RPC publicos por red. El primero que responda gana. */
const RPC_URLS: Record<number, string[]> = {
  133: ['https://testnet.hsk.xyz'],
  80002: ['https://polygon-amoy-bor-rpc.publicnode.com', 'https://rpc-amoy.polygon.technology'],
  43113: [
    'https://avalanche-fuji-c-chain-rpc.publicnode.com',
    'https://api.avax-test.network/ext/bc/C/rpc',
  ],
  11155111: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.org'],
};

/** Un cliente por red: crear uno por request desperdicia conexiones. */
const clients = new Map<number, PublicClient>();

function clientFor(network: TesseraNetwork): PublicClient | null {
  const cached = clients.get(network.chainId);
  if (cached) return cached;

  const urls = RPC_URLS[network.chainId];
  if (!urls?.length) return null;

  const chain = {
    id: network.chainId,
    name: network.name,
    nativeCurrency: { name: network.currency, symbol: network.currency, decimals: 18 },
    rpcUrls: { default: { http: urls } },
    blockExplorers: { default: { name: 'Explorer', url: network.explorer } },
  } as const;

  const client = createPublicClient({
    chain,
    transport: fallback(urls.map((url) => http(url, { timeout: 10_000 }))),
  }) as PublicClient;

  clients.set(network.chainId, client);
  return client;
}

export interface CertificateProvenance {
  chainId: number;
  network: string;
  tokenId: string;
  /** Wallet que acuño el certificado, leida del contrato. */
  issuer: string | null;
  /** El registro on-chain reconoce a ese emisor como institucion aprobada. */
  issuerApproved: boolean | null;
  /** ERC-5192: true significa que el token no puede transferirse. */
  soulbound: boolean | null;
  /** Wallet que posee el certificado ahora mismo. */
  owner: string | null;
  explorerUrl: string;
  /** Comandos para que un tercero repita la lectura por su cuenta. */
  verifyCommands: string[];
  /** Motivo por el que alguna lectura no pudo hacerse. */
  unavailableReason?: string;
}

/**
 * Lee la procedencia directamente del contrato.
 *
 * Cada lectura va por separado y se tolera el fallo individual: un contrato
 * antiguo puede no exponer `certificateIssuer`, y en ese caso preferimos
 * devolver lo que si se pudo leer antes que un error completo.
 */
export async function readCertificateProvenance(input: {
  chainId: number;
  tokenId: string;
}): Promise<CertificateProvenance | null> {
  const network = networkFor(input.chainId);
  if (!network) return null;

  const explorerBase = network.explorer.replace(/\/$/, '');
  const base: CertificateProvenance = {
    chainId: network.chainId,
    network: network.name,
    tokenId: input.tokenId,
    issuer: null,
    issuerApproved: null,
    soulbound: null,
    owner: null,
    // La ficha del token concreto, no la del contrato: quien abre la
    // procedencia viene a mirar un certificado, no la coleccion entera.
    explorerUrl:
      nftUrlFor(network.chainId, network.contracts.certificate, input.tokenId) ??
      `${explorerBase}/token/${network.contracts.certificate}`,
    verifyCommands: buildVerifyCommands(network, input.tokenId),
  };

  const client = clientFor(network);
  if (!client) {
    return { ...base, unavailableReason: 'No hay un RPC publico configurado para esta red.' };
  }

  let tokenId: bigint;
  try {
    tokenId = BigInt(input.tokenId);
  } catch {
    return null;
  }

  const certificate = network.contracts.certificate as Address;

  const [issuerResult, ownerResult, lockedResult] = await Promise.allSettled([
    client.readContract({
      address: certificate,
      abi: certificateAbi,
      functionName: 'certificateIssuer',
      args: [tokenId],
    }),
    client.readContract({
      address: certificate,
      abi: certificateAbi,
      functionName: 'ownerOf',
      args: [tokenId],
    }),
    client.readContract({
      address: certificate,
      abi: certificateAbi,
      functionName: 'locked',
      args: [tokenId],
    }),
  ]);

  const issuer = issuerResult.status === 'fulfilled' ? (issuerResult.value as Address) : null;
  const owner = ownerResult.status === 'fulfilled' ? (ownerResult.value as Address) : null;
  const soulbound = lockedResult.status === 'fulfilled' ? (lockedResult.value as boolean) : null;

  if (issuerResult.status === 'rejected') {
    logger.warn(
      { err: issuerResult.reason, chainId: network.chainId, tokenId: input.tokenId },
      'No se pudo leer certificateIssuer',
    );
  }

  // El emisor solo se contrasta contra el registro si se pudo leer: preguntar
  // por una direccion nula devolveria false y sugeriria que el emisor no esta
  // aprobado, cuando en realidad no llegamos a saber quien es.
  let issuerApproved: boolean | null = null;
  if (issuer) {
    try {
      issuerApproved = (await client.readContract({
        address: network.contracts.registry as Address,
        abi: registryAbi,
        functionName: 'isApprovedInstitution',
        args: [getAddress(issuer)],
      })) as boolean;
    } catch (err) {
      logger.warn({ err, chainId: network.chainId }, 'No se pudo consultar el registro');
    }
  }

  return {
    ...base,
    issuer,
    issuerApproved,
    soulbound,
    owner,
    ...(issuer ? {} : { unavailableReason: 'El contrato no expone el emisor de este token.' }),
  };
}

/**
 * Comandos que reproducen la lectura sin usar Tessera.
 *
 * Son parte de la respuesta a proposito: una afirmacion de procedencia que
 * solo puede comprobarse con nuestra propia API no prueba gran cosa. Con esto
 * cualquiera --un jurado, un empleador, un regulador-- repite la consulta
 * contra la cadena y llega al mismo resultado.
 */
function buildVerifyCommands(network: TesseraNetwork, tokenId: string): string[] {
  const rpc = RPC_URLS[network.chainId]?.[0] ?? '<rpc>';
  const cert = network.contracts.certificate;
  const registry = network.contracts.registry;
  return [
    `cast call ${cert} "certificateIssuer(uint256)(address)" ${tokenId} --rpc-url ${rpc}`,
    `cast call ${registry} "isApprovedInstitution(address)(bool)" <emisor> --rpc-url ${rpc}`,
    `cast call ${cert} "locked(uint256)(bool)" ${tokenId} --rpc-url ${rpc}`,
  ];
}
