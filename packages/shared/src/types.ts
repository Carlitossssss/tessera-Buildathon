import type { Role, Plan, CertificateStatus, JobStatus, WebhookEvent } from './constants.js';

export type { Role, Plan, CertificateStatus, JobStatus, WebhookEvent };

export interface AuthContext {
  userId: string;
  institutionId: string | null;
  role: Role;
  email: string;
  restricted?: boolean;
  restrictedAt?: Date | string | null;
  restrictionReason?: string | null;
}

export interface ApiKeyContext {
  apiKeyId: string;
  institutionId: string;
  scopes: string[];
  plan: Plan;
}

export interface CertificateMetadata {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
  properties: {
    tokenId?: string;
    institution: {
      id: string;
      name: string;
      walletAddress: string;
    };
    student: {
      name?: string;
      walletAddress: string;
    };
    achievement: {
      name: string;
      grade?: number;
      completedAt: string;
    };
    issuedAt: string;
  };
}

export interface IssueCertificateJobData {
  certificateId: string;
  institutionId: string;
  studentUserId: string;
  studentWallet: string;
  tokenUri: string;
  callbackUrl?: string;
}

export interface WebhookDeliveryJobData {
  webhookEventId: string;
  url: string;
  payload: Record<string, unknown>;
  secret: string;
  event: WebhookEvent;
  attemptNumber: number;
  apiKeyId?: string;
}

export interface PaymentWebhookJobData {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface GdprExportJobData {
  userId: string;
  requestId: string;
  email: string;
}

export interface GdprDeletionJobData {
  userId: string;
  requestId: string;
  scheduledFor: string;
}
