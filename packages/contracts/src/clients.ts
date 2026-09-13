import {
  createPublicClient,
  createWalletClient,
  fallback as fallbackTransport,
  http,
  type Account,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem';
import { polygon, polygonAmoy, foundry } from 'viem/chains';

export type SupportedChain = 'polygon' | 'polygonAmoy' | 'localhost';

export function getChain(name: SupportedChain): Chain {
  switch (name) {
    case 'polygon':
      return polygon;
    case 'polygonAmoy':
      return polygonAmoy;
    case 'localhost':
      return foundry;
  }
}

export interface ChainClientsOptions {
  rpcUrl: string;
  fallbackRpcUrl?: string;
  chain: SupportedChain;
  account?: Account;
}

export interface ChainClients {
  chain: Chain;
  publicClient: PublicClient<Transport, Chain>;
  walletClient?: WalletClient<Transport, Chain, Account>;
}

export function createRpcTransport(rpcUrl: string, fallbackRpcUrl?: string): Transport {
  const options = {
    batch: true,
    retryCount: 3,
    retryDelay: 150,
    timeout: 10_000,
  } as const;
  const primary = http(rpcUrl, options);
  const secondaryUrl = fallbackRpcUrl?.trim();
  if (!secondaryUrl || secondaryUrl === rpcUrl) return primary;

  return fallbackTransport([primary, http(secondaryUrl, options)]);
}

export function createChainClients(opts: ChainClientsOptions): ChainClients {
  const chain = getChain(opts.chain);
  const transport = createRpcTransport(opts.rpcUrl, opts.fallbackRpcUrl);

  // Amoy y Polygon cierran bloque cada ~2s. El sondeo por defecto de viem es de
  // 4s, asi que esperar el recibo costaba hasta un bloque entero de mas.
  const publicClient = createPublicClient({ chain, transport, pollingInterval: 1_000 });

  const walletClient = opts.account
    ? createWalletClient({ chain, transport, account: opts.account })
    : undefined;

  return { chain, publicClient, walletClient };
}
