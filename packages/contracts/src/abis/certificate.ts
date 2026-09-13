export const certificateAbi = [
  {
    type: 'function',
    name: 'revoke',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'locked',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    // Emisor del certificado, guardado on-chain en el momento de acuñar.
    //
    // Es la pieza que convierte al diploma en un activo del mundo real
    // auditable: dice QUIEN lo emitio sin pasar por la API de Tessera. Si
    // nuestro servidor desapareciera, la autoria sigue siendo comprobable
    // contra la cadena.
    type: 'function',
    name: 'certificateIssuer',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'CertificateMinted',
    inputs: [
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'institution', type: 'address' },
      { indexed: false, name: 'minter', type: 'address' },
      { indexed: false, name: 'uri', type: 'string' },
    ],
  },
  {
    type: 'event',
    name: 'CertificateRevoked',
    inputs: [
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'reason', type: 'string' },
    ],
  },
] as const;
