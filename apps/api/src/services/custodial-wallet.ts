import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { env } from '../config/env.js';

export async function provisionCustodialWallet() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  if (env.NODE_ENV === 'test') return account.address;
  if (!env.OPENBAO_URL || !env.OPENBAO_CUSTODY_TOKEN) {
    throw new Error('OPENBAO_URL y OPENBAO_CUSTODY_TOKEN son requeridos para crear una wallet custodiada');
  }

  const keyPath = `${env.OPENBAO_CUSTODY_KEY_PATH.replace(/\/+$/, '')}/${account.address.toLowerCase()}`;
  const response = await fetch(
    `${env.OPENBAO_URL.replace(/\/$/, '')}/v1/${keyPath.replace(/^\/+/, '')}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Token': env.OPENBAO_CUSTODY_TOKEN,
      },
      body: JSON.stringify({ data: { private_key: privateKey } }),
    },
  );
  if (!response.ok) {
    // 503 casi siempre significa que OpenBao esta sellado: arranca asi tras
    // cada reinicio del contenedor y responde 503 a todo hasta el unseal. Sin
    // esta pista el log solo dice "503" y el operador busca en el lugar
    // equivocado (red, token, permisos).
    const hint =
      response.status === 503
        ? ' (probablemente sellado: ejecutar `bao operator unseal` y reiniciar web3signer)'
        : '';
    throw new Error(
      `OpenBao no pudo guardar la wallet custodiada: ${response.status}${hint}`,
    );
  }
  return account.address;
}
