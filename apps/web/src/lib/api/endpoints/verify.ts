import { apiRequest } from '../client';

export interface VerifyCertificateResponse {
  valid: boolean;
  reason?: string;
  certificate: {
    tokenId: string | null;
    institution: string;
    /** Slug del emisor, para consultar su acreditacion on-chain. */
    institutionSlug?: string | null;
    achievement: string;
    description: string;
    studentName: string;
    grade: number | null;
    issuedAt: string | null;
    studentWallet: string | null;
    issuedByWallet: string;
  };
  blockchain: {
    confirmed: boolean;
    network: string;
    blockNumber: number | string | null;
    txHash: string | null;
    polygonscanUrl: string | null;
    nftUrl: string | null;
    contractAddress: string;
    contractUrl: string;
  };
  /**
   * Cada red donde vive el certificado. La primera es la de emision --la que
   * decide su validez--; las demas son replicas del mismo contenido.
   */
  networks?: {
    chainId: number;
    name: string;
    role: 'issuance' | 'mirror';
    status: string;
    tokenId: string | null;
    nftUrl: string | null;
    txUrl: string | null;
    contractUrl: string;
  }[];
  storage: {
    arweaveUrl: string | null;
    ipfsUrl: string | null;
    imageUrl: string | null;
    imageIpfsUrl: string | null;
    downloadUrl: string | null;
  };
  status: string;
  revokedAt: string | null;
  revokeReason: string | null;
  verifyUrl: string | null;
}

export const verifyApi = {
  verify(body: {
    tokenId?: string;
    txHash?: string;
    certificateId?: string;
  }): Promise<VerifyCertificateResponse> {
    return apiRequest('/v1/certificates/verify', { method: 'POST', body });
  },
};
