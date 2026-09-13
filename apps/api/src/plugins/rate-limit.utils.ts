import type { Plan } from '@tessera/shared/constants';
import { env } from '../config/env.js';

export interface RateLimitContext {
  ip: string;
  auth?: { userId: string } | null;
  apiKey?: { apiKeyId: string; plan: Plan } | null;
}

export function planRateLimits(): Record<Plan, number> {
  return {
    starter: env.RATE_LIMIT_STARTER,
    pro: env.RATE_LIMIT_PRO,
    pro_extended: env.RATE_LIMIT_PRO_EXTENDED,
  };
}

export function resolveRateLimitKey(context: RateLimitContext): string {
  if (context.apiKey?.apiKeyId) return `k:${context.apiKey.apiKeyId}`;
  if (context.auth?.userId) return `u:${context.auth.userId}`;
  return `ip:${context.ip}`;
}

export function resolveRateLimitMax(context: RateLimitContext): number {
  if (context.auth?.userId) return 300;
  if (context.apiKey?.plan) return planRateLimits()[context.apiKey.plan];
  return planRateLimits().starter;
}
