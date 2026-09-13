import { describe, it, expect } from 'vitest';
import { webhookUrlSchema } from './routes.js';

describe('webhookUrlSchema', () => {
  it('accepts a public https endpoint', () => {
    expect(webhookUrlSchema.safeParse('https://acme.edu/hooks/tessera').success).toBe(true);
  });

  it('rejects http, which would send the payload in clear text', () => {
    expect(webhookUrlSchema.safeParse('http://acme.edu/hooks').success).toBe(false);
  });

  // El worker hace el POST desde dentro de la red de Tessera: un host privado
  // convertiria el webhook en un SSRF contra nuestra propia infraestructura.
  it.each([
    'https://localhost/hooks',
    'https://127.0.0.1/hooks',
    'https://10.0.0.5/hooks',
    'https://192.168.1.10/hooks',
    'https://172.16.0.1/hooks',
    'https://169.254.169.254/latest/meta-data',
  ])('rejects the private host %s', (url) => {
    expect(webhookUrlSchema.safeParse(url).success).toBe(false);
  });

  it('allows public addresses that merely look similar', () => {
    expect(webhookUrlSchema.safeParse('https://172.32.0.1/hooks').success).toBe(true);
    expect(webhookUrlSchema.safeParse('https://11.0.0.1/hooks').success).toBe(true);
  });

  it('rejects a value that is not a URL at all', () => {
    expect(webhookUrlSchema.safeParse('no-soy-una-url').success).toBe(false);
  });
});
