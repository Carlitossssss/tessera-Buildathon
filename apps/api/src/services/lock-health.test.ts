import { describe, it, expect } from 'vitest';
import {
  diagnoseLock,
  formatKeyCap,
  formatLockDuration,
  isUnreadable,
  respondsAsLock,
  sameAddress,
  type LockReading,
} from './lock-health.js';

/**
 * La pantalla de membresia daba por bueno cualquier texto con forma de
 * direccion. Estas reglas son las que ahora deciden si un Lock se acepta, se
 * acepta con aviso o se rechaza, y equivocarse tiene coste real: un Lock
 * ajeno aceptado manda los pagos a otra wallet.
 */

const MIO = '0xEe1001B535826EDc4247E7f3a024dDc145A20bdb';
const AJENO = '0x9b90DE10B1433C94B388E3A7d4781C50737D3cC7';

const leido = (over: Partial<LockReading> = {}): LockReading => ({
  name: 'migas',
  publicLockVersion: 14,
  owner: MIO,
  keyPriceWei: '1000000000000000',
  expirationDuration: 2_592_000,
  totalSupply: 2,
  ...over,
});

const nada: LockReading = {
  name: null,
  publicLockVersion: null,
  owner: null,
  keyPriceWei: null,
  expirationDuration: null,
  totalSupply: null,
};

describe('reconocer un Lock', () => {
  it('acepta el que da nombre y version', () => {
    expect(respondsAsLock(leido())).toBe(true);
  });

  // No todas las versiones exponen lo mismo: basta con una de las dos señales.
  it('acepta el que solo da el nombre', () => {
    expect(respondsAsLock(leido({ publicLockVersion: null }))).toBe(true);
  });

  it('acepta el que solo da la version', () => {
    expect(respondsAsLock(leido({ name: null }))).toBe(true);
  });

  it('rechaza al que no da ninguna de las dos', () => {
    expect(respondsAsLock(leido({ name: null, publicLockVersion: null }))).toBe(false);
  });
});

describe('distinguir un fallo de lectura de una direccion mala', () => {
  /**
   * El caso que motiva separarlos: con un RPC caido no responde nada, y
   * tratarlo como "direccion invalida" castigaria a quien la pego bien.
   */
  it('reconoce que no se pudo leer nada', () => {
    expect(isUnreadable(nada)).toBe(true);
  });

  it('una sola lectura buena ya basta para opinar', () => {
    expect(isUnreadable({ ...nada, name: 'migas' })).toBe(false);
    expect(isUnreadable({ ...nada, keyPriceWei: '0' })).toBe(false);
  });

  it('un precio cero cuenta como lectura, no como ausencia', () => {
    // Un Lock gratuito es legitimo: 0 es un valor, no un fallo.
    expect(isUnreadable({ ...nada, keyPriceWei: '0', expirationDuration: 0 })).toBe(false);
  });
});

describe('comparacion de direcciones', () => {
  it('ignora mayusculas y checksum', () => {
    expect(sameAddress(MIO, MIO.toLowerCase())).toBe(true);
    expect(sameAddress(MIO.toUpperCase(), MIO)).toBe(true);
  });

  it('tolera espacios alrededor', () => {
    expect(sameAddress(`  ${MIO} `, MIO)).toBe(true);
  });

  it('distingue direcciones distintas', () => {
    expect(sameAddress(MIO, AJENO)).toBe(false);
  });

  it('nunca da por iguales dos ausencias', () => {
    expect(sameAddress(null, null)).toBe(false);
    expect(sameAddress(undefined, MIO)).toBe(false);
    expect(sameAddress(MIO, '')).toBe(false);
  });
});

/**
 * El error mas frecuente de esta pantalla: pegar la direccion de la wallet
 * dueña en vez de la del Lock. Se vio en produccion, y lo provoca la propia
 * pantalla al mostrar "los pagos van a 0xEe10…" justo encima del campo.
 *
 * Antes acababa clasificado como 'unreadable', que responde "puede ser la
 * red, no la direccion": culpa al RPC cuando el problema era justamente la
 * direccion, y deja a la persona reintentando sin entender nada.
 */
describe('una wallet no es un Lock', () => {
  const wallet = (): LockReading => ({
    name: null,
    publicLockVersion: null,
    owner: null,
    keyPriceWei: null,
    expirationDuration: null,
    totalSupply: null,
    hasCode: false,
  });

  it('reconoce que ahi no hay contrato', () => {
    expect(diagnoseLock({ reading: wallet(), expectedOwners: [MIO] })).toEqual({
      status: 'not-a-contract',
    });
  });

  // Se comprueba antes que nada: es una respuesta de la cadena, no un fallo.
  it('manda sobre el diagnostico de lectura fallida', () => {
    expect(isUnreadable(wallet())).toBe(true);
    expect(diagnoseLock({ reading: wallet(), expectedOwners: [MIO] }).status).toBe(
      'not-a-contract',
    );
  });

  // No comprobarlo no es lo mismo que comprobarlo y no encontrar codigo.
  it('no acusa cuando no se pudo comprobar', () => {
    const sinComprobar = { ...wallet(), hasCode: undefined };
    expect(diagnoseLock({ reading: sinComprobar, expectedOwners: [MIO] })).toEqual({
      status: 'unreadable',
    });
  });

  it('un Lock de verdad no se ve afectado', () => {
    expect(diagnoseLock({ reading: { ...leido(), hasCode: true }, expectedOwners: [MIO] })).toEqual({
      status: 'ok',
    });
  });
});

describe('diagnostico del Lock', () => {
  it('acepta un Lock cuyo dueno es la institucion', () => {
    expect(diagnoseLock({ reading: leido(), expectedOwners: [MIO] })).toEqual({ status: 'ok' });
  });

  /**
   * El aviso que da sentido a toda la verificacion: el Lock funciona, pero
   * cobra a otra wallet. No se bloquea --una institucion puede desplegar
   * desde una wallet personal a proposito-- pero hay que decirlo.
   */
  it('avisa cuando el dueno es ajeno', () => {
    expect(diagnoseLock({ reading: leido({ owner: AJENO }), expectedOwners: [MIO] })).toEqual({
      status: 'foreign-owner',
      owner: AJENO,
    });
  });

  it('rechaza una direccion que no responde como Lock', () => {
    const contratoCualquiera = leido({ name: null, publicLockVersion: null });
    expect(diagnoseLock({ reading: contratoCualquiera, expectedOwners: [MIO] })).toEqual({
      status: 'not-a-lock',
    });
  });

  it('no culpa a la direccion cuando no se pudo leer nada', () => {
    expect(diagnoseLock({ reading: nada, expectedOwners: [MIO] })).toEqual({
      status: 'unreadable',
    });
  });

  // Sin wallets conocidas no hay con que comparar: inventar una sospecha
  // seria peor que callar.
  it('no opina sobre la propiedad si no sabe que wallets son de la institucion', () => {
    expect(diagnoseLock({ reading: leido({ owner: AJENO }), expectedOwners: [] })).toEqual({
      status: 'ok',
    });
    expect(
      diagnoseLock({ reading: leido({ owner: AJENO }), expectedOwners: [null, undefined] }),
    ).toEqual({ status: 'ok' });
  });

  /**
   * El aviso que hubo que quitar.
   *
   * Se comparaba el dueno del Lock contra `institutions.walletAddress`, que
   * no es la wallet de la institucion sino una custodiada que genera Tessera
   * al crear el workspace --clave en OpenBao--. Un Lock se despliega desde
   * MetaMask, asi que jamas coincidian: "este Lock no es de tu institucion"
   * saltaba siempre, tambien con el Lock correcto.
   *
   * Un aviso imposible de satisfacer no protege de nada; solo ensena a
   * ignorar los avisos. Por eso el diagnostico acepta una lista vacia y en
   * ese caso no opina sobre la propiedad.
   */
  it('no acusa cuando no hay con que comparar, que es el caso real', () => {
    const custodiada = '0x7d42000000000000000000000000000000005b66';
    // Asi se llamaba antes: comparando contra la wallet custodiada.
    expect(
      diagnoseLock({ reading: leido({ owner: AJENO }), expectedOwners: [custodiada] }).status,
    ).toBe('foreign-owner');
    // Y asi se llama ahora: sin nada que comparar, no se inventa sospecha.
    expect(diagnoseLock({ reading: leido({ owner: AJENO }), expectedOwners: [] }).status).toBe('ok');
  });

  it('acepta cualquiera de las wallets declaradas', () => {
    expect(diagnoseLock({ reading: leido({ owner: AJENO }), expectedOwners: [MIO, AJENO] })).toEqual(
      { status: 'ok' },
    );
  });

  it('no opina si el Lock no dijo quien es su dueno', () => {
    expect(diagnoseLock({ reading: leido({ owner: null }), expectedOwners: [MIO] })).toEqual({
      status: 'ok',
    });
  });
});

describe('duracion legible', () => {
  it('traduce los plazos habituales', () => {
    expect(formatLockDuration(2_592_000)).toBe('1 mes');
    expect(formatLockDuration(86_400)).toBe('1 día');
    expect(formatLockDuration(604_800)).toBe('7 días');
    expect(formatLockDuration(31_536_000)).toBe('1 año');
  });

  // Cero no es "no se pudo leer": es una llave que no caduca, y eso se dice.
  it('distingue una llave que no vence de una lectura fallida', () => {
    expect(formatLockDuration(0)).toBe('No vence');
    expect(formatLockDuration(null)).toBeNull();
    expect(formatLockDuration(undefined)).toBeNull();
  });

  it('no muestra cero dias para un plazo de horas', () => {
    expect(formatLockDuration(3600)).toBe('1 hora');
    expect(formatLockDuration(7200)).toBe('2 horas');
  });

  it('rechaza valores imposibles', () => {
    expect(formatLockDuration(-5)).toBeNull();
    expect(formatLockDuration(Number.NaN)).toBeNull();
  });
});

describe('tope de llaves legible', () => {
  it('muestra un tope real', () => {
    expect(formatKeyCap(100)).toContain('100');
  });

  // Unlock usa un uint256 gigante para "sin limite"; mostrarlo seria ruido.
  it('traduce el infinito de Unlock', () => {
    expect(formatKeyCap(Number.MAX_SAFE_INTEGER)).toBe('Sin límite');
  });

  it('calla cuando no hay dato', () => {
    expect(formatKeyCap(0)).toBeNull();
    expect(formatKeyCap(null)).toBeNull();
    expect(formatKeyCap(undefined)).toBeNull();
  });
});
