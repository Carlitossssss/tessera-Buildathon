import Redlock from 'redlock';
import { createRedis } from '../lib/redis.js';
import { createChainClients, autoIssuerAbi, loadAddresses } from '@tessera/contracts';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { Address } from 'viem';

// El AutoIssuer exige un nonce estrictamente creciente por institucion, de modo
// que las emisiones de una misma institucion son secuenciales por diseno. En un
// lote grande solo compiten los jobs activos (la concurrencia del worker), no la
// cola entera, asi que el presupuesto de espera cubre esa ventana con holgura en
// lugar de rendirse a los dos segundos y fallar la emision.
const redlock = new Redlock([createRedis({ maxRetriesPerRequest: null })], {
  retryCount: 1_200,
  retryDelay: 300,
  retryJitter: 200,
});

export const chainClients = createChainClients({
  chain: env.POLYGON_CHAIN as 'polygon' | 'polygonAmoy' | 'localhost',
  rpcUrl: env.POLYGON_RPC_URL,
  fallbackRpcUrl: env.POLYGON_RPC_URL_FALLBACK,
});

const addresses = loadAddresses(process.env);

export async function fetchOnchainNonce(institution: Address): Promise<bigint> {
  return chainClients.publicClient.readContract({
    address: addresses.autoIssuer,
    abi: autoIssuerAbi,
    functionName: 'nonces',
    args: [institution],
  });
}

/**
 * Adquiere un lock por-institucion y entrega el nonce on-chain actual.
 */
export async function withNonceLock<T>(
  institutionAddress: Address,
  fn: (nonce: bigint) => Promise<T>,
): Promise<T> {
  const key = `nonce:${institutionAddress.toLowerCase()}`;
  const lock = await redlock.acquire([key], 180_000);
  try {
    const nonce = await fetchOnchainNonce(institutionAddress);
    logger.debug({ institution: institutionAddress, nonce: nonce.toString() }, 'Nonce adquirido');
    return await fn(nonce);
  } finally {
    await lock
      .release()
      .catch((err: unknown) => logger.warn({ err }, 'Error liberando lock nonce'));
  }
}

export { addresses as contractAddresses };
