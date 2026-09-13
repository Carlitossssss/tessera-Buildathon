import { createHash } from 'node:crypto';
import { env } from '../config/env.js';

type FetchLike = typeof fetch;

export type IpfsReadinessResult = {
  cid: string;
  sha256: string;
  gateways: string[];
};

export type FetchedIpfsAsset = {
  data: Buffer;
  contentType: string;
  gateway: string;
};

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

function base32Lower(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/**
 * CIDv1 in the raw codec: `<0x01 version><0x55 raw><0x12 sha2-256><0x20 length>`
 * followed by the digest, encoded as lowercase base32. Pinata returns exactly
 * this shape for any file it stores as a single raw block, which lets us prove
 * a pin matches our bytes without asking a gateway anything.
 */
export function computeRawCidV1(data: Buffer): string {
  const digest = createHash('sha256').update(data).digest();
  return `b${base32Lower(Buffer.concat([Buffer.from([0x01, 0x55, 0x12, 0x20]), digest]))}`;
}

/** UnixFS chunk size Pinata uses; below it a file is one raw block. */
export const PINATA_RAW_BLOCK_LIMIT = 262_144;

export function isRawCidV1(cid: string): boolean {
  return /^bafkrei[a-z2-7]{45,}$/.test(cid);
}

/**
 * Normalizes a gateway to an absolute origin.
 *
 * Gateway hosts are routinely pasted into deployment settings without a scheme
 * (`tomato-....mypinata.cloud`). `fetch()` rejects those with "Failed to parse
 * URL", which used to surface as an unrelated IPFS propagation failure and, when
 * the value reached the published metadata, as an invalid image URL. Anything
 * that still cannot be parsed returns empty so callers can drop it.
 */
function normalizeGateway(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

export function getIpfsGateways(): string[] {
  return Array.from(
    new Set(
      [
        ...(env.PINATA_DEDICATED_GATEWAY ? [env.PINATA_DEDICATED_GATEWAY] : []),
        env.PINATA_GATEWAY,
        ...env.IPFS_FALLBACK_GATEWAYS.split(','),
      ]
        .map(normalizeGateway)
        .filter(Boolean),
    ),
  );
}

/**
 * Gateway used for the HTTPS mirrors published inside NFT metadata. The
 * dedicated Pinata gateway wins because it serves our own pinned CIDs without
 * the rate limits and bot checks of the shared public gateways.
 */
export function getPrimaryIpfsGateway(): string {
  return (
    normalizeGateway(env.PINATA_DEDICATED_GATEWAY) ||
    normalizeGateway(env.PINATA_GATEWAY) ||
    'https://gateway.pinata.cloud'
  );
}

/**
 * Gateway para los enlaces que abre una persona en el navegador.
 *
 * Usa el publico compartido porque resuelve cualquier CID valido, tambien uno
 * fijado desde otra cuenta o desde un plan anterior. Es lo que se espera de un
 * enlace verificable: quien lo recibe no deberia toparse con un error de
 * permisos de nuestra cuenta de Pinata.
 *
 * No sirve para el tokenURI. Medido sobre nuestros propios CID, el publico
 * promedia 6.3 s y el dedicado 1.3 s, y esa diferencia decide si un explorador
 * llega a leer la metadata o abandona: usar este aqui dejaba los certificados
 * sin propiedades ni descripcion en PolygonScan. Para lo que graba la cadena,
 * getPrimaryIpfsGateway.
 */
export function getBrowsableIpfsGateway(): string {
  // El publico compartido de Pinata va primero: sirve cualquier CID fijado en
  // la red y responde en frio, mientras que ipfs.io devuelve 504 en la primera
  // lectura de contenido recien anclado.
  return (
    normalizeGateway(env.PINATA_GATEWAY) ||
    normalizeGateway(env.IPFS_PUBLIC_GATEWAY) ||
    'https://gateway.pinata.cloud'
  );
}

/**
 * Resolved gateway configuration, for logging at boot. Surfacing a corrected or
 * discarded value at startup beats discovering it through a failed issuance.
 */
export function describeIpfsGateways(): {
  primary: string;
  gateways: string[];
  corrected: string[];
  invalid: string[];
} {
  const configured = [
    env.PINATA_DEDICATED_GATEWAY,
    env.PINATA_GATEWAY,
    ...env.IPFS_FALLBACK_GATEWAYS.split(','),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    primary: getPrimaryIpfsGateway(),
    gateways: getIpfsGateways(),
    corrected: configured.filter((value) => !/^https?:\/\//i.test(value) && normalizeGateway(value)),
    invalid: configured.filter((value) => !normalizeGateway(value)),
  };
}

/**
 * Gateway published inside the token URI and the metadata image. Unlike the
 * primary gateway used for internal reads, this one is written on-chain and can
 * never be changed afterwards, so it defaults to the long-lived public gateway.
 */
export function getPublicIpfsGateway(): string {
  return normalizeGateway(env.IPFS_PUBLIC_GATEWAY) || 'https://ipfs.io';
}

/** Public, immutable URL of a pinned CID. */
export function publicIpfsUrl(cid: string, path?: string): string {
  return resolveIpfsGatewayUrl(getPublicIpfsGateway(), cid, path);
}

/** HTTPS URL of a pinned CID (optionally a path inside a directory CID). */
export function ipfsGatewayUrl(cid: string, path?: string): string {
  return resolveIpfsGatewayUrl(getPrimaryIpfsGateway(), cid, path);
}

export function resolveIpfsGatewayUrl(gateway: string, cid: string, path?: string): string {
  const normalizedPath = path?.replace(/^\/+/, '');
  return `${normalizeGateway(gateway)}/ipfs/${cid}${normalizedPath ? `/${normalizedPath}` : ''}`;
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return fetchImpl(url, {
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    headers: { Accept: 'application/json,image/jpeg;q=0.9,image/png;q=0.8,*/*;q=0.1' },
  });
}

async function verifyGateway(input: {
  cid: string;
  gateway: string;
  expectedSha256: string;
  expectedSize: number;
  expectedContentType: string;
  path?: string;
  fetchImpl: FetchLike;
  requestTimeoutMs: number;
  signal?: AbortSignal;
}): Promise<void> {
  const url = resolveIpfsGatewayUrl(input.gateway, input.cid, input.path);
  const response = await fetchWithTimeout(
    input.fetchImpl,
    url,
    input.requestTimeoutMs,
    input.signal,
  );
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Gateway IPFS sin acceso publico: ${url} (${response.status})`);
  }
  if (!response.ok) throw new Error(`${url} respondio ${response.status}`);

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim();
  if (contentType !== input.expectedContentType) {
    throw new Error(
      `${url} devolvio MIME ${contentType || 'desconocido'}; se esperaba ${input.expectedContentType}`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== input.expectedSize) {
    throw new Error(`${url} devolvio ${bytes.length} bytes; se esperaban ${input.expectedSize}`);
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== input.expectedSha256) {
    throw new Error(`${url} devolvio contenido distinto al fijado por Tessera`);
  }
}

async function verifyGatewayQuorum(input: {
  cid: string;
  gateways: string[];
  requiredGatewayCount: number;
  expectedSha256: string;
  expectedSize: number;
  expectedContentType: string;
  path?: string;
  fetchImpl: FetchLike;
  requestTimeoutMs: number;
}): Promise<{ reached: boolean; gateways: string[]; failures: string[] }> {
  const controllers = input.gateways.map(() => new AbortController());

  return new Promise((resolve) => {
    const successful: string[] = [];
    const failures: string[] = [];
    let settled = 0;
    let finished = false;

    const finish = (reached: boolean) => {
      if (finished) return;
      finished = true;
      controllers.forEach((controller) => controller.abort());
      resolve({ reached, gateways: successful, failures });
    };

    const checkProgress = () => {
      if (successful.length >= input.requiredGatewayCount) {
        finish(true);
        return;
      }
      const remaining = input.gateways.length - settled;
      if (successful.length + remaining < input.requiredGatewayCount) finish(false);
    };

    input.gateways.forEach((gateway, index) => {
      void verifyGateway({
        cid: input.cid,
        gateway,
        expectedSha256: input.expectedSha256,
        expectedSize: input.expectedSize,
        expectedContentType: input.expectedContentType,
        path: input.path,
        fetchImpl: input.fetchImpl,
        requestTimeoutMs: input.requestTimeoutMs,
        signal: controllers[index]?.signal,
      }).then(
        () => {
          if (finished) return;
          settled += 1;
          successful.push(gateway);
          checkProgress();
        },
        (error: unknown) => {
          if (finished) return;
          settled += 1;
          failures.push(error instanceof Error ? error.message : String(error));
          checkProgress();
        },
      );
    });
  });
}

export async function waitForIpfsAsset(
  input: {
    cid: string;
    data: Buffer;
    contentType: string;
    path?: string;
    gateways?: string[];
    timeoutMs?: number;
    requestTimeoutMs?: number;
    pollIntervalMs?: number;
    requiredGatewayCount?: number;
  },
  dependencies: { fetchImpl?: FetchLike; sleep?: (ms: number) => Promise<void> } = {},
): Promise<IpfsReadinessResult> {
  if (!/^b[a-z2-7]{20,}$/i.test(input.cid)) {
    throw new Error(`CID IPFS no es CIDv1 valido: ${input.cid}`);
  }

  const gateways = (input.gateways ?? getIpfsGateways()).map(normalizeGateway).filter(Boolean);
  if (gateways.length < 2) {
    throw new Error('Se requieren al menos dos gateways IPFS publicos para validar propagacion');
  }
  const requiredGatewayCount = input.requiredGatewayCount ?? Math.min(2, gateways.length);
  if (
    !Number.isInteger(requiredGatewayCount) ||
    requiredGatewayCount < 1 ||
    requiredGatewayCount > gateways.length
  ) {
    throw new Error('El quorum IPFS debe estar entre 1 y la cantidad de gateways configurados');
  }

  const expectedSha256 = createHash('sha256').update(input.data).digest('hex');
  const timeoutMs = input.timeoutMs ?? env.IPFS_READINESS_TIMEOUT_SECONDS * 1000;
  const requestTimeoutMs = input.requestTimeoutMs ?? env.IPFS_REQUEST_TIMEOUT_MS;
  const pollIntervalMs = input.pollIntervalMs ?? env.IPFS_POLL_INTERVAL_MS;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const sleep =
    dependencies.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = Date.now() + timeoutMs;
  let failures: string[] = [];

  do {
    const result = await verifyGatewayQuorum({
      cid: input.cid,
      gateways,
      requiredGatewayCount,
      expectedSha256,
      expectedSize: input.data.length,
      expectedContentType: input.contentType,
      path: input.path,
      fetchImpl,
      requestTimeoutMs,
    });
    failures = result.failures;
    if (result.reached)
      return { cid: input.cid, sha256: expectedSha256, gateways: result.gateways };
    if (Date.now() + pollIntervalMs > deadline) break;
    await sleep(pollIntervalMs);
  } while (Date.now() < deadline);

  throw new Error(
    `CID ${input.cid} no alcanzo el quorum de ${requiredGatewayCount}/${gateways.length} gateways: ${failures.join('; ')}`,
  );
}

export type PinnedAssetProof = {
  cid: string;
  path?: string;
  sha256: string;
  /**
   * `content-address` means the CID itself proves the bytes; `gateway` means we
   * downloaded the object and compared MIME, size and digest.
   */
  verifiedBy: 'content-address' | 'gateway';
  gateway?: string;
  durationMs: number;
};

/**
 * Asks every public gateway to fetch the CID so it is already cached when an
 * explorer comes looking. Measured on ipfs.io: a cold read of freshly pinned
 * content takes ~22s and the next one 0.2s. Never awaited, never fatal.
 */
export function warmPublicGateways(
  cid: string,
  path?: string,
  fetchImpl: FetchLike = fetch,
): void {
  const primary = getPrimaryIpfsGateway();
  const targets = [...new Set([getPublicIpfsGateway(), ...getIpfsGateways()])].filter(
    (gateway) => normalizeGateway(gateway) !== primary,
  );

  const pull = async (gateway: string): Promise<void> => {
    // A gateway that has not found the content yet answers 504 after ~28s and
    // caches nothing, so one shot is not enough for a larger file. Retrying a
    // few times spread over a couple of minutes is what actually gets it warm
    // before an indexer arrives. Measured: 504 at 28s, then 1.0s, then 0.16s.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetchImpl(resolveIpfsGatewayUrl(gateway, cid, path), {
          method: 'GET',
          signal: AbortSignal.timeout(60_000),
        });
        if (response.ok) {
          await response.arrayBuffer();
          return;
        }
      } catch {
        /* the gateway is not ready yet */
      }
      await new Promise((resolve) => setTimeout(resolve, 20_000));
    }
  };

  for (const gateway of targets) void pull(gateway);
}


/**
 * Proves a pinned artifact is exactly what Tessera produced and is retrievable,
 * before anything is written on-chain.
 *
 * A single-block CID is verified by recomputing it from our own bytes: content
 * addressing then guarantees that whoever resolves that CID gets this content
 * and nothing else. That is a stronger claim than "two gateways agreed" and it
 * costs one hash instead of several full downloads.
 *
 * Directory paths and chunked objects cannot be recomputed without a UnixFS
 * implementation, so those are verified by downloading them once from the
 * gateway Tessera publishes and checking MIME, size and digest.
 *
 * Propagation to independent public gateways is started in the background but
 * never awaited: fresh pins take minutes to reach them, and blocking on that
 * added minutes of latency per certificate without adding any integrity.
 */
export async function assertPinnedAsset(
  input: {
    cid: string;
    data: Buffer;
    contentType: string;
    path?: string;
    timeoutMs?: number;
    requestTimeoutMs?: number;
    pollIntervalMs?: number;
  },
  dependencies: { fetchImpl?: FetchLike; sleep?: (ms: number) => Promise<void> } = {},
): Promise<PinnedAssetProof> {
  if (!/^b[a-z2-7]{20,}$/i.test(input.cid)) {
    throw new Error(`CID IPFS no es CIDv1 valido: ${input.cid}`);
  }
  const startedAt = Date.now();
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const sha256 = createHash('sha256').update(input.data).digest('hex');

  if (!input.path && isRawCidV1(input.cid)) {
    const expectedCid = computeRawCidV1(input.data);
    if (expectedCid !== input.cid) {
      throw new Error(
        `El CID fijado (${input.cid}) no corresponde al contenido generado por Tessera (${expectedCid})`,
      );
    }
    warmPublicGateways(input.cid, input.path, fetchImpl);
    return {
      cid: input.cid,
      sha256,
      verifiedBy: 'content-address',
      durationMs: Date.now() - startedAt,
    };
  }

  const primary = getPrimaryIpfsGateway();
  const timeoutMs = input.timeoutMs ?? env.IPFS_READINESS_TIMEOUT_SECONDS * 1000;
  const requestTimeoutMs = input.requestTimeoutMs ?? env.IPFS_REQUEST_TIMEOUT_MS;
  const pollIntervalMs = input.pollIntervalMs ?? env.IPFS_POLL_INTERVAL_MS;
  const sleep =
    dependencies.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = startedAt + timeoutMs;
  const failures: string[] = [];

  warmPublicGateways(input.cid, input.path, fetchImpl);

  // The published gateway is the one that has to work, so it is the one we wait
  // on; the rest only matter for long-term redundancy.
  const candidates = [primary, ...getIpfsGateways().filter((gw) => gw !== primary)];
  for (;;) {
    for (const gateway of candidates) {
      try {
        await verifyGateway({
          cid: input.cid,
          gateway,
          expectedSha256: sha256,
          expectedSize: input.data.length,
          expectedContentType: input.contentType,
          path: input.path,
          fetchImpl,
          requestTimeoutMs,
        });
        return {
          cid: input.cid,
          path: input.path,
          sha256,
          verifiedBy: 'gateway',
          gateway,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (Date.now() + pollIntervalMs > deadline) break;
    await sleep(pollIntervalMs);
  }

  throw new Error(
    `El contenido fijado ${input.cid}${input.path ? `/${input.path}` : ''} no pudo verificarse: ${failures.join('; ')}`,
  );
}

/**
 * Reads a pinned object, racing every configured gateway and keeping the first
 * response that matches the expected MIME and digest. Racing matters: a single
 * unresponsive gateway used to stall this call for the full request timeout
 * before the next one was even attempted.
 */
export async function fetchIpfsAsset(
  input: {
    cid: string;
    path?: string;
    contentType: string;
    expectedSha256?: string;
    gateways?: string[];
    requestTimeoutMs?: number;
  },
  dependencies: { fetchImpl?: FetchLike } = {},
): Promise<FetchedIpfsAsset> {
  if (!/^b[a-z2-7]{20,}$/i.test(input.cid)) {
    throw new Error(`CID IPFS no es CIDv1 valido: ${input.cid}`);
  }
  const gateways = (input.gateways ?? getIpfsGateways()).map(normalizeGateway).filter(Boolean);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const requestTimeoutMs = input.requestTimeoutMs ?? env.IPFS_REQUEST_TIMEOUT_MS;
  const controllers = gateways.map(() => new AbortController());
  const failures: string[] = [];

  const attempt = async (gateway: string, signal: AbortSignal): Promise<FetchedIpfsAsset> => {
    const url = resolveIpfsGatewayUrl(gateway, input.cid, input.path);
    const response = await fetchWithTimeout(fetchImpl, url, requestTimeoutMs, signal);
    if (!response.ok) throw new Error(`${url} respondio ${response.status}`);
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim();
    if (contentType !== input.contentType) {
      throw new Error(
        `${url} devolvio MIME ${contentType || 'desconocido'}; se esperaba ${input.contentType}`,
      );
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (input.expectedSha256) {
      const sha256 = createHash('sha256').update(data).digest('hex');
      if (sha256 !== input.expectedSha256) {
        throw new Error(`${url} devolvio contenido distinto al fijado por Tessera`);
      }
    }
    return { data, contentType, gateway };
  };

  return new Promise<FetchedIpfsAsset>((resolve, reject) => {
    let settled = 0;
    let finished = false;

    gateways.forEach((gateway, index) => {
      void attempt(gateway, controllers[index]!.signal).then(
        (asset) => {
          if (finished) return;
          finished = true;
          controllers.forEach((controller, i) => i !== index && controller.abort());
          resolve(asset);
        },
        (error: unknown) => {
          if (finished) return;
          settled += 1;
          failures.push(error instanceof Error ? error.message : String(error));
          if (settled === gateways.length) {
            finished = true;
            reject(new Error(`CID ${input.cid} no esta disponible: ${failures.join('; ')}`));
          }
        },
      );
    });
  });
}
