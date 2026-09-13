import { publicEnv } from './env';

/**
 * Enlaces al explorador de bloques de la red en la que emitimos.
 *
 * Existe porque estas URL estaban escritas a mano en media docena de pantallas
 * y todas apuntaban a `polygonscan.com`, que es Polygon mainnet. Tessera emite
 * en Amoy, asi que esos enlaces abrian la ficha de una wallet en una red donde
 * no existe: el saldo aparecia vacio y el certificado no figuraba, lo que hace
 * dudar de una emision que en realidad esta bien.
 *
 * Derivar la base del chainId configurado evita que vuelva a pasar al cambiar
 * de red, y deja un unico sitio que corregir.
 */
function explorerBase(): string {
  return publicEnv.NEXT_PUBLIC_POLYGON_CHAIN_ID === 137
    ? 'https://polygonscan.com'
    : 'https://amoy.polygonscan.com';
}

/** Ficha de una wallet o un contrato. */
export function addressUrl(address: string): string {
  return `${explorerBase()}/address/${address}`;
}

/** Ficha de una transaccion. */
export function txUrl(hash: string): string {
  return `${explorerBase()}/tx/${hash}`;
}

/**
 * Ficha de un NFT concreto.
 *
 * Lleva `chainid` y `type` en la query a proposito: sin ellos el explorador no
 * sabe en que red buscar y muestra la pagina con el numero de token pero sin
 * imagen ni propiedades, como si la credencial no existiera.
 */
export function nftUrl(tokenId: string, contract?: string): string {
  const chainId = publicEnv.NEXT_PUBLIC_POLYGON_CHAIN_ID;
  const address = contract ?? publicEnv.NEXT_PUBLIC_CONTRACT_CERTIFICATE;
  return `${explorerBase()}/nft/${address}/${tokenId}?chainid=${chainId}&type=erc721`;
}

/** Coleccion de un contrato de tokens. */
export function tokenUrl(contract: string): string {
  return `${explorerBase()}/token/${contract}`;
}
