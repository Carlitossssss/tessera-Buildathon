/**
 * Diagnostico de un Lock antes de aceptarlo.
 *
 * La pantalla de membresia pedia pegar una direccion y la daba por buena con
 * solo mirar su forma: bastaba que empezara por 0x y tuviera 40 caracteres.
 * Con eso decia "CONFIGURADO" aunque la direccion no fuera un contrato, no
 * fuera un Lock, o perteneciera a otra persona.
 *
 * Los tres fallos tienen consecuencias distintas y por eso se distinguen:
 *
 *   no se pudo leer   puede ser un RPC caido. No se puede afirmar nada.
 *   no es un Lock     la direccion nunca abrira nada: se rechaza.
 *   dueno ajeno       el Lock funciona, pero los pagos van a otra wallet.
 *
 * Vive aparte de las rutas porque es una decision, no una consulta: asi se
 * prueba sin red, sin base de datos y sin cadena.
 */

/** Lo minimo que necesitamos del Lock leido para diagnosticarlo. */
export interface LockReading {
  /** Nombre del contrato. null si la lectura fallo. */
  name: string | null;
  /** Version de PublicLock. null si no respondio. */
  publicLockVersion: number | null;
  /** Dueno del Lock. null si no respondio. */
  owner: string | null;
  keyPriceWei: string | null;
  expirationDuration: number | null;
  totalSupply: number | null;
  /**
   * Si hay codigo desplegado en esa direccion.
   *
   * Es la senal que distingue una wallet de un contrato, y sin ella el error
   * mas frecuente --pegar la direccion de la wallet dueña en vez de la del
   * Lock-- se confundia con un fallo de red: el sistema respondia "puede ser
   * la red, no la direccion" cuando la direccion era justamente el problema.
   *
   * `undefined` significa que no se pudo comprobar, que no es lo mismo que
   * haber comprobado y no encontrar codigo.
   */
  hasCode?: boolean;
}

export type LockVerdict =
  /** Responde como un Lock y el dueno es quien esperabamos. */
  | { status: 'ok' }
  /**
   * Es un Lock, y su dueno NO coincide con ninguna de las wallets que la
   * institucion declaro como suyas.
   *
   * Solo se emite cuando hay wallets declaradas de verdad --las que una
   * persona escribio-- y nunca contra la wallet custodiada que Tessera genera
   * al crear el workspace: esa la crea nuestro servidor con una clave que
   * vive en OpenBao, asi que jamas puede ser la que despliega un Lock desde
   * MetaMask. Compararla producia un aviso que saltaba siempre y que nadie
   * podia satisfacer, que es peor que no avisar.
   */
  | { status: 'foreign-owner'; owner: string }
  /**
   * No hay contrato en esa direccion: es una wallet.
   *
   * Va aparte de 'not-a-lock' porque el consejo cambia. Aqui la persona
   * confundio la wallet con el Lock --el error mas comun de esta pantalla, y
   * mas aun cuando acabamos de mostrarle la wallet dueña-- y lo que necesita
   * oir es donde encontrar la direccion correcta.
   */
  | { status: 'not-a-contract' }
  /** Hay contrato, pero no responde como Lock: la direccion no sirve. */
  | { status: 'not-a-lock' }
  /** No se pudo leer nada. Puede ser el RPC, no la direccion. */
  | { status: 'unreadable' };

/**
 * Un Lock responde como tal si da su nombre o su version.
 *
 * Se aceptan las dos señales en vez de exigir ambas porque no todas las
 * versiones exponen lo mismo, y rechazar un Lock valido por un metodo que su
 * version no tiene seria peor que aceptar un contrato raro: el contrato raro
 * no llegara a vender ninguna llave, pero el Lock valido rechazado deja a la
 * institucion sin poder cobrar.
 */
export function respondsAsLock(reading: LockReading): boolean {
  return reading.name !== null || reading.publicLockVersion !== null;
}

/**
 * Si el Lock se leyo lo suficiente como para afirmar algo.
 *
 * Cuando NADA respondio no se puede distinguir un RPC caido de una direccion
 * inventada, y tratar ambos igual castigaria a quien pego bien la direccion
 * un dia que el proveedor fallaba.
 */
export function isUnreadable(reading: LockReading): boolean {
  return (
    reading.name === null &&
    reading.publicLockVersion === null &&
    reading.owner === null &&
    reading.keyPriceWei === null &&
    reading.expirationDuration === null
  );
}

/** Compara dos direcciones EVM sin depender de mayusculas ni de checksum. */
export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Diagnostica un Lock leido.
 *
 * `expectedOwners` son las wallets que la institucion reconoce como suyas. Si
 * llega vacia no se puede opinar sobre la propiedad, asi que un Lock que
 * responde se acepta sin mas: es mejor que inventar una sospecha.
 */
export function diagnoseLock(input: {
  reading: LockReading;
  expectedOwners: Array<string | null | undefined>;
}): LockVerdict {
  // Se comprueba ANTES que nada: una wallet no responde a ninguna funcion, y
  // sin esto acababa clasificada como "no se pudo leer" --un mensaje que
  // culpa a la red cuando el problema es que ahi no hay contrato--.
  if (input.reading.hasCode === false) return { status: 'not-a-contract' };

  if (isUnreadable(input.reading)) return { status: 'unreadable' };
  if (!respondsAsLock(input.reading)) return { status: 'not-a-lock' };

  const owner = input.reading.owner;
  if (!owner) return { status: 'ok' };

  const known = input.expectedOwners.filter((value): value is string => Boolean(value));
  if (known.length === 0) return { status: 'ok' };

  const mine = known.some((candidate) => sameAddress(candidate, owner));
  return mine ? { status: 'ok' } : { status: 'foreign-owner', owner };
}

/**
 * Duracion de la membresia, legible.
 *
 * Unlock guarda los segundos y 0 significa que la llave no expira, que no es
 * lo mismo que no haber podido leerlo: lo primero se anuncia --"no vence"--
 * y lo segundo se calla.
 */
export function formatLockDuration(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds === 0) return 'No vence';

  const days = Math.round(seconds / 86_400);
  if (days < 1) {
    const hours = Math.max(1, Math.round(seconds / 3600));
    return hours === 1 ? '1 hora' : `${hours} horas`;
  }
  if (days === 1) return '1 día';
  if (days < 30) return `${days} días`;

  const months = Math.round(days / 30);
  if (months === 1) return '1 mes';
  if (months < 12) return `${months} meses`;

  const years = Math.round(months / 12);
  return years === 1 ? '1 año' : `${years} años`;
}

/**
 * Tope de llaves, legible.
 *
 * Unlock usa un uint256 gigante para "sin limite". Mostrar ese numero seria
 * ruido, asi que se traduce.
 */
export function formatKeyCap(max: number | null | undefined): string | null {
  if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0) return null;
  // Por encima de este orden de magnitud nadie fijo un tope: es el infinito
  // de Unlock recortado por el paso a Number.
  if (max >= 1e15) return 'Sin límite';
  return `${max.toLocaleString('es')} llaves`;
}
