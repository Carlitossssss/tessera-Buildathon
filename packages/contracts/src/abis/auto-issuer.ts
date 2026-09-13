export const autoIssuerAbi = [
  {
    type: 'function',
    name: 'triggerIssuance',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'payload',
        type: 'tuple',
        components: [
          { name: 'student', type: 'address' },
          { name: 'institution', type: 'address' },
          { name: 'uri', type: 'string' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nonces',
    stateMutability: 'view',
    inputs: [{ name: 'institution', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'IssuanceTriggered',
    inputs: [
      { indexed: true, name: 'certificateTokenId', type: 'uint256' },
      { indexed: true, name: 'student', type: 'address' },
      { indexed: true, name: 'institution', type: 'address' },
      { indexed: false, name: 'nonce', type: 'uint256' },
      { indexed: false, name: 'uri', type: 'string' },
    ],
  },
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const;
