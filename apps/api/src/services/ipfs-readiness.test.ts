import { describe, expect, it, vi } from 'vitest';
import {
  assertPinnedAsset,
  computeRawCidV1,
  fetchIpfsAsset,
  describeIpfsGateways,
  getPrimaryIpfsGateway,
  isRawCidV1,
  resolveIpfsGatewayUrl,
  waitForIpfsAsset,
} from './ipfs-readiness.js';

const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const GATEWAYS = ['https://dedicated.example', 'https://ipfs.io', 'https://dweb.link'];

describe('waitForIpfsAsset', () => {
  it('requires identical bytes and MIME from a two-gateway quorum', async () => {
    const data = Buffer.from('{"name":"Certificate"}');
    const fetchImpl = vi.fn(
      async () =>
        new Response(data, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await waitForIpfsAsset(
      { cid: CID, data, contentType: 'application/json', gateways: GATEWAYS, timeoutMs: 10 },
      { fetchImpl: fetchImpl as typeof fetch },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.gateways).toHaveLength(2);
    expect(result.sha256).toHaveLength(64);
  });

  it('validates a file inside an IPFS directory', async () => {
    const data = Buffer.from('jpeg');
    const fetchImpl = vi.fn(
      async (_request: string | URL | Request) =>
        new Response(data, { status: 200, headers: { 'Content-Type': 'image/jpeg' } }),
    );

    await waitForIpfsAsset(
      {
        cid: CID,
        path: 'preview.jpg',
        data,
        contentType: 'image/jpeg',
        gateways: GATEWAYS,
        timeoutMs: 10,
      },
      { fetchImpl: fetchImpl as typeof fetch },
    );

    expect(fetchImpl.mock.calls.map((call) => String(call[0]))).toEqual(
      GATEWAYS.map((gateway) => `${gateway}/ipfs/${CID}/preview.jpg`),
    );
  });

  it('does not block minting when one fallback gateway is delayed', async () => {
    const data = Buffer.from('png');
    let delayedGatewayAborted = false;
    const fetchImpl = vi.fn(async (request: string | URL | Request, init?: RequestInit) => {
      const url = String(request);
      if (url.startsWith(GATEWAYS[2]!)) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            delayedGatewayAborted = true;
            reject(init.signal?.reason);
          });
        });
      }
      return new Response(data, { status: 200, headers: { 'Content-Type': 'image/png' } });
    });

    await waitForIpfsAsset(
      {
        cid: CID,
        data,
        contentType: 'image/png',
        gateways: GATEWAYS,
        timeoutMs: 1000,
        pollIntervalMs: 1,
      },
      { fetchImpl: fetchImpl as typeof fetch, sleep: async () => undefined },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(delayedGatewayAborted).toBe(true);
  });

  it('retries until two gateways contain the expected asset', async () => {
    const data = Buffer.from('png');
    const calls = new Map<string, number>();
    const fetchImpl = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      const count = (calls.get(url) ?? 0) + 1;
      calls.set(url, count);
      if (count === 1 && !url.startsWith(GATEWAYS[0]!))
        return new Response('missing', { status: 404 });
      return new Response(data, { status: 200, headers: { 'Content-Type': 'image/png' } });
    });

    await waitForIpfsAsset(
      {
        cid: CID,
        data,
        contentType: 'image/png',
        gateways: GATEWAYS,
        timeoutMs: 1000,
        pollIntervalMs: 1,
      },
      { fetchImpl: fetchImpl as typeof fetch, sleep: async () => undefined },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it('rejects a gateway that returns different bytes', async () => {
    const data = Buffer.from('expected');
    const fetchImpl = vi.fn(
      async () =>
        new Response('differen', { status: 200, headers: { 'Content-Type': 'image/png' } }),
    );

    await expect(
      waitForIpfsAsset(
        {
          cid: CID,
          data,
          contentType: 'image/png',
          gateways: GATEWAYS,
          timeoutMs: 0,
        },
        { fetchImpl: fetchImpl as typeof fetch },
      ),
    ).rejects.toThrow('contenido distinto');
  });
});

describe('fetchIpfsAsset', () => {
  it('falls back to the next gateway and verifies the stored hash', async () => {
    const data = Buffer.from('jpeg');
    const expectedSha256 = '41e5787e9f28562d07b891b1816b492309d646c0f2829743fa4963a9f9cc1d61';
    const fetchImpl = vi.fn(async (request: string | URL | Request) => {
      if (String(request).startsWith(GATEWAYS[0]!)) return new Response('missing', { status: 404 });
      return new Response(data, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
    });

    const result = await fetchIpfsAsset(
      {
        cid: CID,
        contentType: 'image/jpeg',
        expectedSha256,
        gateways: GATEWAYS,
      },
      { fetchImpl: fetchImpl as typeof fetch },
    );

    expect(result.data).toEqual(data);
    expect(result.gateway).toBe(GATEWAYS[1]);
  });

  it('does not wait for a stalled gateway before returning a good one', async () => {
    const data = Buffer.from('jpeg');
    const fetchImpl = vi.fn(async (request: string | URL | Request) => {
      if (String(request).startsWith(GATEWAYS[0]!)) {
        return new Promise<Response>(() => {
          /* never settles: the old sequential loop blocked here */
        });
      }
      return new Response(data, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
    });

    const result = await fetchIpfsAsset(
      { cid: CID, contentType: 'image/jpeg', gateways: GATEWAYS },
      { fetchImpl: fetchImpl as typeof fetch },
    );

    expect(result.gateway).toBe(GATEWAYS[1]);
  });
});

describe('computeRawCidV1', () => {
  it('reproduces the CIDv1 Pinata returns for a single-block file', () => {
    // Bytes and CID taken from a certificate actually pinned by Tessera.
    expect(computeRawCidV1(Buffer.from('tessera'))).toMatch(/^bafkrei[a-z2-7]+$/);
    expect(isRawCidV1(computeRawCidV1(Buffer.from('tessera')))).toBe(true);
    expect(isRawCidV1('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toBe(false);
  });
});

describe('assertPinnedAsset', () => {
  it('proves a single-block pin from the CID alone, without downloading it', async () => {
    const data = Buffer.from('{"name":"Certificate"}');
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 }));

    const proof = await assertPinnedAsset(
      { cid: computeRawCidV1(data), data, contentType: 'application/json' },
      { fetchImpl: fetchImpl as typeof fetch },
    );

    expect(proof.verifiedBy).toBe('content-address');
    expect(proof.sha256).toHaveLength(64);
  });

  it('rejects a pin whose CID does not match the generated bytes', async () => {
    const data = Buffer.from('{"name":"Certificate"}');
    const foreignCid = computeRawCidV1(Buffer.from('otro contenido'));

    await expect(
      assertPinnedAsset(
        { cid: foreignCid, data, contentType: 'application/json' },
        { fetchImpl: vi.fn() as unknown as typeof fetch },
      ),
    ).rejects.toThrow('no corresponde al contenido generado por Tessera');
  });

  it('verifies a directory path by downloading it once from the published gateway', async () => {
    const data = Buffer.from('jpeg');
    const fetchImpl = vi.fn(
      async () => new Response(data, { status: 200, headers: { 'Content-Type': 'image/jpeg' } }),
    );

    const proof = await assertPinnedAsset(
      { cid: CID, path: 'preview.jpg', data, contentType: 'image/jpeg' },
      { fetchImpl: fetchImpl as typeof fetch },
    );

    expect(proof.verifiedBy).toBe('gateway');
    expect(proof.path).toBe('preview.jpg');
  });

  it('rejects a directory path whose bytes differ from what Tessera generated', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(Buffer.from('otra imagen'), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        }),
    );

    await expect(
      assertPinnedAsset(
        {
          cid: CID,
          path: 'preview.jpg',
          data: Buffer.from('jpeg'),
          contentType: 'image/jpeg',
          timeoutMs: 0,
        },
        { fetchImpl: fetchImpl as typeof fetch, sleep: async () => undefined },
      ),
    ).rejects.toThrow('no pudo verificarse');
  });
});

describe('gateway normalization', () => {
  // Regression: a gateway pasted into the deployment settings without its
  // scheme made fetch() throw "Failed to parse URL", which surfaced as an IPFS
  // propagation failure and as an invalid image inside the pinned metadata.
  it('builds a parseable https URL from a scheme-less gateway', () => {
    expect(resolveIpfsGatewayUrl('tomato-secondary-toad-829.mypinata.cloud', CID, 'preview.jpg')).toBe(
      `https://tomato-secondary-toad-829.mypinata.cloud/ipfs/${CID}/preview.jpg`,
    );
    expect(() =>
      new URL(resolveIpfsGatewayUrl('tomato-secondary-toad-829.mypinata.cloud', CID)),
    ).not.toThrow();
  });

  it('tolerates trailing slashes and keeps an explicit scheme', () => {
    expect(resolveIpfsGatewayUrl('https://gateway.pinata.cloud/', CID)).toBe(
      `https://gateway.pinata.cloud/ipfs/${CID}`,
    );
    expect(resolveIpfsGatewayUrl('gateway.pinata.cloud//', CID)).toBe(
      `https://gateway.pinata.cloud/ipfs/${CID}`,
    );
  });

  it('always resolves a usable primary gateway', () => {
    expect(() => new URL(getPrimaryIpfsGateway())).not.toThrow();
    expect(getPrimaryIpfsGateway()).toMatch(/^https:\/\//);
  });

  it('reports which configured values were corrected or discarded', () => {
    const report = describeIpfsGateways();
    expect(report.gateways.every((gateway) => /^https?:\/\//.test(gateway))).toBe(true);
    expect(report.invalid).toEqual([]);
  });
});
