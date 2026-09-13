import { getAddress } from 'viem';

/**
 * Wallet que el estudiante declara como destino de su credencial.
 *
 * Vive aparte porque la decision es irreversible: el token es soulbound, asi
 * que una vez acuñado no se puede mover a otra wallet. Aislarla la hace
 * verificable sin base de datos ni blockchain.
 *
 * Una wallet declarada manda siempre sobre la custodiada: la custodia existe
 * para quien no tiene ninguna, no para sustituir la que ya usa. En el portal
 * token-gated esto es lo que mantiene el circulo cerrado, porque la credencial
 * llega a la misma wallet que compro la llave del Lock.
 *
 * Devuelve null cuando no hay wallet utilizable, para que quien llama decida
 * si provisiona una custodiada.
 */
export function normalizeDeclaredWallet(declared: string | null | undefined): string | null {
  const candidate = declared?.trim();
  if (!candidate) return null;

  // Una address malformada no puede ser el destino: acuñar ahi perderia el
  // certificado para siempre. Ante la duda, que siga el camino custodiado,
  // que si es recuperable.
  try {
    return getAddress(candidate);
  } catch {
    return null;
  }
}

/**
 * Resuelve el destino final combinando la declarada con la custodiada.
 * `custodial` es el respaldo y se asume siempre valida.
 */
export function resolveRecipientWallet(
  declared: string | null | undefined,
  custodial: string,
): string {
  return normalizeDeclaredWallet(declared) ?? custodial;
}
