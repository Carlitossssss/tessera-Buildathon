import type { Address, TypedDataDomain } from 'viem';

export const ISSUANCE_TYPES = {
  IssuancePayload: [
    { name: 'student', type: 'address' },
    { name: 'institution', type: 'address' },
    { name: 'uri', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export interface IssuancePayload {
  student: Address;
  institution: Address;
  uri: string;
  nonce: bigint;
  deadline: bigint;
}

export function buildIssuanceDomain(params: {
  verifyingContract: Address;
  chainId: number;
  name?: string;
  version?: string;
}): TypedDataDomain {
  return {
    name: params.name ?? 'TesseraAutoIssuer',
    version: params.version ?? '1',
    chainId: params.chainId,
    verifyingContract: params.verifyingContract,
  };
}
