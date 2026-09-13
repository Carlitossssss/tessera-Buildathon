import { describe, expect, it } from 'vitest';
import { planRateLimits, resolveRateLimitKey, resolveRateLimitMax } from './rate-limit.utils.js';

describe('rate-limit.utils', () => {
  it('usa API key id como key cuando existe contexto de API key', () => {
    expect(
      resolveRateLimitKey({
        ip: '127.0.0.1',
        apiKey: { apiKeyId: 'key_123', plan: 'pro' },
      }),
    ).toBe('k:key_123');
  });

  it('usa user id como key para sesiones autenticadas', () => {
    expect(resolveRateLimitKey({ ip: '127.0.0.1', auth: { userId: 'user_123' } })).toBe(
      'u:user_123',
    );
  });

  it('calcula max por plan y por sesión', () => {
    const limits = planRateLimits();
    expect(
      resolveRateLimitMax({ ip: '127.0.0.1', apiKey: { apiKeyId: 'a', plan: 'starter' } }),
    ).toBe(limits.starter);
    expect(
      resolveRateLimitMax({ ip: '127.0.0.1', apiKey: { apiKeyId: 'a', plan: 'pro_extended' } }),
    ).toBe(limits.pro_extended);
    expect(resolveRateLimitMax({ ip: '127.0.0.1', auth: { userId: 'u' } })).toBe(300);
  });
});
