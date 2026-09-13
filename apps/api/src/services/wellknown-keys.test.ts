import { describe, it, expect } from 'vitest';
import { isWellKnownDevKey, wellKnownKeyWarning } from './wellknown-keys.js';

/**
 * Una clave de Anvil en un .env que apunta a una red real deja la wallet en
 * manos de cualquiera. El aviso solo sirve si reconoce la clave venga como
 * venga escrita, asi que eso es lo que se prueba.
 */

const ANVIL_0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const REAL_KEY = '0x1111111111111111111111111111111111111111111111111111111111111111';

describe('deteccion de claves publicas de desarrollo', () => {
  it('reconoce la cuenta 0 de Anvil', () => {
    expect(isWellKnownDevKey(ANVIL_0)).toBe(true);
  });

  it('reconoce otras cuentas del mismo juego', () => {
    // La 1 y la 5: se usan en los tests de firma de este mismo proyecto.
    expect(
      isWellKnownDevKey('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'),
    ).toBe(true);
    expect(
      isWellKnownDevKey('0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba'),
    ).toBe(true);
  });

  // El aviso no debe depender de como este escrita la clave en el archivo.
  it('reconoce la clave sin prefijo 0x', () => {
    expect(isWellKnownDevKey(ANVIL_0.slice(2))).toBe(true);
  });

  it('reconoce la clave en mayusculas', () => {
    expect(isWellKnownDevKey(ANVIL_0.toUpperCase())).toBe(true);
  });

  it('tolera espacios alrededor', () => {
    expect(isWellKnownDevKey(`  ${ANVIL_0}  `)).toBe(true);
  });

  // Un falso positivo seria peor que no avisar: haria dudar de una clave
  // propia y legitima.
  it('no marca una clave que no es de la lista', () => {
    expect(isWellKnownDevKey(REAL_KEY)).toBe(false);
  });

  it('no marca la ausencia de clave', () => {
    expect(isWellKnownDevKey(null)).toBe(false);
    expect(isWellKnownDevKey(undefined)).toBe(false);
    expect(isWellKnownDevKey('')).toBe(false);
    expect(isWellKnownDevKey('   ')).toBe(false);
  });
});

describe('mensaje de aviso', () => {
  it('explica el riesgo cuando la clave es publica', () => {
    const warning = wellKnownKeyWarning(ANVIL_0);
    expect(warning).toContain('publica');
    expect(warning).toContain('Cualquiera puede firmar');
  });

  it('no dice nada cuando la clave es propia', () => {
    expect(wellKnownKeyWarning(REAL_KEY)).toBeNull();
    expect(wellKnownKeyWarning('')).toBeNull();
  });
});
