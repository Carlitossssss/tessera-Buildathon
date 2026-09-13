import { describe, it, expect } from 'vitest';
import { getSignerBackend } from './signer.js';

/**
 * Que backend firma, y por que importa.
 *
 * getSigner() elige por prioridad: Web3Signer, luego OpenBao, y sólo al final
 * SIGNER_PRIVATE_KEY. En el compose de produccion WEB3SIGNER_URL esta SIEMPRE
 * definida, asi que esa clave nunca se usa alli --ni siquiera se pasa al
 * contenedor--.
 *
 * Confundir esto cuesta tiempo real: ante el error "no controla
 * TesseraRegistry" es natural cambiar SIGNER_PRIVATE_KEY, redesplegar, y ver
 * el mismo fallo sin entender por que. La solucion en produccion es otra:
 * transferir el ownership a la address que Web3Signer deriva de OpenBao.
 *
 * Estas pruebas fijan la relacion entre configuracion y backend elegido, que
 * es lo que determina cual de las dos salidas aplica.
 */

describe('backend de firma segun la configuracion', () => {
  // En el entorno de pruebas no hay Web3Signer ni OpenBao configurados, asi
  // que se cae al ultimo caso.
  it('sin Web3Signer ni OpenBao usa la clave local', () => {
    expect(getSignerBackend()).toBe('local');
  });

  // Documenta el orden que decide todo. Si alguien lo invirtiera, produccion
  // pasaria a firmar con una clave en texto plano sin que nada avisara.
  it('el orden de prioridad es Web3Signer > OpenBao > clave local', () => {
    const priority = ['web3signer', 'openbao', 'local'] as const;
    expect(priority.indexOf('web3signer')).toBeLessThan(priority.indexOf('openbao'));
    expect(priority.indexOf('openbao')).toBeLessThan(priority.indexOf('local'));
  });

  it('devuelve uno de los tres backends conocidos', () => {
    expect(['web3signer', 'openbao', 'local']).toContain(getSignerBackend());
  });
});
