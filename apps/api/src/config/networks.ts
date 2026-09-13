/**
 * Redes EVM donde Tessera tiene contratos desplegados.
 *
 * Una sola de ellas emite en cada momento: la que apunta POLYGON_CHAIN_ID. Las
 * demas estan desplegadas y validadas on-chain, y cada una cumple un proposito
 * distinto dentro del producto. La distincion es deliberada: presentar todas
 * como si emitieran seria falso, y un explorador lo desmiente en segundos.
 *
 * Todo es testnet. Ningun despliegue en mainnet.
 */

export type NetworkPurpose = 'issuance' | 'display' | 'membership' | 'institutional';

export interface TesseraNetwork {
  chainId: number;
  name: string;
  currency: string;
  explorer: string;
  purpose: NetworkPurpose;
  /** Para que sirve esta red en el producto, en una linea. */
  role: string;
  /** Por que se eligio. Ha de ser una razon medida, no una preferencia. */
  rationale: string;
  /** Que aporta al producto, en terminos de negocio y no de tecnologia. */
  value: string;
  contracts: {
    registry: string;
    certificate: string;
    badge: string;
    autoIssuer: string;
  };
  /** El explorador de la cadena no verifica codigo fuente. */
  verificationUnavailable?: boolean;
}

export const TESSERA_NETWORKS: readonly TesseraNetwork[] = [
  {
    chainId: 80002,
    name: 'Polygon Amoy',
    currency: 'POL',
    explorer: 'https://amoy.polygonscan.com',
    purpose: 'issuance',
    role: 'Emite los certificados',
    rationale:
      'Gas barato y finalidad rapida: una institucion puede emitir miles de credenciales sin que el costo sea un obstaculo.',
    value:
      'Hace viable el volumen: una universidad con miles de egresados por ano puede certificar a todos sin que el gas convierta la credencial en un lujo.',
    contracts: {
      registry: '0x472d08AEe5405b3Bc4D75A4EE093dA103adD0cEb',
      certificate: '0x9571E4553636314A9A583B8c5c784d207D51F635',
      badge: '0x873Dd9478aA6Aa9C3594eE741aCC7a220763BF1a',
      autoIssuer: '0x34df4378BC382A9D1EC6a2656f679C4b46Dce22d',
    },
  },
  {
    chainId: 43113,
    name: 'Avalanche Fuji',
    currency: 'AVAX',
    explorer: 'https://testnet.snowtrace.io',
    purpose: 'display',
    role: 'El certificado se ve',
    rationale:
      'PolygonScan Amoy no renderiza imagenes de NFT: sirve siempre un placeholder. Snowtrace muestra el diseno real, y una credencial que no se ve no sirve como credencial.',
    value:
      'El egresado puede ensenar su diploma. Una credencial que el explorador dibuja se comparte; una que sale como marcador de posicion no prueba nada ante un empleador.',
    // Redesplegado el 2026-09-12 para anadir ERC721Enumerable y contractURI.
    //
    // El despliegue anterior (certificate 0x60521efB…) indexaba las
    // transferencias en Snowtrace pero dejaba la ficha de cada token vacia:
    // sin totalSupply() el explorador no construye el inventario de la
    // coleccion. Los nueve certificados de aquel contrato siguen existiendo
    // on-chain; son replicas, y su original vive en Amoy.
    contracts: {
      registry: '0xE821fEC944c5BFadB769EC5235D9D09F7e951Dae',
      certificate: '0x5F5164642D96cC3128AbF68019D72c426a895945',
      badge: '0x5390b92176e316846e6b199d2746DE5b03232E04',
      autoIssuer: '0x8f34224573A93086Ed7eA87c972DC70f5E5Bb814',
    },
  },
  {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    currency: 'ETH',
    explorer: 'https://sepolia.etherscan.io',
    purpose: 'membership',
    role: 'Membresias del portal',
    rationale:
      'Unlock Protocol esta desplegado aqui, asi que el Lock que controla el acceso al contenido vive en la misma cadena que estos contratos.',
    value:
      'Abre un ingreso que Tessera no tenia: la institucion cobra por su contenido y certifica al final, en vez de pagar solo por emitir.',
    contracts: {
      registry: '0x2EEcED57D3BC4A0Be1C90F1cB655573aa969Eb3b',
      certificate: '0x5c5018E212B6F295Af75E5Ff326b0bB3D375530a',
      badge: '0xa98D116E8a59ae21C832a3d25407Caf3B603DeD2',
      autoIssuer: '0x2017ee0C335A0f799562006B3d5DD00F345a5033',
    },
  },
  {
    chainId: 133,
    name: 'HashKey Chain Testnet',
    currency: 'HSK',
    explorer: 'https://testnet-explorer.hsk.xyz',
    purpose: 'institutional',
    role: 'Emision institucional',
    rationale:
      'Cadena compliance-first para tokenizacion de activos reales. Un diploma es un activo del mundo real con emisor identificable, y el contrato guarda esa autoria on-chain.',
    value:
      'Permite hablar con instituciones reguladas. Donde exige emisor identificado y trazable, certificateIssuer responde on-chain sin pasar por la API de Tessera.',
    contracts: {
      registry: '0xdD80FA4FA7781135d5B4fb67054EDCcF17E58DE4',
      certificate: '0xbAfCc08c530075a6BB03d3306ead71acDD8f3D7b',
      badge: '0x52B13E3F00079c00824E68DC9f1dBCc7D0BE808B',
      autoIssuer: '0x2EEcED57D3BC4A0Be1C90F1cB655573aa969Eb3b',
    },
    verificationUnavailable: true,
  },
] as const;

/** Base del explorador para una cadena, o null si no la conocemos. */
export function explorerFor(chainId: number): string | null {
  return TESSERA_NETWORKS.find((n) => n.chainId === chainId)?.explorer ?? null;
}

/**
 * Enlace a la ficha de un NFT en el explorador de su cadena.
 *
 * Existe porque la URL no es solo `/nft/<contrato>/<id>`: Snowtrace necesita
 * ademas `chainid` y `type` en la query. Sin ellos abre la pagina con el
 * numero de token y la imagen en blanco --el explorador no sabe en que red
 * buscar-- y quien pulsa el enlace ve un NFT vacio de un certificado que si
 * existe.
 *
 * Se centraliza porque esta URL se armaba a mano en cuatro sitios distintos y
 * ya habian divergido entre si.
 */
export function nftUrlFor(chainId: number, contract: string, tokenId: string): string | null {
  const network = networkFor(chainId);
  if (!network) return null;
  const base = network.explorer.replace(/\/$/, '');
  return `${base}/nft/${contract}/${tokenId}?chainid=${chainId}&type=erc721`;
}

/** Enlace a un contrato en el explorador de su cadena. */
export function addressUrlFor(chainId: number, address: string): string | null {
  const network = networkFor(chainId);
  if (!network) return null;
  return `${network.explorer.replace(/\/$/, '')}/address/${address}`;
}

export function networkFor(chainId: number): TesseraNetwork | null {
  return TESSERA_NETWORKS.find((n) => n.chainId === chainId) ?? null;
}
