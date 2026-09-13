import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { formatDuration, isSupportedCoverMime, renderTopicCover } from './topic-cover.js';

/**
 * La portada es lo unico que ve quien no tiene llave, asi que su generacion
 * decide cuanto se regala del material de pago. Un desenfoque flojo o una
 * imagen que se cuela sin procesar equivalen a entregar la clase.
 */

/** Imagen de prueba con detalle real: un degradado plano se difumina igual que
 *  el original y no probaria nada. */
async function sampleImage(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600">
    <rect width="900" height="600" fill="#0B1120"/>
    <text x="60" y="200" fill="#ffffff" font-size="72" font-family="sans-serif">Clase 4</text>
    <text x="60" y="300" fill="#38BDF8" font-size="40" font-family="sans-serif">Solidity avanzado</text>
    <circle cx="700" cy="420" r="120" fill="#2563EB"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe('formatos aceptados', () => {
  it('acepta los formatos de imagen habituales', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/avif']) {
      expect(isSupportedCoverMime(mime)).toBe(true);
    }
  });

  it('tolera mayusculas y espacios alrededor', () => {
    expect(isSupportedCoverMime('  IMAGE/JPEG ')).toBe(true);
  });

  // Un tipo que no sabemos procesar acabaria guardado tal cual, y entonces la
  // "portada" seria el archivo original sin difuminar.
  it('rechaza lo que no sea una imagen soportada', () => {
    for (const mime of ['video/mp4', 'application/pdf', 'image/svg+xml', '', null, undefined]) {
      expect(isSupportedCoverMime(mime)).toBe(false);
    }
  });
});

describe('generacion de la portada', () => {
  it('devuelve las dos versiones en webp con sus dimensiones', async () => {
    const cover = await renderTopicCover(await sampleImage());

    expect(cover.mimeType).toBe('image/webp');
    expect(cover.width).toBe(900);
    expect(cover.height).toBe(600);

    const meta = await sharp(cover.full).metadata();
    expect(meta.format).toBe('webp');
  });

  // Si ambas fueran iguales, quien no tiene llave estaria viendo la portada
  // nitida: el gate no serviria de nada.
  it('la difuminada no es la nitida', async () => {
    const cover = await renderTopicCover(await sampleImage());
    expect(cover.blurred.equals(cover.full)).toBe(false);
  });

  /**
   * El desenfoque se mide, no se supone.
   *
   * Se compara la desviacion tipica de ambas: difuminar promedia los pixeles
   * vecinos, asi que el contraste cae. Si la difuminada conservara un contraste
   * parecido al original, los textos seguirian siendo legibles --y en una
   * diapositiva eso es la clase entera--.
   */
  it('destruye el detalle de verdad, no solo un poco', async () => {
    const cover = await renderTopicCover(await sampleImage());

    const [sharpStats, blurStats] = await Promise.all([
      sharp(cover.full).greyscale().stats(),
      sharp(cover.blurred).greyscale().stats(),
    ]);

    const sharpSd = sharpStats.channels[0]!.stdev;
    const blurSd = blurStats.channels[0]!.stdev;

    expect(blurSd).toBeLessThan(sharpSd * 0.7);
  });

  // Mas pequena a proposito: nadie la va a ampliar, y reducir antes de
  // desenfocar destruye todavia mas detalle.
  it('la difuminada pesa menos que la nitida', async () => {
    const cover = await renderTopicCover(await sampleImage());
    expect(cover.blurred.byteLength).toBeLessThan(cover.full.byteLength);
  });

  // Una imagen enorme guardada tal cual costaria megas por temario.
  it('no agranda una imagen pequena', async () => {
    const small = await sharp({
      create: { width: 320, height: 200, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();

    const cover = await renderTopicCover(small);
    expect(cover.width).toBe(320);
  });
});

describe('duracion legible', () => {
  it('formatea minutos y segundos', () => {
    expect(formatDuration(760)).toBe('12:40');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(9)).toBe('0:09');
  });

  it('anade horas cuando hace falta', () => {
    expect(formatDuration(3930)).toBe('1:05:30');
  });

  // Sin duracion no se muestra nada, en vez de un "0:00" que parece un error.
  it('devuelve null cuando no hay duracion utilizable', () => {
    for (const value of [0, -5, null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatDuration(value)).toBeNull();
    }
  });
});
