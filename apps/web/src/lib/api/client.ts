import { publicEnv } from '../env';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  token?: string | null;
  apiKey?: string | null;
}

function buildUrl(path: string, query?: ApiRequestOptions['query']) {
  const base = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  const url = new URL(path.startsWith('/') ? `${base}${path}` : `${base}/${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiRequest<T = unknown>(
  path: string,
  opts: ApiRequestOptions = {},
): Promise<T> {
  const { query, body, token, apiKey, headers, ...rest } = opts;
  const finalHeaders = new Headers(headers);
  finalHeaders.set('Accept', 'application/json');
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  if (apiKey) finalHeaders.set('X-Api-Key', apiKey);

  const res = await fetch(buildUrl(path, query), {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: rest.cache ?? 'no-store',
  });

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload: unknown = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const nestedError =
      isJson &&
      typeof payload === 'object' &&
      payload &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'object' &&
      (payload as { error: object }).error
        ? ((payload as { error: Record<string, unknown> }).error ?? null)
        : null;
    const message =
      (isJson &&
      typeof payload === 'object' &&
      payload &&
      'message' in payload &&
      typeof (payload as { message: unknown }).message === 'string'
        ? (payload as { message: string }).message
        : null) ??
      (nestedError && typeof nestedError.message === 'string' ? nestedError.message : null) ??
      `Request failed with status ${res.status}`;
    const code =
      isJson &&
      typeof payload === 'object' &&
      payload &&
      'code' in payload &&
      typeof (payload as { code: unknown }).code === 'string'
        ? (payload as { code: string }).code
        : nestedError && typeof nestedError.code === 'string'
          ? nestedError.code
          : undefined;
    throw new ApiError(message, res.status, code, nestedError?.details ?? payload);
  }

  return payload as T;
}
