import { describe, expect, it, vi } from 'vitest';
import {
  uploadPinataDirectory,
  uploadPinataDirectoryPublic,
  uploadPinataDirectoryV3,
  uploadPinataPublic,
} from './storage.js';

describe('uploadPinataPublic', () => {
  it('uploads a public CIDv1 file through Pinata V3 with the declared MIME', async () => {
    const data = Buffer.from('png bytes');
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const form = init?.body as FormData;
      const file = form.get('file') as File;
      expect(form.get('network')).toBe('public');
      expect(form.get('cid_version')).toBe('v1');
      expect(form.get('name')).toBe('certificate.png');
      expect(file.name).toBe('certificate.png');
      expect(file.type).toBe('image/png');
      expect(file.size).toBe(data.length);

      return new Response(
        JSON.stringify({
          data: {
            id: 'file-id',
            cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
            size: data.length,
            mime_type: 'image/png',
            group_id: null,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const result = await uploadPinataPublic(
      { data, name: 'certificate.png', contentType: 'image/png' },
      { fetchImpl: fetchImpl as typeof fetch, jwt: 'test-jwt' },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://uploads.pinata.cloud/v3/files');
    expect(result).toMatchObject({
      fileId: 'file-id',
      cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      mimeType: 'image/png',
      size: data.length,
    });
  });

  it('rejects legacy CIDv0 responses', async () => {
    const data = Buffer.from('{}');
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              id: 'file-id',
              cid: 'QmZzRkjxSprxVNcKsxLXBsn8qZBNLUhCEFuyPaxx5L6612',
              size: data.length,
              mime_type: 'application/json',
            },
          }),
          { status: 200 },
        ),
    );

    await expect(
      uploadPinataPublic(
        { data, name: 'metadata.json', contentType: 'application/json' },
        { fetchImpl: fetchImpl as typeof fetch, jwt: 'test-jwt' },
      ),
    ).rejects.toThrow('CIDv1');
  });
});

describe('uploadPinataDirectoryPublic', () => {
  it('uploads one CIDv1 directory containing all certificate artifacts', async () => {
    const files = [
      { name: 'metadata.json', data: Buffer.from('{}'), contentType: 'application/json' },
      { name: 'certificate.png', data: Buffer.from('png'), contentType: 'image/png' },
      { name: 'preview.jpg', data: Buffer.from('jpeg'), contentType: 'image/jpeg' },
    ];
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const form = init?.body as FormData;
      const uploaded = form.getAll('file') as File[];
      expect(uploaded.map((file) => file.name)).toEqual([
        'certificate-test/metadata.json',
        'certificate-test/certificate.png',
        'certificate-test/preview.jpg',
      ]);
      expect(JSON.parse(String(form.get('pinataMetadata')))).toEqual({
        name: 'certificate-test',
      });
      expect(JSON.parse(String(form.get('pinataOptions')))).toEqual({ cidVersion: 1 });

      return new Response(
        JSON.stringify({
          IpfsHash: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          PinSize: 123,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const result = await uploadPinataDirectoryPublic(
      { files, name: 'certificate-test' },
      { fetchImpl: fetchImpl as typeof fetch, jwt: 'test-jwt' },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.pinata.cloud/pinning/pinFileToIPFS');
    expect(result).toEqual({
      cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      size: 123,
    });
  });
});

describe('uploadPinataDirectoryV3', () => {
  it('pins every certificate artifact as one folder through the V3 uploads API', async () => {
    const files = [
      { name: 'certificate.png', data: Buffer.from('png'), contentType: 'image/png' },
      { name: 'preview.jpg', data: Buffer.from('jpeg'), contentType: 'image/jpeg' },
    ];
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const form = init?.body as FormData;
      const uploaded = form.getAll('file') as File[];
      expect(uploaded.map((file) => file.name)).toEqual([
        'certificate-test/certificate.png',
        'certificate-test/preview.jpg',
      ]);
      expect(form.get('network')).toBe('public');
      expect(form.get('cid_version')).toBe('v1');
      expect(form.get('name')).toBe('certificate-test');

      return new Response(
        JSON.stringify({
          data: {
            cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
            size: 7,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const result = await uploadPinataDirectoryV3(
      { files, name: 'certificate-test' },
      { fetchImpl: fetchImpl as typeof fetch, jwt: 'test-jwt' },
    );

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://uploads.pinata.cloud/v3/files');
    expect(result).toEqual({
      cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      size: 7,
    });
  });
});

describe('uploadPinataDirectory', () => {
  it('falls back to the legacy pinning API when V3 rejects the folder', async () => {
    const files = [
      { name: 'certificate.png', data: Buffer.from('png'), contentType: 'image/png' },
      { name: 'preview.jpg', data: Buffer.from('jpeg'), contentType: 'image/jpeg' },
    ];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('uploads.pinata.cloud')) {
        return new Response('forbidden', { status: 403 });
      }
      return new Response(
        JSON.stringify({
          IpfsHash: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          PinSize: 7,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const result = await uploadPinataDirectory(
      { files, name: 'certificate-test' },
      { fetchImpl: fetchImpl as typeof fetch, jwt: 'test-jwt' },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe('https://api.pinata.cloud/pinning/pinFileToIPFS');
    expect(result?.cid).toBe('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
  });
});
