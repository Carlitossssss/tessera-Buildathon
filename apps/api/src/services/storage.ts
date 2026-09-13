import { randomBytes, createHash } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface UploadedAsset {
  primaryUrl: string;
  fallbackUrl?: string;
  stagingUrl?: string;
  arweaveTxId?: string;
  ipfsCid?: string;
  pinataFileId?: string;
  pinataGroupId?: string;
  sha256: string;
  size: number;
  contentType: string;
}

export interface StoredAsset {
  data: Buffer;
  contentType: string;
}

type FetchLike = typeof fetch;

type PinataUpload = {
  cid: string;
  fileId: string;
  groupId?: string;
  size: number;
  mimeType: string;
};

export type PinataDirectoryUpload = {
  cid: string;
  size: number;
};

/** One file as it was pinned inside a certificate bundle directory. */
export type BundleFile = {
  name: string;
  contentType: string;
  sha256: string;
  size: number;
  arweaveTxId?: string;
  stagingUrl?: string;
};

export type UploadedBundle = {
  /** CIDv1 of the directory that holds every artifact of the certificate. */
  ipfsCid: string;
  size: number;
  files: Record<string, BundleFile>;
};

export type DirectoryFile = {
  data: Buffer;
  name: string;
  contentType: string;
};

function getObjectStorageClient(): S3Client | undefined {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) return undefined;
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

async function uploadObjectStorage(
  data: Buffer,
  key: string,
  contentType: string,
): Promise<string | undefined> {
  const client = getObjectStorageClient();
  if (!client) return undefined;
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
    return env.S3_PUBLIC_URL ? `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}` : undefined;
  } catch (err) {
    logger.warn({ err, provider: env.OBJECT_STORAGE_PROVIDER, key }, 'Object storage upload fallo');
    return undefined;
  }
}

/**
 * Sube un objeto SOLO al object storage privado.
 *
 * A diferencia de uploadAsset, no toca IPFS ni Arweave: el contenido de pago
 * del portal no debe quedar publicado en una red publica, porque entonces
 * cualquiera lo leeria sin membresia y el Lock dejaria de controlar nada.
 */
export async function uploadPrivateObject(input: {
  data: Buffer;
  key: string;
  contentType: string;
}): Promise<{ key: string; size: number; sha256: string }> {
  const stored = await uploadObjectStorage(input.data, input.key, input.contentType);
  if (stored === undefined && !getObjectStorageClient()) {
    throw new Error('Object storage no esta configurado: no se puede guardar contenido privado');
  }
  return {
    key: input.key,
    size: input.data.length,
    sha256: createHash('sha256').update(input.data).digest('hex'),
  };
}

export async function getObjectStorageAsset(key: string): Promise<StoredAsset | undefined> {
  const client = getObjectStorageClient();
  if (!client) return undefined;
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
      }),
    );
    if (!response.Body) return undefined;
    return {
      data: Buffer.from(await response.Body.transformToByteArray()),
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  } catch (err) {
    logger.debug({ err, provider: env.OBJECT_STORAGE_PROVIDER, key }, 'Object storage read fallo');
    return undefined;
  }
}

function deterministicMock(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 40);
}

async function uploadArweave(data: Buffer, contentType: string): Promise<string | undefined> {
  if (!env.ARWEAVE_JWK_JSON) return undefined;
  try {
    const Arweave = (await import('arweave')).default;
    const jwk = JSON.parse(env.ARWEAVE_JWK_JSON);
    const ar = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
    const tx = await ar.createTransaction({ data }, jwk);
    tx.addTag('Content-Type', contentType);
    tx.addTag('App-Name', 'Tessera');
    await ar.transactions.sign(tx, jwk);
    const posted = (await ar.transactions.post(tx)) as { status: number };
    if (posted.status < 200 || posted.status >= 300) {
      throw new Error(`Arweave respondio ${posted.status}`);
    }
    return tx.id;
  } catch (err) {
    logger.warn({ err }, 'Arweave upload fallo, usando fallback');
    return undefined;
  }
}

export async function uploadPinataPublic(
  input: {
    data: Buffer;
    name: string;
    contentType: string;
    groupId?: string;
  },
  dependencies: { fetchImpl?: FetchLike; jwt?: string } = {},
): Promise<PinataUpload | undefined> {
  const jwt = dependencies.jwt ?? env.PINATA_JWT;
  if (!jwt) return undefined;

  const form = new FormData();
  form.append(
    'file',
    new File([new Uint8Array(input.data)], input.name, { type: input.contentType }),
  );
  form.append('network', 'public');
  form.append('name', input.name);
  form.append('cid_version', 'v1');
  if (input.groupId) form.append('group_id', input.groupId);

  const res = await (dependencies.fetchImpl ?? fetch)('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata V3 respondio ${res.status}`);

  const body = (await res.json()) as {
    data?: {
      id?: string;
      cid?: string;
      size?: number;
      mime_type?: string;
      group_id?: string | null;
    };
  };
  const uploaded = body.data;
  if (!uploaded?.id || !uploaded.cid || !/^b[a-z2-7]{20,}$/i.test(uploaded.cid)) {
    throw new Error('Pinata V3 no devolvio un CIDv1 valido');
  }
  if (uploaded.mime_type !== input.contentType) {
    throw new Error(
      `Pinata V3 devolvio MIME ${uploaded.mime_type ?? 'desconocido'}; se esperaba ${input.contentType}`,
    );
  }
  if (uploaded.size !== input.data.length) {
    throw new Error(
      `Pinata V3 devolvio ${uploaded.size ?? 'desconocido'} bytes; se esperaban ${input.data.length}`,
    );
  }

  return {
    cid: uploaded.cid,
    fileId: uploaded.id,
    groupId: uploaded.group_id ?? input.groupId,
    size: uploaded.size,
    mimeType: uploaded.mime_type,
  };
}

export async function uploadPinataDirectoryPublic(
  input: { files: DirectoryFile[]; name: string; groupId?: string },
  dependencies: { fetchImpl?: FetchLike; jwt?: string } = {},
): Promise<PinataDirectoryUpload | undefined> {
  const jwt = dependencies.jwt ?? env.PINATA_JWT;
  if (!jwt) return undefined;
  if (input.files.length < 2) throw new Error('Un directorio IPFS requiere al menos dos archivos');

  const form = new FormData();
  for (const file of input.files) {
    form.append(
      'file',
      new File([new Uint8Array(file.data)], file.name, { type: file.contentType }),
      `${input.name}/${file.name}`,
    );
  }
  form.append('pinataMetadata', JSON.stringify({ name: input.name }));
  form.append(
    'pinataOptions',
    JSON.stringify({ cidVersion: 1, ...(input.groupId ? { groupId: input.groupId } : {}) }),
  );

  const res = await (dependencies.fetchImpl ?? fetch)(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    },
  );
  if (!res.ok) throw new Error(`Pinata directory upload respondio ${res.status}`);

  const body = (await res.json()) as { IpfsHash?: string; PinSize?: number };
  if (!body.IpfsHash || !/^b[a-z2-7]{20,}$/i.test(body.IpfsHash)) {
    throw new Error('Pinata no devolvio un CIDv1 valido para el directorio');
  }
  if (typeof body.PinSize !== 'number' || body.PinSize <= 0) {
    throw new Error('Pinata no devolvio un tamano valido para el directorio');
  }

  return { cid: body.IpfsHash, size: body.PinSize };
}

/**
 * Pins a directory through the Pinata V3 uploads API, the same endpoint used for
 * single files. Multiple `file` parts with a shared folder prefix produce one
 * UnixFS directory whose CIDv1 addresses every artifact of the certificate.
 */
export async function uploadPinataDirectoryV3(
  input: { files: DirectoryFile[]; name: string; groupId?: string },
  dependencies: { fetchImpl?: FetchLike; jwt?: string } = {},
): Promise<PinataDirectoryUpload | undefined> {
  const jwt = dependencies.jwt ?? env.PINATA_JWT;
  if (!jwt) return undefined;
  if (input.files.length < 2) throw new Error('Un directorio IPFS requiere al menos dos archivos');

  const form = new FormData();
  for (const file of input.files) {
    form.append(
      'file',
      new File([new Uint8Array(file.data)], file.name, { type: file.contentType }),
      `${input.name}/${file.name}`,
    );
  }
  form.append('network', 'public');
  form.append('name', input.name);
  form.append('cid_version', 'v1');
  if (input.groupId) form.append('group_id', input.groupId);

  const res = await (dependencies.fetchImpl ?? fetch)('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata V3 directory respondio ${res.status}`);

  const body = (await res.json()) as { data?: { cid?: string; size?: number } };
  const cid = body.data?.cid;
  if (!cid || !/^b[a-z2-7]{20,}$/i.test(cid)) {
    throw new Error('Pinata V3 no devolvio un CIDv1 valido para el directorio');
  }
  return { cid, size: body.data?.size ?? 0 };
}

/**
 * Pins one directory, preferring the V3 uploads API and falling back to the
 * legacy pinning API so a JWT scoped to only one of them still works.
 */
export async function uploadPinataDirectory(
  input: { files: DirectoryFile[]; name: string; groupId?: string },
  dependencies: { fetchImpl?: FetchLike; jwt?: string } = {},
): Promise<PinataDirectoryUpload | undefined> {
  try {
    const uploaded = await uploadPinataDirectoryV3(input, dependencies);
    if (uploaded) return uploaded;
  } catch (err) {
    logger.warn({ err, name: input.name }, 'Pinata V3 directory fallo, usando pinFileToIPFS');
  }
  return uploadPinataDirectoryPublic(input, dependencies);
}

/**
 * Pins every artifact of a certificate as a single IPFS directory, so Pinata
 * shows one entry per credential instead of scattered files. Arweave and the
 * private object storage receive the same bytes as durable mirrors.
 */
export async function uploadAssetBundle(input: {
  name: string;
  files: Array<{ data: Buffer; name: string; contentType: string; stagingKey?: string }>;
}): Promise<UploadedBundle> {
  const directory = await uploadPinataDirectory({
    name: input.name,
    files: input.files.map(({ data, name, contentType }) => ({ data, name, contentType })),
  });
  if (!directory) {
    throw new Error('Pinata no esta configurado: no se pudo fijar el certificado en IPFS');
  }

  const files: Record<string, BundleFile> = {};
  await Promise.all(
    input.files.map(async (file) => {
      const [arweaveTxId, stagingUrl] = await Promise.all([
        uploadArweave(file.data, file.contentType),
        file.stagingKey
          ? uploadObjectStorage(file.data, file.stagingKey, file.contentType)
          : Promise.resolve(undefined),
      ]);
      files[file.name] = {
        name: file.name,
        contentType: file.contentType,
        sha256: createHash('sha256').update(file.data).digest('hex'),
        size: file.data.length,
        arweaveTxId,
        stagingUrl,
      };
    }),
  );

  return { ipfsCid: directory.cid, size: directory.size, files };
}

export async function uploadAsset(input: {
  data: Buffer;
  name: string;
  contentType: string;
  stagingKey: string;
  pinataGroupId?: string;
}): Promise<UploadedAsset> {
  const { data, name, contentType, stagingKey, pinataGroupId } = input;
  const sha256 = createHash('sha256').update(data).digest('hex');

  const [arweaveId, pinata, stagingUrl] = await Promise.all([
    uploadArweave(data, contentType),
    uploadPinataPublic({ data, name, contentType, groupId: pinataGroupId }),
    uploadObjectStorage(data, stagingKey, contentType),
  ]);
  const ipfsCid = pinata?.cid;

  if (!arweaveId && !ipfsCid) {
    const id = deterministicMock(data);
    return {
      primaryUrl: `mock://asset/${id}`,
      stagingUrl,
      sha256,
      size: data.length,
      contentType,
    };
  }

  const primaryUrl = arweaveId ? `${env.ARWEAVE_GATEWAY}/${arweaveId}` : `ipfs://${ipfsCid}`;

  return {
    primaryUrl,
    fallbackUrl: arweaveId && ipfsCid ? `ipfs://${ipfsCid}` : undefined,
    arweaveTxId: arweaveId,
    ipfsCid,
    pinataFileId: pinata?.fileId,
    stagingUrl,
    pinataGroupId: pinata?.groupId,
    sha256,
    size: data.length,
    contentType,
  };
}

export async function uploadMetadata(
  meta: Record<string, unknown>,
  options: { certificateId?: string; pinataGroupId?: string } = {},
): Promise<UploadedAsset> {
  const buf = Buffer.from(JSON.stringify(meta));
  const suffix = options.certificateId ?? deterministicMock(buf);
  return uploadAsset({
    data: buf,
    name: `certificate-${suffix}-metadata.json`,
    contentType: 'application/json',
    stagingKey: `metadata/${deterministicMock(buf)}.json`,
    pinataGroupId: options.pinataGroupId,
  });
}

export function generateSecret(length = 32): string {
  return randomBytes(length).toString('hex');
}
