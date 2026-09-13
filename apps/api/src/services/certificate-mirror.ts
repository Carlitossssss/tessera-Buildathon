import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type Address,
  type Hex,
} from 'viem';
import { avalancheFuji, sepolia } from 'viem/chains';
import { eq, and, schema } from '@tessera/db';
import { getDb } from '../lib/db.js';
import { env } from '../config/env.js';
import { networkFor } from '../config/networks.js';
import { buildIssuanceDomain, ISSUANCE_TYPES } from '@tessera/contracts';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from '../lib/logger.js';

/**
 * Emision espejo en redes secundarias.
 *
 * El certificado existe cuando la red principal lo confirma. Un espejo es la
 * misma credencial replicada en otra cadena para que pueda verse alli; si
 * falla, el original sigue siendo valido, porque ya esta minteado y un mint no
 * se puede deshacer. Por eso esta ruta nunca lanza hacia el worker principal:
 * registra el fallo y permite reintentar.
 */

/**
 * Cadenas espejo soportadas, con sus RPC en orden de preferencia.
 *
 * Varios endpoints y no uno: el RPC oficial de Avalanche responde 403 a
 * peticiones desde IPs de datacenter, asi que desde el servidor de produccion
 * fallaba aunque funcionara en local. El transporte con respaldo pasa al
 * siguiente en cuanto uno rechaza.
 */
const MIRROR_CHAINS = {
  [avalancheFuji.id]: {
    chain: avalancheFuji,
    rpcUrls: [
      'https://avalanche-fuji-c-chain-rpc.publicnode.com',
      'https://avalanche-fuji.drpc.org',
      'https://api.avax-test.network/ext/bc/C/rpc',
    ],
  },
  [sepolia.id]: {
    chain: sepolia,
    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.org'],
  },
} as const;

/**
 * La replica pasa por el AutoIssuer, igual que la red principal.
 *
 * Llamar `mint()` directamente no funciona: el contrato solo autoriza a la
 * propia institucion, al AutoIssuer o a un profesor aprobado, y el signer del
 * backend no es ninguno de los tres. El AutoIssuer existe justamente para esto:
 * valida una firma EIP-712 del backendSigner y acuña en nombre de la
 * institucion, sin que esta tenga que pagar gas ni custodiar una clave.
 */
const autoIssuerMirrorAbi = [
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'triggerIssuance',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'payload',
        type: 'tuple',
        components: [
          { name: 'student', type: 'address' },
          { name: 'institution', type: 'address' },
          { name: 'uri', type: 'string' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/**
 * Redes espejo activas: las soportadas, menos la principal, y solo si estan
 * declaradas en MIRROR_CHAIN_IDS. Vacio significa no replicar.
 */
export function activeMirrorChainIds(): number[] {
  if (!env.MIRROR_CHAIN_IDS.trim()) return [];
  return env.MIRROR_CHAIN_IDS.split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((id) => Number.isFinite(id) && id !== env.POLYGON_CHAIN_ID && id in MIRROR_CHAINS);
}

/**
 * Resume el error para guardarlo y mostrarlo.
 *
 * viem incluye la peticion JSON-RPC completa en el mensaje, asi que un fallo
 * de envio arrastra la transaccion firmada entera: cientos de caracteres
 * ilegibles donde deberia decir que hacer. Esta funcion extrae la causa y le
 * antepone una accion cuando la reconoce.
 */
/**
 * RPC a usar para una cadena espejo.
 *
 * Los configurados en el entorno van primero y los publicos del codigo quedan
 * de respaldo: asi un proveedor privado resuelve un bloqueo por IP sin
 * necesidad de desplegar, y si ese proveedor cae el sistema sigue funcionando.
 */
function rpcUrlsFor(chainId: number, defaults: readonly string[]): string[] {
  const configured =
    chainId === avalancheFuji.id
      ? env.MIRROR_RPC_URLS_FUJI
      : chainId === sepolia.id
        ? env.MIRROR_RPC_URLS_SEPOLIA
        : '';

  const extra = configured
    .split(',')
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url));

  return [...new Set([...extra, ...defaults])];
}

const NEWLINE = String.fromCharCode(10);

function summarizeMirrorError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const firstLine = raw.split(NEWLINE)[0]?.trim() ?? raw;

  if (/status:\s*403/i.test(raw)) {
    return 'El RPC rechazo la peticion (403): suele ser bloqueo por IP de datacenter. Se reintentara con otro endpoint.';
  }
  if (/status:\s*429/i.test(raw)) {
    return 'El RPC aplico limite de peticiones (429). Reintentar en unos minutos.';
  }
  if (/insufficient funds/i.test(raw)) {
    return 'El signer no tiene saldo en esta red para pagar el gas.';
  }
  if (/nonce/i.test(raw) && /too low|already known/i.test(raw)) {
    return 'Nonce desincronizado con la cadena espejo. Reintentar.';
  }
  if (/execution reverted/i.test(raw)) {
    return 'El contrato rechazo la emision: revisar que la institucion este aprobada en el Registry de esa red.';
  }

  return firstLine.slice(0, 300);
}

export interface MirrorResult {
  chainId: number;
  status: 'confirmed' | 'failed';
  tokenId?: bigint;
  txHash?: Hex;
  blockNumber?: bigint;
  error?: string;
}

/**
 * Replica un certificado ya emitido en una red secundaria.
 *
 * Reutiliza el mismo tokenURI que la red principal: el contenido es identico y
 * apunta a la misma metadata, asi que ambas copias describen la misma
 * credencial. Devuelve el resultado en vez de lanzar, para que el llamador
 * decida (y nunca invalide el original).
 */
export async function mirrorCertificate(input: {
  certificateId: string;
  chainId: number;
  recipient: Address;
  institution: Address;
  tokenUri: string;
}): Promise<MirrorResult> {
  const base = MIRROR_CHAINS[input.chainId as keyof typeof MIRROR_CHAINS];
  const network = networkFor(input.chainId);
  const target = base ? { ...base, rpcUrls: rpcUrlsFor(input.chainId, base.rpcUrls) } : base;

  if (!target || !network) {
    return { chainId: input.chainId, status: 'failed', error: `Red espejo no soportada` };
  }

  // Deja constancia de que RPC se va a usar realmente. Un fallo por bloqueo de
  // IP se diagnostica en el log sin adivinar si la configuracion llego al
  // contenedor: aqui se ve el host efectivo, no el que deberia ser.
  logger.info(
    {
      certificateId: input.certificateId,
      chainId: input.chainId,
      rpcHosts: target.rpcUrls.map((url) => new URL(url).host),
    },
    'Iniciando replica en red espejo',
  );

  const db = getDb();
  await db
    .insert(schema.certificateMirrors)
    .values({ certificateId: input.certificateId, chainId: input.chainId, status: 'queued' })
    .onConflictDoNothing();

  try {
    // Web3Signer arranca con un unico --chain-id (el de la red principal) y
    // rechaza firmar para otra cadena, asi que la replica usa su propia clave.
    // Sin ella no se puede replicar: mejor decirlo que fallar con un error de
    // RPC que no explica nada.
    if (!env.MIRROR_SIGNER_PRIVATE_KEY) {
      throw new Error(
        'Falta MIRROR_SIGNER_PRIVATE_KEY: Web3Signer solo firma para la red principal',
      );
    }
    const account = privateKeyToAccount(
      (env.MIRROR_SIGNER_PRIVATE_KEY.startsWith('0x')
        ? env.MIRROR_SIGNER_PRIVATE_KEY
        : `0x${env.MIRROR_SIGNER_PRIVATE_KEY}`) as Hex,
    );

    // Un solo transporte compartido: si el primer RPC rechaza, ambos clientes
    // pasan al siguiente en la misma lista.
    const transport = fallback(
      target.rpcUrls.map((url) => http(url, { retryCount: 2, retryDelay: 200, timeout: 12_000 })),
      // rank:false mantiene el orden declarado. Con ranking automatico viem
      // reordena por latencia y puede volver a elegir el endpoint que nos
      // rechaza por IP, que responde rapido justamente porque devuelve 403.
      { rank: false, retryCount: 1 },
    );
    // El objeto `chain` de viem lleva embebido su RPC por defecto, que para
    // Fuji es justamente api.avax-test.network. Algunas rutas internas
    // (estimacion de gas, reintentos del wallet client) lo resuelven desde ahi
    // en lugar del transporte, y volvian al endpoint que nos rechaza por IP.
    // Reescribirlo deja una sola fuente de RPC en todo el flujo.
    const chain = {
      ...target.chain,
      rpcUrls: {
        ...target.chain.rpcUrls,
        default: { http: [...target.rpcUrls] },
        public: { http: [...target.rpcUrls] },
      },
    };

    const publicClient = createPublicClient({ chain, transport });
    const walletClient = createWalletClient({
      account,
      chain,
      transport,
    });

    // El nonce se lee de la cadena espejo, no de la principal: cada AutoIssuer
    // lleva su propio contador por institucion.
    const autoIssuer = network.contracts.autoIssuer as Address;
    const nonce = await publicClient.readContract({
      address: autoIssuer,
      abi: autoIssuerMirrorAbi,
      functionName: 'nonces',
      args: [input.institution],
    });

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const payload = {
      student: input.recipient,
      institution: input.institution,
      uri: input.tokenUri,
      nonce,
      deadline,
    };

    const signature = await account.signTypedData({
      domain: buildIssuanceDomain({ verifyingContract: autoIssuer, chainId: input.chainId }),
      types: ISSUANCE_TYPES,
      primaryType: 'IssuancePayload',
      message: payload,
    });

    // Simular antes de gastar gas: un revert aqui (institucion no aprobada,
    // firma invalida) se detecta sin pagar nada.
    const { request } = await publicClient.simulateContract({
      address: autoIssuer,
      abi: autoIssuerMirrorAbi,
      functionName: 'triggerIssuance',
      args: [payload, signature],
      account,
    });

    const hash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

    if (receipt.status !== 'success') {
      throw new Error(`La transaccion revirtio en ${network.name}`);
    }

    // El tokenId sale del log Transfer (topic 3), no de un contador local: el
    // contrato es la autoridad sobre que id asigno.
    const transferLog = receipt.logs.find((log) => log.topics.length === 4);
    const tokenId = transferLog?.topics[3] ? BigInt(transferLog.topics[3]) : null;

    await db
      .update(schema.certificateMirrors)
      .set({
        status: 'confirmed',
        onchainTokenId: tokenId,
        txHash: hash,
        blockNumber: receipt.blockNumber,
        failureReason: null,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.certificateMirrors.certificateId, input.certificateId),
          eq(schema.certificateMirrors.chainId, input.chainId),
        ),
      );

    logger.info(
      { certificateId: input.certificateId, chainId: input.chainId, tokenId: tokenId?.toString() },
      'Certificado replicado en red espejo',
    );

    return {
      chainId: input.chainId,
      status: 'confirmed',
      tokenId: tokenId ?? undefined,
      txHash: hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (err) {
    const message = summarizeMirrorError(err);

    const existing = await db.query.certificateMirrors.findFirst({
      where: and(
        eq(schema.certificateMirrors.certificateId, input.certificateId),
        eq(schema.certificateMirrors.chainId, input.chainId),
      ),
    });

    await db
      .update(schema.certificateMirrors)
      .set({
        status: 'failed',
        failureReason: message.slice(0, 500),
        attempts: (existing?.attempts ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.certificateMirrors.certificateId, input.certificateId),
          eq(schema.certificateMirrors.chainId, input.chainId),
        ),
      );

    // Se registra como aviso, no como error: el certificado principal sigue
    // siendo valido y el espejo puede reintentarse.
    logger.warn(
      { certificateId: input.certificateId, chainId: input.chainId, err: message },
      'Fallo la replica en red espejo; el certificado principal no se ve afectado',
    );

    return { chainId: input.chainId, status: 'failed', error: message };
  }
}
