import { describe, it, expect } from 'vitest';
import {
  assetKeyFor,
  decideMaterialAccess,
  materialKindFor,
  moduleRequiresKey,
  type GatedModule,
} from './module-access.js';

/**
 * Un fallo aqui no da error: entrega material de pago a quien no lo compro.
 * Por eso se prueban las combinaciones, no solo el camino feliz.
 */

const openModule: GatedModule = { lockAddress: null, lockChainId: null };
const gatedModule: GatedModule = {
  lockAddress: '0xf06504978DF6ab1540030373c5691B1128520f0C',
  lockChainId: 11155111,
};

describe('que modulos exigen llave propia', () => {
  it('un modulo sin Lock hereda el acceso del curso', () => {
    expect(moduleRequiresKey(openModule)).toBe(false);
  });

  it('un modulo con Lock y red exige su propia llave', () => {
    expect(moduleRequiresKey(gatedModule)).toBe(true);
  });

  // Una direccion sin red no permite consultar el Lock: tratarla como cerrada
  // dejaria el modulo inaccesible sin forma de abrirlo.
  it('ignora un Lock incompleto', () => {
    expect(moduleRequiresKey({ lockAddress: gatedModule.lockAddress, lockChainId: null })).toBe(
      false,
    );
    expect(moduleRequiresKey({ lockAddress: null, lockChainId: 11155111 })).toBe(false);
  });
});

describe('decision sobre el material', () => {
  // La barrera del curso es la de fuera: sin pasarla, el material interno ni
  // se plantea.
  it('no entrega nada si el curso esta cerrado y el modulo no es muestra', () => {
    const d = decideMaterialAccess({
      module: openModule,
      enrolledInCourse: false,
      coursePreviewable: false,
      hasModuleKey: false,
    });
    expect(d).toEqual({ access: 'none', reason: 'course-locked' });
  });

  it('entrega completo al matriculado cuando el modulo no tiene Lock', () => {
    const d = decideMaterialAccess({
      module: openModule,
      enrolledInCourse: true,
      coursePreviewable: false,
      hasModuleKey: false,
    });
    expect(d.access).toBe('full');
  });

  // La muestra del curso existe justamente para que un visitante sin matricula
  // pruebe el contenido.
  it('entrega completo un modulo de muestra aunque no haya matricula', () => {
    const d = decideMaterialAccess({
      module: openModule,
      enrolledInCourse: false,
      coursePreviewable: true,
      hasModuleKey: false,
    });
    expect(d.access).toBe('full');
  });

  // El caso que da sentido al Lock por modulo: si la matricula lo abriera
  // igual, no se podria vender material avanzado dentro de un curso abierto.
  it('un modulo con Lock exige su llave aunque el estudiante este matriculado', () => {
    const d = decideMaterialAccess({
      module: gatedModule,
      enrolledInCourse: true,
      coursePreviewable: false,
      hasModuleKey: false,
    });
    expect(d).toEqual({ access: 'preview', reason: 'module-locked' });
  });

  it('abre el modulo con Lock cuando se presenta la llave', () => {
    const d = decideMaterialAccess({
      module: gatedModule,
      enrolledInCourse: true,
      coursePreviewable: false,
      hasModuleKey: true,
    });
    expect(d).toEqual({ access: 'full', reason: 'module-key' });
  });

  // La llave del modulo no sustituye a la entrada del curso: si el curso esta
  // cerrado, tener la llave del modulo no deberia abrir la puerta de fuera.
  it('la llave del modulo no salta la barrera del curso', () => {
    const d = decideMaterialAccess({
      module: gatedModule,
      enrolledInCourse: false,
      coursePreviewable: false,
      hasModuleKey: true,
    });
    expect(d.access).toBe('none');
  });
});

describe('archivo que se entrega', () => {
  const topic = {
    assetKey: 'courses/full.mp4',
    assetPreviewKey: 'courses/preview.mp4',
    assetMimeType: 'video/mp4',
    assetPreviewSeconds: 30,
  };

  it('entrega el original con acceso completo', () => {
    expect(assetKeyFor(topic, { access: 'full', reason: 'enrolled' })).toBe('courses/full.mp4');
  });

  it('entrega la muestra cuando el modulo esta cerrado', () => {
    expect(assetKeyFor(topic, { access: 'preview', reason: 'module-locked' })).toBe(
      'courses/preview.mp4',
    );
  });

  it('no entrega nada si el curso esta cerrado', () => {
    expect(assetKeyFor(topic, { access: 'none', reason: 'course-locked' })).toBeNull();
  });

  // Un temario sin muestra generada no debe caer al original por descuido.
  it('devuelve null si no hay muestra generada', () => {
    const sinPreview = { ...topic, assetPreviewKey: null };
    expect(assetKeyFor(sinPreview, { access: 'preview', reason: 'module-locked' })).toBeNull();
  });
});

describe('tipos de material admitidos', () => {
  it('clasifica video, audio y documento', () => {
    expect(materialKindFor('video/mp4')).toBe('video');
    expect(materialKindFor('audio/mpeg')).toBe('audio');
    expect(materialKindFor('application/pdf')).toBe('document');
  });

  it('tolera mayusculas y espacios', () => {
    expect(materialKindFor(' VIDEO/MP4 ')).toBe('video');
  });

  // Un tipo que no sabemos recortar terminaria sirviendo el original como
  // muestra, asi que se rechaza al subir.
  it('rechaza lo que no sabria previsualizar', () => {
    expect(materialKindFor('application/zip')).toBeNull();
    expect(materialKindFor('text/html')).toBeNull();
    expect(materialKindFor(null)).toBeNull();
    expect(materialKindFor('')).toBeNull();
  });
});
