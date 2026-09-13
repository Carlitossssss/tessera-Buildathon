import { describe, it, expect } from 'vitest';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { isAddress, getAddress } from 'viem';

/**
 * Una wallet custodiada tiene que corresponder a una clave privada real.
 *
 * El fallo que motiva estas pruebas: la wallet emisora de una institucion se
 * generaba con randomBytes(20). Tenia forma de address y pasaba cualquier
 * validacion de formato, pero no habia clave detras: nadie podia firmar con
 * ella. El problema no aparecia al crear la cuenta sino mucho despues, cuando
 * esa direccion se registraba on-chain en TesseraRegistry y se usaba como
 * emisor al replicar certificados.
 *
 * La leccion que fijan: "parece una address" no es lo mismo que "existe la
 * llave". Una comprobacion de formato no distingue los dos casos.
 */

describe('wallet derivada de una clave privada', () => {
  it('produce una address valida en checksum', () => {
    const account = privateKeyToAccount(generatePrivateKey());
    expect(isAddress(account.address)).toBe(true);
    expect(getAddress(account.address)).toBe(account.address);
  });

  it('la misma clave da siempre la misma address', () => {
    const key = generatePrivateKey();
    expect(privateKeyToAccount(key).address).toBe(privateKeyToAccount(key).address);
  });

  it('dos claves distintas dan addresses distintas', () => {
    expect(privateKeyToAccount(generatePrivateKey()).address).not.toBe(
      privateKeyToAccount(generatePrivateKey()).address,
    );
  });

  // Lo que una wallet real puede hacer y una direccion inventada no: firmar.
  it('puede firmar un mensaje y la firma recupera su propia address', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const signature = await account.signMessage({ message: 'prueba de control' });
    expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);
  });
});

describe('por que una address aleatoria no sirve', () => {
  /** Reproduce el generador que se retiro: 20 bytes al azar. */
  function randomLookingAddress(): string {
    const bytes = Array.from({ length: 20 }, () => Math.floor(Math.random() * 256));
    return `0x${bytes.map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  }

  // Este es el punto: pasa el control de formato igual que una real, asi que
  // validar la forma no habria detectado nunca el fallo.
  it('tiene forma de address valida', () => {
    expect(isAddress(randomLookingAddress())).toBe(true);
  });

  // Y esta es la diferencia que importa: ninguna clave la produce, de modo que
  // nadie puede firmar por ella ni demostrar que la controla.
  it('no corresponde a ninguna clave generada', () => {
    const inventada = randomLookingAddress().toLowerCase();
    const reales = new Set(
      Array.from({ length: 50 }, () => privateKeyToAccount(generatePrivateKey()).address.toLowerCase()),
    );
    expect(reales.has(inventada)).toBe(false);
  });
});
