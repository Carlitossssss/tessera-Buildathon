import {
  createPublicClient,
  http,
  fallback,
  getAddress,
  verifyMessage,
  type Address,
  type PublicClient,
} from 'viem';
import { sepolia, baseSepolia, base, polygon, avalanche, avalancheFuji } from 'viem/chains';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Verificacion de membresias de Unlock Protocol.
 *
 * El bounty exige que la membresia determine realmente el acceso, no que sea
 * un adorno. Por eso esta comprobacion vive en el servidor: el contenido
 * completo no sale de la API sin una llave valida, de modo que no hay nada que
 * saltarse desde el navegador.
 *
 * Unlock solo esta desplegado en las redes de abajo. Polygon Amoy y Avalanche
 * Fuji no son de ellas, asi que las membresias viven en Sepolia o Base Sepolia
 * mientras los certificados siguen en la red que use cada institucion.
 */

/** ABI minimo de PublicLock. Solo lo que necesitamos para autorizar. */
const PUBLIC_LOCK_ABI = [
  {
    type: 'function',
    name: 'getHasValidKey',
    stateMutability: 'view',
    inputs: [{ name: '_keyOwner', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: '_keyOwner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'keyExpirationTimestampFor',
    stateMutability: 'view',
    inputs: [{ name: '_keyOwner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'keyPrice', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'expirationDuration',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  /**
   * Quien manda en el Lock: fija el precio, la duracion y puede regalar
   * llaves. Se lee para avisar cuando la direccion pegada pertenece a otro,
   * que es el error caro de esta pantalla --los pagos irian a esa wallet--.
   */
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  /** Llaves vendidas. Da confianza al reconocer un Lock que ya funciona. */
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'maxNumberOfKeys',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  /** Version de PublicLock. Sirve para saber que es un Lock de verdad. */
  {
    type: 'function',
    name: 'publicLockVersion',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16' }],
  },
] as const;

interface UnlockNetwork {
  chain: (typeof baseSepolia)['id'] extends never ? never : Parameters<typeof createPublicClient>[0]['chain'];
  rpcUrls: string[];
  label: string;
  /** URL del checkout de Unlock para comprar la membresia. */
  checkoutBase: string;
}

/**
 * Redes donde Unlock esta desplegado y que soportamos. La lista es explicita a
 * proposito: un chainId no soportado debe fallar en validacion, no intentar
 * una llamada contra una cadena donde el Lock no existe.
 */
const UNLOCK_NETWORKS: Record<number, UnlockNetwork> = {
  [sepolia.id]: {
    chain: sepolia,
    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.org'],
    label: 'Ethereum Sepolia',
    checkoutBase: 'https://app.unlock-protocol.com/checkout',
  },
  [baseSepolia.id]: {
    chain: baseSepolia,
    rpcUrls: ['https://sepolia.base.org'],
    label: 'Base Sepolia',
    checkoutBase: 'https://app.unlock-protocol.com/checkout',
  },
  [base.id]: {
    chain: base,
    rpcUrls: ['https://mainnet.base.org'],
    label: 'Base',
    checkoutBase: 'https://app.unlock-protocol.com/checkout',
  },
  [polygon.id]: {
    chain: polygon,
    rpcUrls: ['https://polygon-bor-rpc.publicnode.com'],
    label: 'Polygon',
    checkoutBase: 'https://app.unlock-protocol.com/checkout',
  },
  [avalanche.id]: {
    chain: avalanche,
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
    label: 'Avalanche',
    checkoutBase: 'https://app.unlock-protocol.com/checkout',
  },
  [avalancheFuji.id]: {
    chain: avalancheFuji,
    rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
    label: 'Avalanche Fuji',
    checkoutBase: 'https://app.unlock-protocol.com/checkout',
  },
};

export function isSupportedUnlockChain(chainId: number): boolean {
  return chainId in UNLOCK_NETWORKS;
}

export function supportedUnlockChainIds(): number[] {
  return Object.keys(UNLOCK_NETWORKS).map(Number);
}

export function unlockNetworkLabel(chainId: number): string {
  return UNLOCK_NETWORKS[chainId]?.label ?? `chain ${chainId}`;
}

/** Clientes cacheados por red: crear uno por request desperdicia conexiones. */
const clients = new Map<number, PublicClient>();

function clientFor(chainId: number): PublicClient {
  const cached = clients.get(chainId);
  if (cached) return cached;

  const network = UNLOCK_NETWORKS[chainId];
  if (!network) throw new Error(`Unlock no esta soportado en la red ${chainId}`);

  // Un RPC propio en env tiene prioridad; los publicos quedan como respaldo.
  const override = env.UNLOCK_RPC_URL.trim();
  const urls = override ? [override, ...network.rpcUrls] : network.rpcUrls;

  const client = createPublicClient({
    chain: network.chain,
    transport: fallback(urls.map((url) => http(url, { timeout: 10_000 }))),
  }) as PublicClient;

  clients.set(chainId, client);
  return client;
}

export interface MembershipStatus {
  /** Unica fuente de verdad para autorizar. */
  hasValidKey: boolean;
  walletAddress: Address;
  lockAddress: Address;
  chainId: number;
  network: string;
  /** Expiracion de la llave, si la tiene. */
  expiresAt: Date | null;
  /** Llaves que posee la wallet (una expirada sigue contando en balanceOf). */
  keyCount: number;
}

/**
 * Comprueba on-chain si una wallet tiene membresia valida para un Lock.
 *
 * `getHasValidKey` ya contempla la expiracion, asi que es la llamada que
 * decide. `balanceOf` solo se usa para informar, porque cuenta tambien las
 * llaves vencidas y autorizar con el dejaria pasar membresias caducadas.
 */
export async function checkMembership(input: {
  lockAddress: string;
  chainId: number;
  walletAddress: string;
}): Promise<MembershipStatus> {
  const lockAddress = getAddress(input.lockAddress);
  const walletAddress = getAddress(input.walletAddress);
  const client = clientFor(input.chainId);

  const [validResult, balanceResult, expirationResult] = await Promise.allSettled([
    client.readContract({
      address: lockAddress,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'getHasValidKey',
      args: [walletAddress],
    }),
    client.readContract({
      address: lockAddress,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'balanceOf',
      args: [walletAddress],
    }),
    client.readContract({
      address: lockAddress,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'keyExpirationTimestampFor',
      args: [walletAddress],
    }),
  ]);

  // Si la lectura de autorizacion falla, negamos el acceso: ante un RPC caido
  // preferimos un falso negativo antes que regalar contenido de pago.
  if (validResult.status !== 'fulfilled') {
    logger.warn(
      { err: validResult.reason, lockAddress, chainId: input.chainId },
      'No se pudo leer getHasValidKey; se deniega el acceso',
    );
    return {
      hasValidKey: false,
      walletAddress,
      lockAddress,
      chainId: input.chainId,
      network: unlockNetworkLabel(input.chainId),
      expiresAt: null,
      keyCount: 0,
    };
  }

  const keyCount = balanceResult.status === 'fulfilled' ? Number(balanceResult.value) : 0;

  let expiresAt: Date | null = null;
  if (expirationResult.status === 'fulfilled') {
    const ts = expirationResult.value as bigint;
    // Unlock usa uint256 max para llaves sin expiracion.
    if (ts > 0n && ts < BigInt(Number.MAX_SAFE_INTEGER)) {
      expiresAt = new Date(Number(ts) * 1000);
    }
  }

  return {
    hasValidKey: validResult.value === true,
    walletAddress,
    lockAddress,
    chainId: input.chainId,
    network: unlockNetworkLabel(input.chainId),
    expiresAt,
    keyCount,
  };
}

export interface LockInfo {
  address: Address;
  chainId: number;
  network: string;
  name: string | null;
  /** Precio en wei; la moneda depende de la red del Lock. */
  keyPriceWei: string | null;
  /** Duracion de la membresia en segundos; 0 significa que no expira. */
  expirationDuration: number | null;
  checkoutUrl: string;
  /**
   * Quien manda en el Lock.
   *
   * Fija el precio, la duracion y puede regalar llaves. Se lee para poder
   * avisar cuando la direccion pegada pertenece a otro: ese es el error caro
   * de esta configuracion, porque los pagos irian a esa otra wallet y sus
   * miembros entrarian gratis.
   */
  owner: Address | null;
  /** Llaves vendidas. Un Lock que ya vendio se reconoce de un vistazo. */
  totalSupply: number | null;
  /** Tope de llaves; 0 o un valor enorme significan "sin tope". */
  maxNumberOfKeys: number | null;
  /** Version de PublicLock. Si no responde, no es un Lock de Unlock. */
  publicLockVersion: number | null;
  /**
   * Si hay codigo desplegado en esa direccion.
   *
   * Distingue una wallet de un contrato. Es la diferencia entre decir "no se
   * pudo leer, puede ser la red" --que culpa al RPC-- y decir "esa es una
   * wallet, no el Lock", que es el error real y el mas frecuente aqui.
   *
   * `null` cuando la comprobacion misma fallo.
   */
  hasCode: boolean | null;
}

/**
 * Lee los datos publicos del Lock para mostrar precio y duracion en el portal
 * antes de que el visitante decida comprar.
 */
export async function getLockInfo(lockAddress: string, chainId: number): Promise<LockInfo> {
  const address = getAddress(lockAddress);
  const client = clientFor(chainId);
  const network = UNLOCK_NETWORKS[chainId];

  // Cada lectura tolera su propio fallo: un Lock antiguo puede no exponer
  // alguno de estos metodos, y perder el precio por eso dejaria la pantalla
  // sin lo importante. `owner` y `publicLockVersion` son los que permiten
  // distinguir un Lock de verdad de una direccion cualquiera.
  const [
    nameResult,
    priceResult,
    durationResult,
    ownerResult,
    supplyResult,
    maxKeysResult,
    versionResult,
    codeResult,
  ] = await Promise.allSettled([
    client.readContract({ address, abi: PUBLIC_LOCK_ABI, functionName: 'name' }),
    client.readContract({ address, abi: PUBLIC_LOCK_ABI, functionName: 'keyPrice' }),
    client.readContract({ address, abi: PUBLIC_LOCK_ABI, functionName: 'expirationDuration' }),
    client.readContract({ address, abi: PUBLIC_LOCK_ABI, functionName: 'owner' }),
    client.readContract({ address, abi: PUBLIC_LOCK_ABI, functionName: 'totalSupply' }),
    client.readContract({ address, abi: PUBLIC_LOCK_ABI, functionName: 'maxNumberOfKeys' }),
    client.readContract({ address, abi: PUBLIC_LOCK_ABI, functionName: 'publicLockVersion' }),
    // Una wallet no tiene codigo. Es lo que separa "esa direccion es tu
    // wallet, no el Lock" --el error mas frecuente de esta pantalla-- de un
    // fallo de red, que son dos consejos opuestos.
    client.getBytecode({ address }),
  ]);

  /** Un uint256 que no cabe en Number se recorta; aqui solo se muestra. */
  const asNumber = (result: PromiseSettledResult<unknown>): number | null => {
    if (result.status !== 'fulfilled') return null;
    const value = Number(result.value as bigint);
    return Number.isFinite(value) ? value : null;
  };

  return {
    address,
    owner: ownerResult.status === 'fulfilled' ? (ownerResult.value as Address) : null,
    totalSupply: asNumber(supplyResult),
    maxNumberOfKeys: asNumber(maxKeysResult),
    publicLockVersion: asNumber(versionResult),
    // Sin codigo desplegado es una wallet. `null` cuando la comprobacion
    // misma fallo: eso no autoriza a afirmar que no haya contrato.
    hasCode:
      codeResult.status === 'fulfilled'
        ? Boolean(codeResult.value && codeResult.value !== '0x')
        : null,
    chainId,
    network: unlockNetworkLabel(chainId),
    name: nameResult.status === 'fulfilled' ? (nameResult.value as string) : null,
    keyPriceWei: priceResult.status === 'fulfilled' ? (priceResult.value as bigint).toString() : null,
    expirationDuration:
      durationResult.status === 'fulfilled' ? Number(durationResult.value as bigint) : null,
    checkoutUrl: buildCheckoutUrl(address, chainId, network?.checkoutBase),
  };
}

/**
 * URL del checkout alojado por Unlock. Es el camino de compra que el bounty
 * exige ofrecer cuando el visitante todavia no tiene membresia.
 */
export function buildCheckoutUrl(
  lockAddress: string,
  chainId: number,
  checkoutBase = 'https://app.unlock-protocol.com/checkout',
): string {
  const paywallConfig = {
    locks: { [getAddress(lockAddress)]: { network: chainId } },
    pessimistic: true,
    skipRecipient: true,
  };
  const params = new URLSearchParams({ paywallConfig: JSON.stringify(paywallConfig) });
  return `${checkoutBase}?${params.toString()}`;
}


/**
 * Prueba de propiedad de la wallet.
 *
 * Consultar el Lock dice si UNA wallet tiene membresia, no si quien pregunta
 * es su duenno. Sin esta comprobacion bastaria con poner la address de un
 * suscriptor en la query para leer contenido de pago ajeno. Por eso el
 * visitante firma un mensaje con nonce y caducidad, y solo entregamos el
 * contenido si la firma recupera exactamente esa address.
 */
const OWNERSHIP_TTL_MS = 5 * 60 * 1000;
/** Separador del mensaje que firma el visitante. */
const MESSAGE_NEWLINE = '\n';

export function buildOwnershipMessage(input: {
  walletAddress: string;
  slug: string;
  issuedAt: number;
}): string {
  return [
    'Tessera Portal: prueba de propiedad de wallet',
    `Wallet: ${getAddress(input.walletAddress)}`,
    `Contenido: ${input.slug}`,
    `Emitido: ${new Date(input.issuedAt).toISOString()}`,
    'Firmar no cuesta gas ni autoriza ningun pago.',
  ].join(MESSAGE_NEWLINE);
}

/**
 * Ambito de la firma para un curso.
 *
 * El mensaje que firma el visitante incluye este texto, asi que una firma
 * hecha para un contenido del portal no sirve para matricularse en un curso
 * --ni la de un curso para otro--. Sin este acotamiento, una firma capturada
 * en un sitio podria reutilizarse en el otro dentro de su ventana de validez.
 */
export function membershipScope(courseId: string): string {
  return `course:${courseId}`;
}

export interface OwnershipProof {
  walletAddress: string;
  slug: string;
  issuedAt: number;
  signature: string;
}

/**
 * Devuelve true solo si la firma corresponde a la wallet declarada y el
 * mensaje sigue vigente. Una firma vieja no sirve: acota la ventana en la que
 * una prueba filtrada podria reutilizarse.
 */
export async function verifyWalletOwnership(proof: OwnershipProof): Promise<boolean> {
  const age = Date.now() - proof.issuedAt;
  if (!Number.isFinite(proof.issuedAt) || age < -60_000 || age > OWNERSHIP_TTL_MS) {
    return false;
  }

  let address: Address;
  try {
    address = getAddress(proof.walletAddress);
  } catch {
    return false;
  }

  const message = buildOwnershipMessage({
    walletAddress: address,
    slug: proof.slug,
    issuedAt: proof.issuedAt,
  });

  try {
    return await verifyMessage({
      address,
      message,
      signature: proof.signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

/** Comprueba que la direccion tenga forma de Lock antes de guardarla. */
export function normalizeLockAddress(value: string): Address {
  return getAddress(value.trim());
}

/** Moneda nativa de cada red soportada, para poner precio a la membresia. */
const NATIVE_CURRENCY: Record<number, string> = {
  [sepolia.id]: 'ETH',
  [baseSepolia.id]: 'ETH',
  [base.id]: 'ETH',
  [polygon.id]: 'POL',
  [avalanche.id]: 'AVAX',
  [avalancheFuji.id]: 'AVAX',
};

/**
 * Precio de la llave, listo para mostrar.
 *
 * Un Lock gratuito tiene keyPrice 0, y eso no es lo mismo que no haber podido
 * leerlo: el primero se anuncia como "Gratis" --que invita a entrar-- y el
 * segundo no se anuncia. Por eso null y 0 se tratan distinto.
 *
 * Se recorta a seis decimales y se limpian los ceros finales porque un precio
 * como "0.010000 ETH" se lee peor que "0.01 ETH", y en un boton de compra la
 * cifra tiene que entenderse de un vistazo.
 */
export function formatKeyPrice(weiValue: string | null, chainId: number): string | null {
  if (weiValue === null) return null;

  let wei: bigint;
  try {
    wei = BigInt(weiValue);
  } catch {
    return null;
  }

  const symbol = NATIVE_CURRENCY[chainId] ?? '';
  if (wei === 0n) return 'Gratis';

  const whole = wei / 10n ** 18n;
  const fraction = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
  const amount = fraction ? `${whole}.${fraction}` : whole.toString();
  return symbol ? `${amount} ${symbol}` : amount;
}
