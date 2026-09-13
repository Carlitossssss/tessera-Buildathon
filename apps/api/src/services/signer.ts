import {
  toHex,
  type Address,
  type Hex,
  type TypedDataDefinition,
  type TypedDataDomain,
  type SignableMessage,
  type Account,
  type TransactionSerializable,
} from 'viem';
import { privateKeyToAccount, toAccount } from 'viem/accounts';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface Signer {
  address: Address;
  account?: Account;
  signMessage: (args: { message: SignableMessage }) => Promise<Hex>;
  signTypedData: <T extends Record<string, unknown>>(
    args: TypedDataDefinition & { message: T; domain: TypedDataDomain },
  ) => Promise<Hex>;
  signDigest: (digest: Hex) => Promise<Hex>;
}

class Web3Signer implements Signer {
  readonly account: Account;

  constructor(
    private readonly baseUrl: string,
    readonly address: Address,
  ) {
    this.account = toAccount({
      address,
      signMessage: (args) => this.signMessage(args),
      signTransaction: (transaction) => this.signTransaction(transaction),
      signTypedData: (args) =>
        this.signTypedData(
          args as unknown as TypedDataDefinition & {
            message: Record<string, unknown>;
            domain: TypedDataDomain;
          },
        ),
    });
  }

  private async request(method: string, params: unknown[]): Promise<Hex> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        { jsonrpc: '2.0', id: 1, method, params },
        (_, value: unknown) => (typeof value === 'bigint' ? toHex(value) : value),
      ),
    });
    const data = (await res.json().catch(() => ({}))) as {
      result?: Hex;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(`Web3Signer ${method} fallo: ${data.error?.message ?? res.status}`);
    }
    if (data.error) throw new Error(`Web3Signer ${method}: ${data.error.message ?? 'error'}`);
    if (!data.result) throw new Error(`Web3Signer ${method} no devolvio firma`);
    return data.result;
  }

  signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
    const value =
      typeof message === 'object' && message !== null && 'raw' in message ? message.raw : message;
    return this.request('eth_sign', [this.address, toHex(value)]);
  }

  signTypedData<T extends Record<string, unknown>>(
    args: TypedDataDefinition & { message: T; domain: TypedDataDomain },
  ): Promise<Hex> {
    const domain = args.domain;
    const domainTypes = [
      ...(domain.name !== undefined ? [{ name: 'name', type: 'string' }] : []),
      ...(domain.version !== undefined ? [{ name: 'version', type: 'string' }] : []),
      ...(domain.chainId !== undefined ? [{ name: 'chainId', type: 'uint256' }] : []),
      ...(domain.verifyingContract !== undefined
        ? [{ name: 'verifyingContract', type: 'address' }]
        : []),
      ...(domain.salt !== undefined ? [{ name: 'salt', type: 'bytes32' }] : []),
    ];
    return this.request('eth_signTypedData', [
      this.address,
      { ...args, types: { EIP712Domain: domainTypes, ...args.types } },
    ]);
  }

  signDigest(_digest: Hex): Promise<Hex> {
    return Promise.reject(
      new Error('Web3Signer no expone firma raw; usar EIP-712 o transacciones'),
    );
  }

  signTransaction(transaction: TransactionSerializable): Promise<Hex> {
    const normalized = JSON.parse(
      JSON.stringify({ ...transaction, from: this.address }, (_, value: unknown) =>
        typeof value === 'bigint' ? toHex(value) : value,
      ),
    );
    return this.request('eth_signTransaction', [normalized]);
  }
}

async function buildWeb3Signer(): Promise<Signer> {
  if (!env.WEB3SIGNER_URL || !env.BACKEND_SIGNER_ADDRESS) {
    throw new Error('WEB3SIGNER_URL y BACKEND_SIGNER_ADDRESS son requeridos');
  }
  const signer = new Web3Signer(env.WEB3SIGNER_URL, env.BACKEND_SIGNER_ADDRESS as Address);
  logger.info({ address: signer.address }, 'Web3Signer inicializado');
  return signer;
}

async function buildOpenBaoSigner(): Promise<Signer> {
  const baseUrl = env.OPENBAO_URL;
  const token = env.OPENBAO_TOKEN;
  const keyPath = env.OPENBAO_SIGNING_KEY_PATH;
  const keyField = env.OPENBAO_SIGNING_KEY_FIELD;
  if (!baseUrl || !token || !keyPath) {
    throw new Error('OPENBAO_URL, OPENBAO_TOKEN y OPENBAO_SIGNING_KEY_PATH son requeridos');
  }

  // Transit no soporta secp256k1. En Fase 1 OpenBao KV v2 protege la clave
  // en reposo y sólo el token de workload puede leerla durante el arranque.
  const path = `/v1/${keyPath.replace(/^\/+/, '')}`;
  const keyRes = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    headers: { 'X-Vault-Token': token },
  });
  if (!keyRes.ok) {
    throw new Error(`OpenBao no devolvio el secreto del signer: ${keyRes.status}`);
  }
  const keyData = (await keyRes.json()) as {
    data?: { data?: Record<string, string> };
  };
  const privateKey = keyData.data?.data?.[keyField];
  if (!privateKey || !/^(0x)?[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error(`OpenBao no devolvio una clave secp256k1 valida en el campo ${keyField}`);
  }
  const signer = new LocalSigner(
    (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Hex,
  );
  if (
    env.BACKEND_SIGNER_ADDRESS &&
    signer.address.toLowerCase() !== env.BACKEND_SIGNER_ADDRESS.toLowerCase()
  ) {
    throw new Error('BACKEND_SIGNER_ADDRESS no coincide con la clave almacenada en OpenBao');
  }
  logger.info({ address: signer.address, keyPath }, 'OpenBao KV signer inicializado');
  return signer;
}

class LocalSigner implements Signer {
  readonly address: Address;
  readonly account: Account;
  constructor(privateKey: Hex) {
    this.account = privateKeyToAccount(privateKey);
    this.address = this.account.address;
  }
  signMessage(args: { message: SignableMessage }) {
    return this.account.signMessage!(args);
  }
  signTypedData<T extends Record<string, unknown>>(
    args: TypedDataDefinition & { message: T; domain: TypedDataDomain },
  ) {
    return this.account.signTypedData!(args);
  }
  async signDigest(digest: Hex): Promise<Hex> {
    return this.account.sign!({ hash: digest });
  }
}

let cached: Promise<Signer> | undefined;

export function getSigner(): Promise<Signer> {
  if (!cached) {
    if (env.WEB3SIGNER_URL) {
      cached = buildWeb3Signer();
    } else if (env.OPENBAO_URL && env.OPENBAO_TOKEN && env.OPENBAO_SIGNING_KEY_PATH) {
      cached = buildOpenBaoSigner();
    } else if (env.SIGNER_PRIVATE_KEY) {
      const pk = env.SIGNER_PRIVATE_KEY.startsWith('0x')
        ? (env.SIGNER_PRIVATE_KEY as Hex)
        : (`0x${env.SIGNER_PRIVATE_KEY}` as Hex);
      cached = Promise.resolve(new LocalSigner(pk));
    } else {
      throw new Error(
        'Debes configurar WEB3SIGNER_URL o uno de: OPENBAO_URL+OPENBAO_TOKEN+OPENBAO_SIGNING_KEY_PATH ' +
          'o SIGNER_PRIVATE_KEY (solo dev)',
      );
    }
  }
  return cached;
}

export function getSignerBackend(): 'web3signer' | 'openbao' | 'local' {
  if (env.WEB3SIGNER_URL) return 'web3signer';
  if (env.OPENBAO_URL && env.OPENBAO_TOKEN && env.OPENBAO_SIGNING_KEY_PATH) return 'openbao';
  return 'local';
}

export { toHex };
