export const badgeAbi = [
  {
    type: 'function',
    name: 'mintBadge',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'tokenURI_', type: 'string' },
      { name: 'institution', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'uri',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'event',
    name: 'BadgeMinted',
    inputs: [
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'institution', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'minter', type: 'address' },
      { indexed: false, name: 'uri', type: 'string' },
    ],
  },
] as const;
