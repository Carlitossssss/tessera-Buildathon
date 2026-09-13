import { describe, it, expect } from 'vitest';
import { normalizeDeclaredWallet, resolveRecipientWallet } from './recipient-wallet.js';

/**
 * La wallet destino de una credencial.
 *
 * Es la decision con mas consecuencias del circuito del portal: si se elige
 * mal, el certificado se acuña en una wallet que el estudiante no controla y
 * el token es soulbound, asi que no hay forma de moverlo despues.
 */

const DECLARED = '0x1111111111111111111111111111111111111111';
const CUSTODIAL = '0x2222222222222222222222222222222222222222';

describe('wallet destino de la credencial', () => {
  // El caso del portal: la wallet que probo la membresia de Unlock debe
  // recibir el certificado. Si ganara la custodiada, la llave estaria en una
  // wallet y la credencial en otra, y el circulo quedaria roto.
  it('prefiere la wallet declarada sobre la custodiada', () => {
    expect(resolveRecipientWallet(DECLARED, CUSTODIAL)).toBe(DECLARED);
  });

  // El caso del panel: la institucion emite por email y el estudiante no
  // aporta wallet. La custodia existe precisamente para esto.
  it('usa la custodiada cuando no hay wallet declarada', () => {
    expect(resolveRecipientWallet(null, CUSTODIAL)).toBe(CUSTODIAL);
  });

  it('trata la cadena vacia como ausencia de wallet', () => {
    expect(resolveRecipientWallet('', CUSTODIAL)).toBe(CUSTODIAL);
    expect(resolveRecipientWallet('   ', CUSTODIAL)).toBe(CUSTODIAL);
  });

  // Un estudiante que ya tiene perfil puede reclamar desde otra wallet. La de
  // esta vez es la correcta: es la que posee la llave del Lock.
  it('no deja que la wallet del perfil pise la declarada', () => {
    const profileWallet = '0x3333333333333333333333333333333333333333';
    expect(resolveRecipientWallet(DECLARED, profileWallet)).toBe(DECLARED);
  });

  it('normaliza a checksum para que la comparacion no dependa del formato', () => {
    const lower = DECLARED.toLowerCase();
    expect(resolveRecipientWallet(lower, CUSTODIAL)).toBe(DECLARED);
  });

  // Una address invalida no debe convertirse en destino: antes que acuñar en
  // una direccion rota, preferimos la custodiada que sabemos que funciona.
  it('descarta una address invalida y cae en la custodiada', () => {
    expect(resolveRecipientWallet('0xnope', CUSTODIAL)).toBe(CUSTODIAL);
    expect(resolveRecipientWallet('no-es-una-address', CUSTODIAL)).toBe(CUSTODIAL);
    // Longitud correcta pero con un caracter no hexadecimal.
    expect(resolveRecipientWallet(`0x${'z'.repeat(40)}`, CUSTODIAL)).toBe(CUSTODIAL);
  });
});

/**
 * `normalizeDeclaredWallet` devuelve null en vez de un respaldo para que quien
 * llama pueda evitar provisionar una wallet custodiada --y su escritura en
 * OpenBao-- cuando el estudiante ya trajo la suya.
 */
describe('normalizacion de la wallet declarada', () => {
  it('devuelve null cuando no hay nada utilizable', () => {
    expect(normalizeDeclaredWallet(null)).toBeNull();
    expect(normalizeDeclaredWallet(undefined)).toBeNull();
    expect(normalizeDeclaredWallet('')).toBeNull();
    expect(normalizeDeclaredWallet('   ')).toBeNull();
  });

  it('devuelve null ante una address invalida', () => {
    expect(normalizeDeclaredWallet('0xnope')).toBeNull();
  });

  it('devuelve la address en checksum cuando es valida', () => {
    expect(normalizeDeclaredWallet(DECLARED.toLowerCase())).toBe(DECLARED);
  });

  it('tolera espacios alrededor de una address valida', () => {
    expect(normalizeDeclaredWallet(`  ${DECLARED}  `)).toBe(DECLARED);
  });
});
