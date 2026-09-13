import { describe, expect, it } from 'vitest';
import {
  buildCertificateDetailResponse,
  buildCertificateListResponse,
  buildCertificateTrackingResponse,
  buildCertificateVerificationResponse,
} from './presenters.js';

const cert = {
  id: 'cert_1',
  studentEmail: 'student@example.com',
  studentName: 'Student Example',
  studentWallet: '0x5555555555555555555555555555555555555555',
  achievementName: 'Advanced Solidity',
  achievementDescription: 'Curso completado',
  grade: 95,
  courseId: 'c4d5f6d7-89ab-4def-9012-345678901234',
  status: 'issued',
  onchainTokenId: 1234n,
  txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  blockNumber: 58432100n,
  arweaveTxId: 'ARWEAVE_HASH',
  ipfsCid: 'QmCID',
  tokenUri: 'ar://ARWEAVE_HASH',
  issuedAt: new Date('2026-04-21T12:00:00.000Z'),
  revokedAt: null,
  revokeReason: null,
  createdAt: new Date('2026-04-21T11:59:00.000Z'),
};

const institution = {
  name: 'Universidad Tecnologica',
  walletAddress: '0x9999999999999999999999999999999999999999',
};

const options = {
  appUrl: 'https://app.tessera.io',
  apiPublicUrl: 'https://api.tessera.io',
  network: 'polygonAmoy',
  chainId: 80002,
  arweaveGateway: 'https://arweave.net',
  ipfsGateway: 'https://gateway.pinata.cloud',
  certificateContractAddress: '0x1111111111111111111111111111111111111111',
};

describe('certificate presenters', () => {
  it('genera el tracking response documentado', () => {
    expect(buildCertificateTrackingResponse('https://api.tessera.io', 'job_123', 'cert_1')).toEqual(
      {
        certificateId: 'cert_1',
        jobId: 'job_123',
        status: 'queued',
        estimatedCompletionSeconds: 30,
        trackingUrl: 'https://api.tessera.io/v1/jobs/job_123',
      },
    );
  });

  it('serializa paginación con total y hasMore', () => {
    const response = buildCertificateListResponse([cert], 1, 20, 21);
    expect(response.pagination).toEqual({ page: 1, limit: 20, total: 21, hasMore: true });
    expect(response.data[0]).toMatchObject({
      certificateId: 'cert_1',
      tokenId: '1234',
      achievementName: 'Advanced Solidity',
    });
  });

  it('serializa detalle y verificación de certificado alineados a la doc', () => {
    const detail = buildCertificateDetailResponse(cert, institution, options);
    const verify = buildCertificateVerificationResponse(cert, institution, true, options);

    expect(detail).toMatchObject({
      tokenId: '1234',
      institution: { name: institution.name, walletAddress: institution.walletAddress },
      metadata: { tokenUri: 'ar://ARWEAVE_HASH', ipfsCid: 'QmCID' },
      blockchain: { network: 'polygonAmoy' },
      verifyUrl: 'https://app.tessera.io/verify/1234',
    });

    expect(verify).toMatchObject({
      valid: true,
      certificate: {
        tokenId: '1234',
        institution: institution.name,
        achievement: cert.achievementName,
        description: cert.achievementDescription,
        studentName: cert.studentName,
        grade: cert.grade,
        studentWallet: cert.studentWallet,
      },
      storage: {
        arweaveUrl: 'https://arweave.net/ARWEAVE_HASH',
        ipfsUrl: 'https://gateway.pinata.cloud/ipfs/QmCID',
        imageUrl: 'https://api.tessera.io/v1/certificates/artwork/1234/certificate.png',
        downloadUrl:
          'https://api.tessera.io/v1/certificates/artwork/1234/certificate.png?download=1',
      },
      blockchain: {
        nftUrl: 'https://amoy.polygonscan.com/nft/0x1111111111111111111111111111111111111111/1234',
      },
    });
  });

  // Sin chainid ni type el explorador no sabe en que red buscar y abre la
  // ficha con el numero de token pero sin imagen ni propiedades, como si la
  // credencial no existiera.
  it('el enlace al NFT lleva la red en la query', () => {
    const verify = buildCertificateVerificationResponse(cert, institution, true, options);
    const issuance = verify.networks.find((n) => n.role === 'issuance');

    expect(issuance?.nftUrl).toBe(
      'https://amoy.polygonscan.com/nft/0x1111111111111111111111111111111111111111/1234?chainid=80002&type=erc721',
    );
  });

  // Una replica existente que no se puede abrir desde la verificacion es, para
  // quien verifica, un certificado que no existe.
  it('publica cada red donde vive el certificado, con su propio tokenId', () => {
    const verify = buildCertificateVerificationResponse(cert, institution, true, {
      ...options,
      mirrors: [{ chainId: 43113, status: 'confirmed', onchainTokenId: 7n, txHash: '0xabc' }],
    });

    expect(verify.networks).toHaveLength(2);

    const mirror = verify.networks.find((n) => n.role === 'mirror');
    expect(mirror?.name).toBe('Avalanche Fuji');
    // El id de la replica no coincide con el de la red principal: cada
    // contrato lleva su propio contador.
    expect(mirror?.tokenId).toBe('7');
    expect(mirror?.nftUrl).toContain('snowtrace');
    expect(mirror?.nftUrl).toContain('chainid=43113');
    expect(mirror?.txUrl).toContain('/tx/0xabc');
  });
});

describe('ipfsFiles', () => {
  it('links the metadata and the image as standalone CIDs', () => {
    const detail = buildCertificateDetailResponse(
      {
        ...cert,
        ipfsCid: 'bafkreimetadata000000000000000000000000000000000000000000',
        metadata: { certificateImageIpfsCid: 'bafkreiimage00000000000000000000000000000000000000000000' },
      },
      institution,
      options,
    );

    expect(detail.metadata.ipfsFiles).toEqual({
      metadataCid: 'bafkreimetadata000000000000000000000000000000000000000000',
      metadataUri: 'ipfs://bafkreimetadata000000000000000000000000000000000000000000',
      metadataUrl:
        'https://gateway.pinata.cloud/ipfs/bafkreimetadata000000000000000000000000000000000000000000',
      imageCid: 'bafkreiimage00000000000000000000000000000000000000000000',
      imageUri: 'ipfs://bafkreiimage00000000000000000000000000000000000000000000',
      imageUrl:
        'https://gateway.pinata.cloud/ipfs/bafkreiimage00000000000000000000000000000000000000000000',
    });
  });
});
