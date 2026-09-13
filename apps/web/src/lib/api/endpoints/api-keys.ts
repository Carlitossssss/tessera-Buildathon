import { apiRequest } from '../client';

export type ApiKeyScope =
  | 'certificates:read'
  | 'certificates:write'
  | 'badges:read'
  | 'badges:write'
  | 'courses:read'
  | 'courses:write'
  | 'wallet:read';

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreated extends ApiKey {
  key: string;
  warning: string;
}

export const apiKeysApi = {
  list: (token: string) => apiRequest<ApiKey[]>('/v1/api-keys', { token }),
  create: (token: string, body: { name: string; scopes: ApiKeyScope[]; expiresInDays?: number }) =>
    apiRequest<ApiKeyCreated>('/v1/api-keys', { method: 'POST', token, body }),
  revoke: (token: string, id: string) =>
    apiRequest<{ revoked: boolean; id: string }>(`/v1/api-keys/${id}`, { method: 'DELETE', token }),
};
