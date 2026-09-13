import { describe, expect, it } from 'vitest';
import { buildCertificateMetadata } from './certificate-metadata.js';

const IMAGE_CID = 'bafkreifz7qrzismcyhm2esg2rxzicjg6ddi5ak3o67yhypnvmpsaw5allm';

const input = {
  certificateId: 'b72f4918-65de-4341-85b1-6ae717ad815a',
  studentWallet: '0x1111111111111111111111111111111111111111',
  institutionWallet: '0x2222222222222222222222222222222222222222',
  network: 'polygonAmoy',
  chainId: 80002,
  contractAddress: '0x7747ec2ce010F374545A6B88fdA7397608E47E2e',
  courseId: 'c4d5f6d7-89ab-4def-9012-345678901234',
  issuedAt: '2026-08-10T02:39:38.879Z',
  completedAt: '2026-08-01T00:00:00.000Z',
  institutionName: 'Universidad Tessera',
  studentName: 'Luis Perez',
  achievementName: 'Solidity Avanzado',
  description: null,
  grade: 88,
  imageUrl: `https://ipfs.io/ipfs/${IMAGE_CID}`,
  imageIpfsUri: `ipfs://${IMAGE_CID}`,
  externalUrl:
    'https://tessera.blokis.dev/verify?certificateId=b72f4918-65de-4341-85b1-6ae717ad815a',
};

describe('buildCertificateMetadata', () => {
  it('publishes the fields an explorer renders', () => {
    const metadata = buildCertificateMetadata(input);

    expect(metadata.name).toBe('Solidity Avanzado - Luis Perez');
    expect(metadata.description).toContain('Certificado de Solidity Avanzado');
    expect(metadata.image).toBe(`https://ipfs.io/ipfs/${IMAGE_CID}`);
    expect(metadata.external_url).toBe(input.externalUrl);
    expect(metadata.image_ipfs).toBe(`ipfs://${IMAGE_CID}`);
  });

  it('keeps attributes as a plain trait_type/value list', () => {
    const metadata = buildCertificateMetadata(input);

    expect(metadata.attributes).toEqual([
      { trait_type: 'Recipient', value: 'Luis Perez' },
      { trait_type: 'Course', value: 'Solidity Avanzado' },
      { trait_type: 'Institution', value: 'Universidad Tessera' },
      { trait_type: 'Grade', value: 88 },
      { trait_type: 'Completed At', value: '2026-08-01' },
      { trait_type: 'Issued At', value: '2026-08-10' },
      { trait_type: 'Network', value: 'Polygon Amoy' },
      { trait_type: 'Token Standard', value: 'ERC-721 + ERC-5192' },
      { trait_type: 'Transferable', value: 'No' },
      { trait_type: 'Issuer', value: 'Tessera' },
      { trait_type: 'Certificate ID', value: input.certificateId },
      { trait_type: 'Issuer Wallet', value: input.institutionWallet },
    ]);
  });

  it('records the issuing institution, not the gas payer', () => {
    const metadata = buildCertificateMetadata(input);

    expect(metadata).toMatchObject({
      issuer_wallet: input.institutionWallet,
      issuer_onchain_getter: 'certificateIssuer(uint256)',
      gas_sponsor: 'Tessera',
    });
  });

  it('omits the issuer fields when the institution has no wallet', () => {
    const metadata = buildCertificateMetadata({ ...input, institutionWallet: null });

    expect(metadata.issuer_wallet).toBeUndefined();
    expect(metadata.issuer_onchain_getter).toBeUndefined();
    expect(metadata.attributes).not.toContainEqual(
      expect.objectContaining({ trait_type: 'Issuer Wallet' }),
    );
  });

  it('carries the full credential, not only what an explorer renders', () => {
    const metadata = buildCertificateMetadata(input);

    expect(metadata).toMatchObject({
      schema: 'tessera.certificate.v3',
      certificate_id: input.certificateId,
      course_name: 'Solidity Avanzado',
      course_id: input.courseId,
      recipient_name: 'Luis Perez',
      recipient_wallet: input.studentWallet,
      institution_name: 'Universidad Tessera',
      institution_wallet: input.institutionWallet,
      grade: 88,
      issued_at: '2026-08-10',
      issued_at_iso: input.issuedAt,
      completed_at: '2026-08-01',
      certificate_type: 'Soulbound Certificate (ERC-721 + ERC-5192)',
      token_standard: 'ERC-721',
      transferable: false,
      revocable: true,
      issuer: 'Tessera',
      blockchain: 'Polygon Amoy',
      network: 'polygonAmoy',
      chain_id: 80002,
      contract_address: input.contractAddress,
      verify_url: input.externalUrl,
      image_url: input.imageUrl,
    });
  });

  it('writes a description that reads on its own', () => {
    const description = buildCertificateMetadata(input).description as string;

    expect(description).toContain('Luis Perez');
    expect(description).toContain('Universidad Tessera');
    expect(description).toContain('calificacion de 88');
    expect(description).toContain('soulbound');
  });

  // A strict parser that trips on a nested value drops the whole document, and
  // every field here is expressible as a top-level scalar instead.
  it('stays flat: no nested objects and no display_type', () => {
    const metadata = buildCertificateMetadata(input);

    expect(metadata).not.toHaveProperty('properties');
    expect(metadata).not.toHaveProperty('files');
    for (const attribute of metadata.attributes as Array<Record<string, unknown>>) {
      expect(attribute).not.toHaveProperty('display_type');
      expect(Object.keys(attribute).sort()).toEqual(['trait_type', 'value']);
    }
    for (const value of Object.values(metadata)) {
      if (Array.isArray(value)) continue;
      expect(typeof value).not.toBe('object');
    }
  });

  it('drops the grade when the certificate has none', () => {
    const metadata = buildCertificateMetadata({ ...input, grade: null });
    const traits = (metadata.attributes as Array<{ trait_type: string }>).map((a) => a.trait_type);

    expect(traits).not.toContain('Grade');
    expect(metadata).not.toHaveProperty('grade');
  });

  it('never leaks the student email', () => {
    expect(buildCertificateMetadata(input)).not.toHaveProperty('student_email');
  });
});
