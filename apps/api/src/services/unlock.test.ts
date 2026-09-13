import { describe, it, expect } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import {
  buildCheckoutUrl,
  buildOwnershipMessage,
  verifyWalletOwnership,
  isSupportedUnlockChain,
  normalizeLockAddress,
  supportedUnlockChainIds,
  unlockNetworkLabel,
} from './unlock.js';

const LOCK = '0x259813B665C8f6074391028ef782e27B65840d89';
const BASE_SEPOLIA = 84532;

describe('redes soportadas por Unlock', () => {
  it('acepta Base Sepolia, la unica testnet donde Unlock esta desplegado', () => {
    expect(isSupportedUnlockChain(BASE_SEPOLIA)).toBe(true);
  });

  // Polygon Amoy es la red de los certificados, pero Unlock no esta ahi: si lo
  // aceptaramos, la verificacion llamaria a un contrato inexistente.
  it('rechaza Polygon Amoy', () => {
    expect(isSupportedUnlockChain(80002)).toBe(false);
  });

  it('rechaza una red inventada', () => {
    expect(isSupportedUnlockChain(999999)).toBe(false);
  });

  it('expone la lista de redes soportadas', () => {
    const ids = supportedUnlockChainIds();
    expect(ids).toContain(BASE_SEPOLIA);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('etiqueta las redes conocidas y degrada con las desconocidas', () => {
    expect(unlockNetworkLabel(BASE_SEPOLIA)).toBe('Base Sepolia');
    expect(unlockNetworkLabel(999999)).toBe('chain 999999');
  });
});

describe('normalizeLockAddress', () => {
  it('devuelve la direccion en checksum EIP-55', () => {
    expect(normalizeLockAddress(LOCK.toLowerCase())).toBe(LOCK);
  });

  it('tolera espacios alrededor', () => {
    expect(normalizeLockAddress(`  ${LOCK}  `)).toBe(LOCK);
  });

  it('rechaza una direccion invalida', () => {
    expect(() => normalizeLockAddress('0x123')).toThrow();
    expect(() => normalizeLockAddress('no-es-una-address')).toThrow();
  });
});

describe('buildCheckoutUrl', () => {
  it('arma el checkout de Unlock con el lock y la red', () => {
    const url = buildCheckoutUrl(LOCK, BASE_SEPOLIA);
    expect(url.startsWith('https://app.unlock-protocol.com/checkout?')).toBe(true);

    const config = JSON.parse(new URL(url).searchParams.get('paywallConfig')!);
    expect(config.locks[LOCK]).toEqual({ network: BASE_SEPOLIA });
  });

  // pessimistic espera la confirmacion on-chain antes de dar por comprada la
  // llave; sin eso el portal podria desbloquear antes de que la compra exista.
  it('espera la confirmacion on-chain de la compra', () => {
    const config = JSON.parse(
      new URL(buildCheckoutUrl(LOCK, BASE_SEPOLIA)).searchParams.get('paywallConfig')!,
    );
    expect(config.pessimistic).toBe(true);
  });

  it('normaliza la direccion del lock en la configuracion', () => {
    const config = JSON.parse(
      new URL(buildCheckoutUrl(LOCK.toLowerCase(), BASE_SEPOLIA)).searchParams.get('paywallConfig')!,
    );
    expect(Object.keys(config.locks)[0]).toBe(LOCK);
  });
});

describe('prueba de propiedad de wallet', () => {
  // Cuenta determinista de Anvil: la firma es reproducible en cada corrida.
  const account = privateKeyToAccount(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  );
  const slug = 'curso-solidity-abc123';

  async function sign(issuedAt: number, overrides: Partial<{ slug: string }> = {}) {
    const message = buildOwnershipMessage({
      walletAddress: account.address,
      slug: overrides.slug ?? slug,
      issuedAt,
    });
    return account.signMessage({ message });
  }

  it('acepta una firma valida y reciente', async () => {
    const issuedAt = Date.now();
    const signature = await sign(issuedAt);
    await expect(
      verifyWalletOwnership({ walletAddress: account.address, slug, issuedAt, signature }),
    ).resolves.toBe(true);
  });

  // El ataque que esto evita: pedir contenido con la address de un suscriptor.
  it('rechaza una firma valida presentada para otra wallet', async () => {
    const issuedAt = Date.now();
    const signature = await sign(issuedAt);
    await expect(
      verifyWalletOwnership({
        walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        slug,
        issuedAt,
        signature,
      }),
    ).resolves.toBe(false);
  });

  it('rechaza una firma reutilizada en otro contenido', async () => {
    const issuedAt = Date.now();
    const signature = await sign(issuedAt, { slug: 'otro-contenido-xyz' });
    await expect(
      verifyWalletOwnership({ walletAddress: account.address, slug, issuedAt, signature }),
    ).resolves.toBe(false);
  });

  it('rechaza una firma vencida', async () => {
    const issuedAt = Date.now() - 10 * 60 * 1000;
    const signature = await sign(issuedAt);
    await expect(
      verifyWalletOwnership({ walletAddress: account.address, slug, issuedAt, signature }),
    ).resolves.toBe(false);
  });

  it('rechaza una firma con fecha futura', async () => {
    const issuedAt = Date.now() + 10 * 60 * 1000;
    const signature = await sign(issuedAt);
    await expect(
      verifyWalletOwnership({ walletAddress: account.address, slug, issuedAt, signature }),
    ).resolves.toBe(false);
  });

  it('rechaza una firma corrupta sin lanzar', async () => {
    await expect(
      verifyWalletOwnership({
        walletAddress: account.address,
        slug,
        issuedAt: Date.now(),
        signature: '0xdeadbeef',
      }),
    ).resolves.toBe(false);
  });
});
