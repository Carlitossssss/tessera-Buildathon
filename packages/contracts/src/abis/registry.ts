export const registryAbi = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'pendingOwner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'acceptOwnership',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approveInstitution',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'institution', type: 'address' },
      { name: 'name', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revokeInstitution',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'institution', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isApprovedInstitution',
    stateMutability: 'view',
    inputs: [{ name: 'institution', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'isApprovedTeacher',
    stateMutability: 'view',
    inputs: [
      { name: 'institution', type: 'address' },
      { name: 'teacher', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'InstitutionApproved',
    inputs: [
      { indexed: true, name: 'institution', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
    ],
  },
] as const;
