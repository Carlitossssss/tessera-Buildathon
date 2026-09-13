import { getAddress } from 'viem';
import { publicEnv } from '@/lib/env';

/**
 * Cliente del portal token-gated.
 *
 * El contenido completo nunca se pide sin firma: el backend exige una prueba
 * de propiedad de la wallet ademas de la membresia on-chain, asi que aqui solo
 * armamos el mensaje exacto que el servidor va a verificar.
 */

const API = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '');

export interface PortalLock {
  address: string;
  chainId: number;
  checkoutUrl: string;
}

export interface PortalContent {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  kind: 'text' | 'image' | 'video' | 'audio';
  mimeType: string | null;
  byteSize: number | null;
  publishedAt: string | null;
  /** Si viene, completar el contenido emite un certificado con este nombre. */
  certifiesAchievement: string | null;
  lock: PortalLock;
  preview: {
    available: boolean;
    text: string | null;
    seconds: number | null;
    url: string | null;
  };
}

export interface LockInfo {
  address: string;
  chainId: number;
  network: string;
  name: string | null;
  keyPriceWei: string | null;
  expirationDuration: number | null;
  checkoutUrl: string;
}

export interface AccessStatus {
  hasAccess: boolean;
  wallet: string;
  network: string;
  expiresAt: string | null;
  keyCount: number;
  lock: PortalLock;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Error ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function listContents(): Promise<PortalContent[]> {
  const body = await get<{ data: PortalContent[] }>('/v1/portal/contents');
  return body.data;
}

export async function getContent(
  slug: string,
): Promise<PortalContent & { lockInfo: LockInfo | null }> {
  const body = await get<{ data: PortalContent & { lockInfo: LockInfo | null } }>(
    `/v1/portal/content/${encodeURIComponent(slug)}`,
  );
  return body.data;
}

export async function checkAccess(slug: string, wallet: string): Promise<AccessStatus> {
  const body = await get<{ data: AccessStatus }>(
    `/v1/portal/content/${encodeURIComponent(slug)}/access?wallet=${wallet}`,
  );
  return body.data;
}

/**
 * Mensaje de propiedad. Debe coincidir byte a byte con buildOwnershipMessage
 * del backend: si difiere, la firma recupera otra address y el acceso se
 * deniega.
 */
export function buildOwnershipMessage(input: {
  walletAddress: string;
  slug: string;
  issuedAt: number;
}): string {
  return [
    'Tessera Portal: prueba de propiedad de wallet',
    // Normalizado a checksum igual que el backend. Las wallets del navegador
    // suelen devolver la address en minúsculas, y sin esto el texto difería
    // en varios bytes: la firma recuperaba otra address y TODA verificación
    // se rechazaba con "firma inválida o expirada".
    `Wallet: ${normalizeWallet(input.walletAddress)}`,
    `Contenido: ${input.slug}`,
    `Emitido: ${new Date(input.issuedAt).toISOString()}`,
    'Firmar no cuesta gas ni autoriza ningun pago.',
  ].join('\n');
}

/**
 * Address en formato checksum (EIP-55).
 *
 * Si no es una address válida se devuelve tal cual: el backend la rechazará
 * con su propio mensaje, que es más claro que romper aquí.
 */
function normalizeWallet(value: string): string {
  try {
    return getAddress(value);
  } catch {
    return value;
  }
}

export interface UnlockedContent {
  kind: 'text' | 'binary';
  text?: string;
  blobUrl?: string;
  mimeType?: string;
}

export type UnlockResult =
  | { ok: true; content: UnlockedContent }
  | { ok: false; reason: 'membership'; checkoutUrl: string }
  | { ok: false; reason: 'signature' | 'error'; message: string };

/**
 * Pide el contenido completo. Devuelve un resultado discriminado en vez de
 * lanzar, porque "no tenes membresia" es un estado normal del recorrido que la
 * UI debe mostrar con su boton de compra, no un fallo.
 */
export async function fetchFullContent(input: {
  slug: string;
  wallet: string;
  issuedAt: number;
  signature: string;
}): Promise<UnlockResult> {
  const params = new URLSearchParams({
    wallet: input.wallet,
    issuedAt: String(input.issuedAt),
    signature: input.signature,
  });

  const res = await fetch(
    `${API}/v1/portal/content/${encodeURIComponent(input.slug)}/full?${params}`,
    { cache: 'no-store' },
  );

  if (res.status === 402) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { checkoutUrl?: string };
    };
    return { ok: false, reason: 'membership', checkoutUrl: body.error?.checkoutUrl ?? '' };
  }

  if (res.status === 401) {
    return {
      ok: false,
      reason: 'signature',
      message: 'La firma expiró. Volvé a firmar para comprobar tu wallet.',
    };
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: false, reason: 'error', message: body.error?.message ?? `Error ${res.status}` };
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await res.json()) as { data?: { kind?: string; body?: string } };
    return { ok: true, content: { kind: 'text', text: body.data?.body ?? '' } };
  }

  const blob = await res.blob();
  return {
    ok: true,
    content: { kind: 'binary', blobUrl: URL.createObjectURL(blob), mimeType: contentType },
  };
}

/** Formatea un precio en wei para mostrarlo sin dependencias extra. */
export function formatPrice(wei: string | null): string {
  if (!wei) return '—';
  const value = Number(BigInt(wei)) / 1e18;
  if (value === 0) return 'Gratis';
  return `${value.toFixed(value < 0.01 ? 4 : 3)}`;
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return 'Sin vencimiento';
  const days = Math.round(seconds / 86_400);
  if (days >= 365) return `${Math.round(days / 365)} año(s)`;
  if (days >= 1) return `${days} día(s)`;
  return `${Math.round(seconds / 3600)} hora(s)`;
}

export interface CompletionResult {
  certificateId: string | null;
  achievement?: string;
  alreadyIssued: boolean;
  message?: string;
}

export type CompleteResponse =
  | { ok: true; result: CompletionResult }
  | { ok: false; reason: 'membership'; checkoutUrl: string }
  | { ok: false; reason: 'error'; message: string };

/**
 * Cierra el circulo: marca el contenido como completado y pide la credencial.
 *
 * El backend exige lo mismo que para leer (firma de propiedad + membresia
 * on-chain) porque emitir es mas costoso que leer: no puede pedir menos.
 */
export async function completeContent(input: {
  slug: string;
  wallet: string;
  issuedAt: number;
  signature: string;
  email: string;
  name: string;
}): Promise<CompleteResponse> {
  const res = await fetch(`${API}/v1/portal/content/${encodeURIComponent(input.slug)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: input.wallet,
      issuedAt: input.issuedAt,
      signature: input.signature,
      email: input.email,
      name: input.name,
    }),
  });

  if (res.status === 402) {
    const body = (await res.json().catch(() => ({}))) as { error?: { checkoutUrl?: string } };
    return { ok: false, reason: 'membership', checkoutUrl: body.error?.checkoutUrl ?? '' };
  }

  const payload = (await res.json().catch(() => ({}))) as {
    data?: CompletionResult;
    error?: { message?: string };
  };

  if (!res.ok || !payload.data) {
    return {
      ok: false,
      reason: 'error',
      message: payload.error?.message ?? `No pudimos emitir la credencial (${res.status}).`,
    };
  }

  return { ok: true, result: payload.data };
}
