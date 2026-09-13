import { describe, it, expect } from 'vitest';
import { formatKeyPrice } from './unlock.js';

/**
 * Precio de la membresia tal y como se lee en el boton de compra.
 *
 * Es la cifra por la que alguien decide pagar, asi que un formato confuso
 * --demasiados decimales, la moneda equivocada, un cero que parece un fallo--
 * cuesta la conversion. Y `null` no es `0`: uno significa que el RPC no
 * respondio y el otro que la membresia es gratuita.
 */

const SEPOLIA = 11155111;
const FUJI = 43113;
const POLYGON = 137;

describe('formato del precio', () => {
  it('muestra la moneda nativa de cada red', () => {
    expect(formatKeyPrice('10000000000000000', SEPOLIA)).toBe('0.01 ETH');
    expect(formatKeyPrice('10000000000000000', FUJI)).toBe('0.01 AVAX');
    expect(formatKeyPrice('10000000000000000', POLYGON)).toBe('0.01 POL');
  });

  // "0.010000 ETH" se lee peor que "0.01 ETH" y ocupa mas en un boton.
  it('quita los ceros sobrantes del decimal', () => {
    expect(formatKeyPrice('100000000000000000', SEPOLIA)).toBe('0.1 ETH');
    expect(formatKeyPrice('1000000000000000000', SEPOLIA)).toBe('1 ETH');
    expect(formatKeyPrice('2500000000000000000', SEPOLIA)).toBe('2.5 ETH');
  });

  /**
   * Gratis y "no se pudo leer" se muestran distinto a proposito.
   *
   * Un Lock con keyPrice 0 es una membresia gratuita, y anunciarlo invita a
   * entrar. No haber podido leer el precio es otra cosa, y ahi vale mas no
   * decir nada que arriesgarse a poner "Gratis" sobre algo que cobra.
   */
  it('distingue una membresia gratuita de un precio que no se pudo leer', () => {
    expect(formatKeyPrice('0', SEPOLIA)).toBe('Gratis');
    expect(formatKeyPrice(null, SEPOLIA)).toBeNull();
  });

  // Un valor corrupto no debe romper la carga del curso entero.
  it('devuelve null ante un valor que no es un entero', () => {
    expect(formatKeyPrice('no-es-un-numero', SEPOLIA)).toBeNull();
    expect(formatKeyPrice('1.5', SEPOLIA)).toBeNull();
  });

  // Precios por debajo del sexto decimal existen en testnet; redondear a cero
  // diria "0 ETH", que parece gratis. Se recorta, pero sin inventar un cero.
  it('recorta a seis decimales sin fingir que es gratis', () => {
    const tiny = formatKeyPrice('1000000000000', SEPOLIA);
    expect(tiny).toBe('0.000001 ETH');
    expect(tiny).not.toBe('Gratis');
  });

  // Una red sin moneda declarada no debe mostrar un simbolo inventado.
  it('omite el simbolo en una red desconocida', () => {
    expect(formatKeyPrice('1000000000000000000', 999999)).toBe('1');
  });
});
