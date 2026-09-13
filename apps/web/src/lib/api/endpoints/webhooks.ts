import { apiRequest } from '../client';

export type WebhookEvent =
  | 'certificate.issued'
  | 'certificate.failed'
  | 'certificate.revoked'
  | 'badge.issued'
  | 'credits.low_balance'
  | 'payment.received';

export interface Webhook {
  id: string;
  institutionId: string;
  url: string;
  events: WebhookEvent[];
  disabledAt: string | null;
  createdAt: string;
}

export interface WebhookCreated extends Webhook {
  secret: string;
}

export const webhooksApi = {
  list: (token: string) => apiRequest<Webhook[]>('/v1/webhooks', { token }),
  create: (token: string, body: { url: string; events: WebhookEvent[] }) =>
    apiRequest<WebhookCreated>('/v1/webhooks', { method: 'POST', token, body }),
  remove: (token: string, id: string) =>
    apiRequest<{ disabled: true }>(`/v1/webhooks/${id}`, { method: 'DELETE', token }),
};
