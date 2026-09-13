import { describe, it, expect } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { getAddress } from 'viem';
import { buildOwnershipMessage, membershipScope, verifyWalletOwnership } from './unlock.js';

/**
 * El mensaje de propiedad se construye en dos sitios --servidor y navegador--
 * y debe coincidir byte a byte. Si difiere, verifyMessage recupera otra
 * address y TODA firma se rechaza: el curso token-gated quedaria imposible de
 * matricular sin ningun error que explique por que.
 *
 * Estas pruebas fijan el formato y, sobre todo, comprueban que el
 * acotamiento por curso realmente impide reutilizar una firma.
 */

const account = privateKeyToAccount(
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
);
const COURSE_A = '11111111-1111-4111-8111-111111111111';
const COURSE_B = '22222222-2222-4222-8222-222222222222';

async function sign(scope: string, issuedAt: number, address = account.address) {
  const message = buildOwnershipMessage({ walletAddress: address, slug: scope, issuedAt });
  return account.signMessage({ message });
}

describe('ambito de la firma', () => {
  it('distingue un curso de otro', () => {
    expect(membershipScope(COURSE_A)).not.toBe(membershipScope(COURSE_B));
  });

  // El portal firma con el slug del contenido; los cursos con "course:<id>".
  // Asi una firma de un sitio no vale en el otro.
  it('no colisiona con el slug de un contenido del portal', () => {
    expect(membershipScope(COURSE_A)).toBe(`course:${COURSE_A}`);
    expect(membershipScope(COURSE_A)).not.toBe(COURSE_A);
  });
});

describe('verificacion de la firma de matricula', () => {
  it('acepta una firma valida y reciente', async () => {
    const issuedAt = Date.now();
    const signature = await sign(membershipScope(COURSE_A), issuedAt);

    await expect(
      verifyWalletOwnership({
        walletAddress: account.address,
        slug: membershipScope(COURSE_A),
        issuedAt,
        signature,
      }),
    ).resolves.toBe(true);
  });

  // El caso que justifica el acotamiento: una firma capturada para el curso A
  // no debe abrir el curso B.
  it('rechaza una firma emitida para otro curso', async () => {
    const issuedAt = Date.now();
    const signature = await sign(membershipScope(COURSE_A), issuedAt);

    await expect(
      verifyWalletOwnership({
        walletAddress: account.address,
        slug: membershipScope(COURSE_B),
        issuedAt,
        signature,
      }),
    ).resolves.toBe(false);
  });

  it('rechaza una firma de otra wallet', async () => {
    const issuedAt = Date.now();
    const other = privateKeyToAccount(
      '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
    );
    const signature = await sign(membershipScope(COURSE_A), issuedAt);

    await expect(
      verifyWalletOwnership({
        walletAddress: other.address,
        slug: membershipScope(COURSE_A),
        issuedAt,
        signature,
      }),
    ).resolves.toBe(false);
  });

  // Acota la ventana en la que una firma filtrada podria reutilizarse.
  it('rechaza una firma vieja', async () => {
    const issuedAt = Date.now() - 10 * 60 * 1000;
    const signature = await sign(membershipScope(COURSE_A), issuedAt);

    await expect(
      verifyWalletOwnership({
        walletAddress: account.address,
        slug: membershipScope(COURSE_A),
        issuedAt,
        signature,
      }),
    ).resolves.toBe(false);
  });

  it('rechaza una firma con fecha futura', async () => {
    const issuedAt = Date.now() + 5 * 60 * 1000;
    const signature = await sign(membershipScope(COURSE_A), issuedAt);

    await expect(
      verifyWalletOwnership({
        walletAddress: account.address,
        slug: membershipScope(COURSE_A),
        issuedAt,
        signature,
      }),
    ).resolves.toBe(false);
  });
});

describe('formato del mensaje entre servidor y navegador', () => {
  // El servidor normaliza a checksum. Si el navegador firma con la address en
  // minusculas --como la devuelven varias wallets-- el texto debe seguir
  // siendo el mismo, o ninguna firma validaria jamas.
  it('normaliza la address para que minusculas y checksum produzcan el mismo texto', () => {
    const issuedAt = 1789300000000;
    const checksum = buildOwnershipMessage({
      walletAddress: account.address,
      slug: membershipScope(COURSE_A),
      issuedAt,
    });
    const lower = buildOwnershipMessage({
      walletAddress: account.address.toLowerCase(),
      slug: membershipScope(COURSE_A),
      issuedAt,
    });
    expect(lower).toBe(checksum);
  });

  it('valida la firma aunque la wallet se declare en minusculas', async () => {
    const issuedAt = Date.now();
    const signature = await sign(membershipScope(COURSE_A), issuedAt);

    await expect(
      verifyWalletOwnership({
        walletAddress: account.address.toLowerCase(),
        slug: membershipScope(COURSE_A),
        issuedAt,
        signature,
      }),
    ).resolves.toBe(true);
  });
});

/**
 * Paridad exacta con el navegador.
 *
 * El mensaje se construye en dos sitios y debe coincidir byte a byte. Esta
 * copia reproduce el del cliente (apps/web/src/lib/portal/api.ts) para que, si
 * alguien cambia uno de los dos, la prueba falle aqui en vez de en produccion
 * con un "firma invalida" que no explica nada.
 *
 * El fallo real que motivo esto: el servidor normalizaba a checksum y el
 * navegador no. MetaMask entrega la address en minusculas, asi que los textos
 * diferian y TODA firma se rechazaba.
 */
function clientBuildOwnershipMessage(input: {
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
  ].join(String.fromCharCode(10));
}

describe('paridad del mensaje entre navegador y servidor', () => {
  const issuedAt = 1789600000000;

  it('produce el mismo texto con la address en minusculas', () => {
    const lower = account.address.toLowerCase();
    expect(clientBuildOwnershipMessage({ walletAddress: lower, slug: membershipScope(COURSE_A), issuedAt })).toBe(
      buildOwnershipMessage({ walletAddress: lower, slug: membershipScope(COURSE_A), issuedAt }),
    );
  });

  it('produce el mismo texto con la address en checksum', () => {
    expect(
      clientBuildOwnershipMessage({ walletAddress: account.address, slug: membershipScope(COURSE_A), issuedAt }),
    ).toBe(buildOwnershipMessage({ walletAddress: account.address, slug: membershipScope(COURSE_A), issuedAt }));
  });

  // El caso exacto que fallaba: la wallet firma lo que arma el navegador y el
  // servidor verifica contra lo que arma el.
  it('el servidor acepta una firma hecha sobre el mensaje del navegador', async () => {
    const lower = account.address.toLowerCase();
    const now = Date.now();
    const signature = await account.signMessage({
      message: clientBuildOwnershipMessage({
        walletAddress: lower,
        slug: membershipScope(COURSE_A),
        issuedAt: now,
      }),
    });

    await expect(
      verifyWalletOwnership({
        walletAddress: lower,
        slug: membershipScope(COURSE_A),
        issuedAt: now,
        signature,
      }),
    ).resolves.toBe(true);
  });
});
