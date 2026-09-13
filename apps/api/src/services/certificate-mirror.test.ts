import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * Replica de certificados en redes secundarias.
 *
 * Lo que se prueba aqui es la decision de A QUE redes se replica. Se toma
 * antes de tocar la cadena y es la que puede fallar en silencio: una red mal
 * declarada no da error, simplemente deja de replicarse, y nadie se entera
 * hasta que un certificado no aparece donde deberia.
 *
 * Lo que si escribe on-chain se valida a mano contra Fuji: levantar un nodo
 * para probarlo costaria mas de lo que aporta.
 */

const ORIGINAL = process.env.MIRROR_CHAIN_IDS;

/**
 * `env` se valida una sola vez al importarse el modulo, asi que cambiar la
 * variable no basta: hay que recargarlo para que lea el valor nuevo.
 */
async function activeWith(value: string): Promise<number[]> {
  process.env.MIRROR_CHAIN_IDS = value;
  vi.resetModules();
  const mod = await import('./certificate-mirror.js');
  return mod.activeMirrorChainIds();
}

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.MIRROR_CHAIN_IDS;
  else process.env.MIRROR_CHAIN_IDS = ORIGINAL;
  vi.resetModules();
});

describe('a que redes se replica', () => {
  // Sin la variable no se replica a ningun sitio. Es el valor por defecto y
  // tiene que ser el silencioso: replicar sin que nadie lo pida gasta gas real.
  it('no replica si MIRROR_CHAIN_IDS esta vacio', async () => {
    await expect(activeWith('')).resolves.toEqual([]);
    await expect(activeWith('   ')).resolves.toEqual([]);
  });

  it('acepta Avalanche Fuji', async () => {
    await expect(activeWith('43113')).resolves.toEqual([43113]);
  });

  it('acepta varias redes separadas por coma, con espacios', async () => {
    await expect(activeWith('43113, 11155111')).resolves.toEqual([43113, 11155111]);
  });

  // Replicar en la red que ya emitio acuñaria el certificado dos veces en la
  // misma cadena: dos tokens distintos para una sola credencial.
  it('descarta la red principal aunque se declare', async () => {
    await expect(activeWith('80002,43113')).resolves.toEqual([43113]);
  });

  // Una red sin soporte de espejo no puede recibir la replica. HashKey es el
  // caso real: alli se acredita la institucion, no se replican certificados.
  it('ignora redes sin soporte de espejo', async () => {
    await expect(activeWith('43113,999999')).resolves.toEqual([43113]);
    await expect(activeWith('133')).resolves.toEqual([]);
  });

  it('ignora entradas que no son numeros', async () => {
    await expect(activeWith('43113,abc,')).resolves.toEqual([43113]);
  });
});
