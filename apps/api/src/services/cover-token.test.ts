import { describe, it, expect } from 'vitest';
import {
  COVER_TOKEN_TTL_MS,
  issueCoverToken,
  signCoverToken,
  verifyCoverToken,
} from './cover-token.js';

/**
 * Este permiso es lo unico que separa la portada nitida --que puede ser la
 * diapositiva de una clase de pago-- de cualquiera que copie una URL del
 * inspector. Un fallo aqui no da error: entrega material de pago.
 */

const SECRET = 'un-secreto-de-pruebas-con-mas-de-32-caracteres';
const TOPIC = 'a3f1c2d4-0000-4000-8000-000000000001';
const USER = 'b7e9d1a2-0000-4000-8000-000000000002';

describe('emision del permiso', () => {
  it('acepta el permiso recien emitido para su temario y su usuario', () => {
    const token = issueCoverToken({ topicId: TOPIC, userId: USER }, SECRET);
    expect(verifyCoverToken(token, { topicId: TOPIC, userId: USER }, SECRET)).toBe(true);
  });

  it('vence dentro de la ventana declarada', () => {
    const now = 1_800_000_000_000;
    const token = issueCoverToken({ topicId: TOPIC, userId: USER }, SECRET, now);

    // Justo antes de caducar sigue sirviendo.
    const almost = now + COVER_TOKEN_TTL_MS - 1_000;
    expect(verifyCoverToken(token, { topicId: TOPIC, userId: USER }, SECRET, almost)).toBe(true);

    // Un segundo despues, no.
    const after = now + COVER_TOKEN_TTL_MS + 1_000;
    expect(verifyCoverToken(token, { topicId: TOPIC, userId: USER }, SECRET, after)).toBe(false);
  });

  it('lleva la expiracion legible por delante de la firma', () => {
    const now = 1_800_000_000_000;
    const token = issueCoverToken({ topicId: TOPIC, userId: USER }, SECRET, now);
    expect(token.startsWith(String(now + COVER_TOKEN_TTL_MS))).toBe(true);
  });
});

describe('alcance del permiso', () => {
  /**
   * El caso que motiva incluir el temario en el mensaje firmado: sin el, un
   * permiso emitido para una portada abierta serviria para la de cualquier
   * curso de pago del catalogo.
   */
  it('no sirve para la portada de otro temario', () => {
    const token = issueCoverToken({ topicId: TOPIC, userId: USER }, SECRET);
    const otro = 'a3f1c2d4-0000-4000-8000-000000000099';
    expect(verifyCoverToken(token, { topicId: otro, userId: USER }, SECRET)).toBe(false);
  });

  /**
   * Y el que motiva incluir el usuario: la ruta resuelve el acceso con la
   * matricula de quien presenta el permiso. Si el permiso de un matriculado
   * valiera para todos, copiarlo del inspector abriria la portada nitida a
   * quien no pago.
   */
  it('no sirve presentado por otro usuario', () => {
    const token = issueCoverToken({ topicId: TOPIC, userId: USER }, SECRET);
    const otro = 'b7e9d1a2-0000-4000-8000-000000000099';
    expect(verifyCoverToken(token, { topicId: TOPIC, userId: otro }, SECRET)).toBe(false);
  });

  it('no sirve firmado con otro secreto', () => {
    const token = issueCoverToken({ topicId: TOPIC, userId: USER }, SECRET);
    const otroSecreto = 'otro-secreto-igual-de-largo-para-la-prueba';
    expect(verifyCoverToken(token, { topicId: TOPIC, userId: USER }, otroSecreto)).toBe(false);
  });
});

/**
 * La portada y el archivo completo no valen lo mismo: la primera se entrega
 * difuminada a quien no pago --es el anzuelo-- y el segundo es el material
 * que se vende. La pagina pone el permiso de la portada en cada <img>, a la
 * vista de cualquiera que abra el inspector; sin ambito, ese mismo permiso
 * habria servido para descargar el video.
 */
describe('ambito del permiso', () => {
  it('el permiso de la portada no abre el material', () => {
    const token = issueCoverToken({ topicId: TOPIC, userId: USER, scope: 'cover' }, SECRET);
    expect(
      verifyCoverToken(token, { topicId: TOPIC, userId: USER, scope: 'cover' }, SECRET),
    ).toBe(true);
    expect(
      verifyCoverToken(token, { topicId: TOPIC, userId: USER, scope: 'material' }, SECRET),
    ).toBe(false);
  });

  it('el permiso del material no sirve para la portada', () => {
    const token = issueCoverToken({ topicId: TOPIC, userId: USER, scope: 'material' }, SECRET);
    expect(
      verifyCoverToken(token, { topicId: TOPIC, userId: USER, scope: 'material' }, SECRET),
    ).toBe(true);
    expect(
      verifyCoverToken(token, { topicId: TOPIC, userId: USER, scope: 'cover' }, SECRET),
    ).toBe(false);
  });

  // El ambito va dentro de la firma: cambiarlo en la URL debe romperla, no
  // ascender el permiso.
  it('cambiar el ambito en la URL invalida la firma', () => {
    const now = 1_800_000_000_000;
    const token = issueCoverToken({ topicId: TOPIC, userId: USER, scope: 'cover' }, SECRET, now);
    const firma = token.slice(token.indexOf('.') + 1);
    const falsificado = `${now + COVER_TOKEN_TTL_MS}.${firma}`;
    expect(
      verifyCoverToken(
        falsificado,
        { topicId: TOPIC, userId: USER, scope: 'material' },
        SECRET,
        now,
      ),
    ).toBe(false);
  });

  // Los permisos anteriores a este campo se firmaron sin ambito; deben seguir
  // valiendo como lo que eran, que es la portada.
  it('sin ambito declarado se comporta como portada', () => {
    const token = issueCoverToken({ topicId: TOPIC, userId: USER }, SECRET);
    expect(verifyCoverToken(token, { topicId: TOPIC, userId: USER }, SECRET)).toBe(true);
    expect(
      verifyCoverToken(token, { topicId: TOPIC, userId: USER, scope: 'cover' }, SECRET),
    ).toBe(true);
    expect(
      verifyCoverToken(token, { topicId: TOPIC, userId: USER, scope: 'material' }, SECRET),
    ).toBe(false);
  });
});

describe('permisos manipulados', () => {
  /**
   * Estirar la fecha es el ataque evidente: la expiracion viaja en claro. Va
   * dentro del mensaje firmado justamente para que cambiarla rompa la firma.
   */
  it('rechaza una expiracion alargada a mano', () => {
    const now = 1_800_000_000_000;
    const token = issueCoverToken({ topicId: TOPIC, userId: USER }, SECRET, now);
    const firma = token.slice(token.indexOf('.') + 1);
    const estirado = `${now + COVER_TOKEN_TTL_MS * 24}.${firma}`;

    expect(verifyCoverToken(estirado, { topicId: TOPIC, userId: USER }, SECRET, now)).toBe(false);
  });

  it('rechaza una firma cambiada', () => {
    const now = 1_800_000_000_000;
    const expiresAt = now + COVER_TOKEN_TTL_MS;
    const token = signCoverToken({ topicId: TOPIC, userId: USER, expiresAt }, SECRET);
    const roto = `${expiresAt}.${'A'.repeat(token.length - String(expiresAt).length - 1)}`;

    expect(verifyCoverToken(roto, { topicId: TOPIC, userId: USER }, SECRET, now)).toBe(false);
  });

  // La entrada viene de la query de una URL: cualquier forma rara tiene que
  // devolver false, nunca lanzar, o una portada se convertiria en un 500.
  it('rechaza basura sin lanzar', () => {
    const basura = [
      '',
      '.',
      'sin-punto',
      '.solo-firma',
      '123.',
      'NaN.firma',
      '-1.firma',
      '0.firma',
      `${Number.MAX_SAFE_INTEGER + 10}.firma`,
    ];
    for (const token of basura) {
      expect(verifyCoverToken(token, { topicId: TOPIC, userId: USER }, SECRET)).toBe(false);
    }
  });

  it('rechaza un valor que no es texto sin lanzar', () => {
    const noTexto = [null, undefined, 42, {}, []] as unknown[];
    for (const token of noTexto) {
      expect(verifyCoverToken(token as string, { topicId: TOPIC, userId: USER }, SECRET)).toBe(
        false,
      );
    }
  });
});

describe('estabilidad de la firma', () => {
  // Firmar dos veces lo mismo debe dar lo mismo: si no, el permiso de una
  // pagina dejaria de valer al recargar otra y las imagenes parpadearian.
  it('el mismo permiso produce la misma firma', () => {
    const expiresAt = 1_800_003_600_000;
    const a = signCoverToken({ topicId: TOPIC, userId: USER, expiresAt }, SECRET);
    const b = signCoverToken({ topicId: TOPIC, userId: USER, expiresAt }, SECRET);
    expect(a).toBe(b);
  });

  it('temarios distintos producen firmas distintas', () => {
    const expiresAt = 1_800_003_600_000;
    const a = signCoverToken({ topicId: TOPIC, userId: USER, expiresAt }, SECRET);
    const b = signCoverToken(
      { topicId: 'a3f1c2d4-0000-4000-8000-000000000055', userId: USER, expiresAt },
      SECRET,
    );
    expect(a).not.toBe(b);
  });
});
