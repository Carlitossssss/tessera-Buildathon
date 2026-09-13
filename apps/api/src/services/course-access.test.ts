import { describe, it, expect } from 'vitest';
import {
  canSeeModuleContent,
  isGateUsable,
  markPreviewable,
  previewModuleLimit,
  requiresMembership,
  type GatedCourse,
} from './course-access.js';

/**
 * Un fallo en estas reglas no produce un error visible: entrega contenido de
 * pago a quien no lo compro. Por eso se prueban los bordes con detalle.
 */

const gated = (over: Partial<GatedCourse> = {}): GatedCourse => ({
  visibility: 'token_gated',
  lockAddress: '0xf06504978DF6ab1540030373c5691B1128520f0C',
  lockChainId: 11155111,
  previewModuleCount: 1,
  ...over,
});

const mods = (n: number, startAt = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `m${i}`, orderIndex: startAt + i }));

describe('que cursos pasan por Unlock', () => {
  it('solo los token_gated exigen membresia', () => {
    expect(requiresMembership({ visibility: 'token_gated' })).toBe(true);
    expect(requiresMembership({ visibility: 'public_free' })).toBe(false);
    expect(requiresMembership({ visibility: 'public_paid' })).toBe(false);
    expect(requiresMembership({ visibility: 'private_code' })).toBe(false);
    expect(requiresMembership({ visibility: 'hybrid' })).toBe(false);
  });

  // Los cursos que ya existian no deben cambiar de comportamiento por haber
  // añadido la capa de Unlock.
  it('un curso no token-gated nunca queda bloqueado por el gate', () => {
    const free = gated({ visibility: 'public_free', lockAddress: null, lockChainId: null });
    expect(isGateUsable(free)).toBe(true);
    expect(canSeeModuleContent({ course: free, enrolled: false, previewable: false })).toBe(true);
  });
});

describe('gate utilizable', () => {
  it('acepta un token-gated con Lock y red', () => {
    expect(isGateUsable(gated())).toBe(true);
  });

  // Sin Lock nadie podria matricularse jamas: negamos antes de prometer.
  it('rechaza un token-gated sin direccion de Lock', () => {
    expect(isGateUsable(gated({ lockAddress: null }))).toBe(false);
  });

  it('rechaza un token-gated sin red', () => {
    expect(isGateUsable(gated({ lockChainId: null }))).toBe(false);
  });
});

describe('limite de previsualizacion', () => {
  it('respeta el valor configurado', () => {
    expect(previewModuleLimit(gated({ previewModuleCount: 2 }), 6)).toBe(2);
  });

  // Configurar mas modulos de muestra que los que existen no debe prometer
  // modulos inexistentes.
  it('no supera el total de modulos', () => {
    expect(previewModuleLimit(gated({ previewModuleCount: 99 }), 3)).toBe(3);
  });

  it('admite cero: un curso puede no abrir nada', () => {
    expect(previewModuleLimit(gated({ previewModuleCount: 0 }), 5)).toBe(0);
  });

  // Un negativo en base de datos no debe invertir la logica.
  it('nunca devuelve un limite negativo', () => {
    expect(previewModuleLimit(gated({ previewModuleCount: -3 }), 5)).toBe(0);
  });

  it('un curso abierto muestra todo', () => {
    expect(previewModuleLimit(gated({ visibility: 'public_free' }), 7)).toBe(7);
  });
});

describe('marcado de modulos previsualizables', () => {
  it('abre solo los primeros N del temario', () => {
    const result = markPreviewable(gated({ previewModuleCount: 2 }), mods(5));
    expect(result.map((m) => m.previewable)).toEqual([true, true, false, false, false]);
  });

  // Si una institucion numera desde 10 o deja huecos al borrar un modulo, la
  // muestra debe seguir siendo "los primeros", no depender de los numeros.
  it('decide por posicion, no por el valor de orderIndex', () => {
    const result = markPreviewable(gated({ previewModuleCount: 1 }), mods(3, 10));
    expect(result.map((m) => m.previewable)).toEqual([true, false, false]);
  });

  it('ordena por orderIndex aunque lleguen desordenados', () => {
    const unordered = [
      { id: 'c', orderIndex: 3 },
      { id: 'a', orderIndex: 1 },
      { id: 'b', orderIndex: 2 },
    ];
    const result = markPreviewable(gated({ previewModuleCount: 1 }), unordered);
    expect(result.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(result[0]!.previewable).toBe(true);
    expect(result[1]!.previewable).toBe(false);
  });

  it('no muta el arreglo recibido', () => {
    const input = [
      { id: 'b', orderIndex: 2 },
      { id: 'a', orderIndex: 1 },
    ];
    markPreviewable(gated(), input);
    expect(input.map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('tolera un curso sin modulos', () => {
    expect(markPreviewable(gated(), [])).toEqual([]);
  });
});

describe('entrega del contenido de un modulo', () => {
  it('deja ver los modulos de muestra sin membresia', () => {
    expect(canSeeModuleContent({ course: gated(), enrolled: false, previewable: true })).toBe(true);
  });

  // El caso que de verdad importa: sin llave y fuera de la muestra, el
  // contenido no sale del servidor.
  it('bloquea el resto sin membresia', () => {
    expect(canSeeModuleContent({ course: gated(), enrolled: false, previewable: false })).toBe(
      false,
    );
  });

  it('abre todo a quien ya esta matriculado', () => {
    expect(canSeeModuleContent({ course: gated(), enrolled: true, previewable: false })).toBe(true);
  });

  // En un curso de pago unico --el modo por defecto-- una llave vencida corta
  // la posibilidad de matricularse de nuevo, no el acceso ya concedido: el
  // curso ya se otorgo, igual que una entrada comprada no se invalida.
  it('mantiene el acceso del matriculado aunque la llave haya vencido, en pago unico', () => {
    expect(
      canSeeModuleContent({
        course: gated({ previewModuleCount: 0 }),
        enrolled: true,
        previewable: false,
        keyStillValid: false,
      }),
    ).toBe(true);
  });
});

/**
 * Cursos por suscripcion.
 *
 * Unlock es un protocolo de suscripciones y su expirationDuration existe para
 * cortar el acceso. Sin este modo, una membresia mensual se comportaba como
 * pago unico: se pagaba un mes y el curso quedaba para siempre, que es
 * justamente el modelo de negocio que la institucion NO eligio.
 */
describe('acceso por suscripcion', () => {
  const subscription = (over: Partial<GatedCourse> = {}) =>
    gated({ accessMode: 'subscription', previewModuleCount: 0, ...over });

  it('abre el contenido mientras la llave siga viva', () => {
    expect(
      canSeeModuleContent({
        course: subscription(),
        enrolled: true,
        previewable: false,
        keyStillValid: true,
      }),
    ).toBe(true);
  });

  // La diferencia con el pago unico, y el motivo de todo este modo.
  it('cierra el contenido cuando la llave vencio', () => {
    expect(
      canSeeModuleContent({
        course: subscription(),
        enrolled: true,
        previewable: false,
        keyStillValid: false,
      }),
    ).toBe(false);
  });

  // La muestra es catalogo: sigue abierta aunque la suscripcion haya vencido,
  // porque es lo que invita a renovar.
  it('deja la muestra abierta con la llave vencida', () => {
    expect(
      canSeeModuleContent({
        course: subscription({ previewModuleCount: 1 }),
        enrolled: true,
        previewable: true,
        keyStillValid: false,
      }),
    ).toBe(true);
  });

  /**
   * Un RPC caido no puede cerrar un curso.
   *
   * `undefined` significa que no se pudo leer el Lock, y eso no es lo mismo
   * que el contrato respondiendo que la llave vencio. Cerrarle el curso a
   * alguien por un fallo nuestro es peor que dejarlo abierto un rato de mas:
   * el primero parece un robo y el segundo se corrige en la siguiente lectura.
   */
  it('mantiene el acceso si no se pudo leer el Lock', () => {
    expect(
      canSeeModuleContent({
        course: subscription(),
        enrolled: true,
        previewable: false,
        keyStillValid: undefined,
      }),
    ).toBe(true);
  });

  // Sin matricula el modo no cambia nada: la barrera de fuera sigue siendo la
  // misma para todos.
  it('no regala nada a quien no esta matriculado', () => {
    expect(
      canSeeModuleContent({
        course: subscription(),
        enrolled: false,
        previewable: false,
        keyStillValid: true,
      }),
    ).toBe(false);
  });

  // Un curso abierto declarado como suscripcion no debe cerrarse: la base lo
  // impide con un CHECK, pero si una fila asi existiera, el gate no aplica.
  it('no aplica a un curso que no pasa por Unlock', () => {
    expect(
      canSeeModuleContent({
        course: gated({ visibility: 'public_free', accessMode: 'subscription' }),
        enrolled: true,
        previewable: false,
        keyStillValid: false,
      }),
    ).toBe(true);
  });
});
