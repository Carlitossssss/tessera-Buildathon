/**
 * Deteccion de claves privadas publicamente conocidas.
 *
 * Las herramientas de desarrollo local --Anvil, Hardhat, Ganache-- arrancan
 * siempre con el mismo juego de claves derivadas de una frase semilla que esta
 * en su documentacion. Son comodas para probar y no tienen nada de malo en una
 * cadena local efimera.
 *
 * El problema aparece cuando una de ellas termina en un .env que apunta a una
 * red real. Cualquiera puede firmar con esa clave: quien la tenga controla la
 * wallet, y todas las tiene todo el mundo. Una wallet asi no debe custodiar
 * fondos ni ser owner de un contrato.
 *
 * Esto no bloquea el arranque: en local la clave es legitima y bloquear seria
 * estorbar. Lo que hace es dejar constancia, para que nadie la lleve a un
 * servidor por descuido creyendo que es una clave propia.
 */

/**
 * Las diez cuentas por defecto de Anvil y Hardhat, derivadas de
 * "test test test test test test test test test test test junk".
 *
 * Se guardan en minusculas y sin el prefijo 0x para comparar sin depender del
 * formato con que vengan escritas.
 */
const WELL_KNOWN_PRIVATE_KEYS = new Set([
  'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  '7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  '47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  '8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  '92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  '4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  'dbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
  '2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
]);

/** Normaliza para comparar: sin 0x, en minusculas y sin espacios. */
function normalize(privateKey: string): string {
  return privateKey.trim().toLowerCase().replace(/^0x/, '');
}

/**
 * True si la clave es una de las publicas de las herramientas de desarrollo.
 *
 * Una clave vacia no es "conocida": simplemente no hay clave, y ese caso lo
 * gestiona quien la configura.
 */
export function isWellKnownDevKey(privateKey: string | null | undefined): boolean {
  if (!privateKey?.trim()) return false;
  return WELL_KNOWN_PRIVATE_KEYS.has(normalize(privateKey));
}

/**
 * Mensaje de aviso, o null si no hay nada que advertir.
 *
 * Se devuelve texto en vez de registrarlo aqui para que quien llama decida
 * donde mostrarlo: el arranque lo escribe en el log, el health check lo
 * expone para que se vea sin entrar al servidor.
 */
export function wellKnownKeyWarning(privateKey: string | null | undefined): string | null {
  if (!isWellKnownDevKey(privateKey)) return null;
  return (
    'SIGNER_PRIVATE_KEY es una clave publica de desarrollo (Anvil/Hardhat). ' +
    'Cualquiera puede firmar con ella: sirve para una cadena local, nunca para ' +
    'una red real ni para custodiar fondos.'
  );
}
