import { describe, it, expect } from 'vitest';
import { readCertificateProvenance } from './provenance.js';

/**
 * Procedencia on-chain.
 *
 * Estas pruebas no llaman a la red: comprueban las decisiones que se toman
 * ANTES de leer la cadena, que son las que deciden si devolvemos una respuesta
 * util o un error. Lo que si toca RPC se valida a mano contra HSK y queda
 * documentado en HSK.md.
 */

describe('redes soportadas', () => {
  // Preguntar por una red que no desplegamos no es un error del servidor: es
  // una pregunta sobre algo que no existe.
  it('devuelve null en una red desconocida', async () => {
    await expect(readCertificateProvenance({ chainId: 999999, tokenId: '1' })).resolves.toBeNull();
  });

  it('devuelve null si el tokenId no es un entero', async () => {
    await expect(
      readCertificateProvenance({ chainId: 133, tokenId: 'no-es-un-numero' }),
    ).resolves.toBeNull();
  });
});

describe('forma de la respuesta', () => {
  // El endpoint es publico y su valor esta en que un tercero pueda repetir la
  // lectura. Si faltaran los comandos, la afirmacion de procedencia solo seria
  // comprobable con nuestra propia API, que es justo lo que no queremos.
  it('incluye los comandos para reproducir la lectura sin Tessera', async () => {
    const result = await readCertificateProvenance({ chainId: 133, tokenId: '1' });
    expect(result).not.toBeNull();
    expect(result!.verifyCommands.length).toBeGreaterThanOrEqual(3);

    const joined = result!.verifyCommands.join(' ');
    expect(joined).toContain('certificateIssuer(uint256)');
    expect(joined).toContain('isApprovedInstitution(address)');
    expect(joined).toContain('locked(uint256)');
    // Los comandos apuntan al RPC publico de la red, no a nuestra API.
    expect(joined).toContain('hsk.xyz');
    expect(joined).not.toContain('localhost');
  });

  it('apunta al explorador de la red consultada', async () => {
    const hsk = await readCertificateProvenance({ chainId: 133, tokenId: '1' });
    expect(hsk!.explorerUrl).toContain('hsk.xyz');
    expect(hsk!.network).toBe('HashKey Chain Testnet');

    const fuji = await readCertificateProvenance({ chainId: 43113, tokenId: '1' });
    expect(fuji!.explorerUrl).toContain('snowtrace');
  });

  it('conserva el tokenId consultado', async () => {
    const result = await readCertificateProvenance({ chainId: 133, tokenId: '42' });
    expect(result!.tokenId).toBe('42');
    expect(result!.verifyCommands.join(' ')).toContain(' 42 ');
  });
});
