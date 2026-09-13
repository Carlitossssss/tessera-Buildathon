'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Conexion minima a la wallet del navegador (EIP-1193).
 *
 * El portal solo necesita tres cosas: saber la address, poder cambiar de red y
 * firmar un mensaje. Hablar directo con el proveedor inyectado evita arrastrar
 * un connector kit entero y no toca la configuracion existente de la app.
 */

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/**
 * Datos de red para `wallet_addEthereumChain`.
 *
 * Incluye HashKey Chain (133) aunque Unlock no este desplegado ahi: la wallet
 * tambien necesita esa red para ver el certificado emitido. Que una red este
 * aqui no la habilita como red de Lock; eso lo decide UNLOCK_NETWORKS en el
 * backend, que rechaza cualquier chainId no soportado.
 */
const CHAIN_PARAMS: Record<
  number,
  {
    chainName: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    rpcUrls: string[];
    blockExplorerUrls: string[];
  }
> = {
  11155111: {
    chainName: 'Ethereum Sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  84532: {
    chainName: 'Base Sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia.base.org'],
    blockExplorerUrls: ['https://sepolia.basescan.org'],
  },
  43113: {
    chainName: 'Avalanche Fuji',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
    blockExplorerUrls: ['https://testnet.snowtrace.io'],
  },
  133: {
    chainName: 'HashKey Chain Testnet',
    nativeCurrency: { name: 'HashKey', symbol: 'HSK', decimals: 18 },
    rpcUrls: ['https://testnet.hsk.xyz'],
    blockExplorerUrls: ['https://testnet-explorer.hsk.xyz'],
  },
};

export interface WalletState {
  address: string | null;
  chainId: number | null;
  connecting: boolean;
  available: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    connecting: false,
    available: false,
    error: null,
  });

  // La deteccion va en un efecto: en el servidor no existe window.ethereum y
  // leerlo durante el render provocaria un desajuste de hidratacion.
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;

    setState((s) => ({ ...s, available: true }));

    void provider
      .request({ method: 'eth_accounts' })
      .then(async (accounts) => {
        const list = accounts as string[];
        if (!list?.length) return;
        const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string;
        setState((s) => ({ ...s, address: list[0]!, chainId: Number.parseInt(chainIdHex, 16) }));
      })
      .catch(() => {
        /* sin sesion previa: no es un error que deba mostrarse */
      });

    const onAccounts = (...args: never[]) => {
      const accounts = args[0] as unknown as string[];
      setState((s) => ({ ...s, address: accounts?.[0] ?? null }));
    };
    const onChain = (...args: never[]) => {
      const chainIdHex = args[0] as unknown as string;
      setState((s) => ({ ...s, chainId: Number.parseInt(chainIdHex, 16) }));
    };

    provider.on?.('accountsChanged', onAccounts);
    provider.on?.('chainChanged', onChain);
    return () => {
      provider.removeListener?.('accountsChanged', onAccounts);
      provider.removeListener?.('chainChanged', onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) {
      setState((s) => ({ ...s, error: 'No encontramos una wallet en este navegador.' }));
      return null;
    }

    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
      const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string;
      const address = accounts[0] ?? null;
      setState({
        address,
        chainId: Number.parseInt(chainIdHex, 16),
        connecting: false,
        available: true,
        error: null,
      });
      return address;
    } catch (err) {
      const message =
        (err as { code?: number }).code === 4001
          ? 'Cancelaste la conexión.'
          : 'No pudimos conectar la wallet.';
      setState((s) => ({ ...s, connecting: false, error: message }));
      return null;
    }
  }, []);

  /**
   * Cambia a la red del Lock. Si la wallet no la conoce (error 4902) la
   * agregamos primero: el visitante no tiene por que configurarla a mano.
   */
  const switchChain = useCallback(async (chainId: number) => {
    const provider = window.ethereum;
    if (!provider) return false;

    const hex = `0x${chainId.toString(16)}`;
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
      return true;
    } catch (err) {
      if ((err as { code?: number }).code === 4902 && CHAIN_PARAMS[chainId]) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId: hex, ...CHAIN_PARAMS[chainId] }],
          });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }, []);

  /** Firma el mensaje de propiedad. El backend recupera la address de aqui. */
  const signMessage = useCallback(async (message: string, address: string) => {
    const provider = window.ethereum;
    if (!provider) return null;
    try {
      return (await provider.request({
        method: 'personal_sign',
        params: [message, address],
      })) as string;
    } catch {
      return null;
    }
  }, []);

  return { ...state, connect, switchChain, signMessage };
}

export function chainName(chainId: number | null): string {
  if (chainId === null) return 'desconocida';
  return CHAIN_PARAMS[chainId]?.chainName ?? `chain ${chainId}`;
}
