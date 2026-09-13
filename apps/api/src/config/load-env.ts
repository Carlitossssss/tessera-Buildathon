import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(currentDir, '..', '..');
const workspaceRoot = resolve(packageDir, '..', '..');

for (const envPath of [
  resolve(workspaceRoot, '.env.local'),
  resolve(workspaceRoot, '.env'),
  resolve(packageDir, '.env.local'),
  resolve(packageDir, '.env'),
]) {
  config({ path: envPath, override: false });
}

const aliases: Record<string, string[]> = {
  API_CORS_ORIGINS: ['CORS_ORIGIN'],
  POLYGON_RPC_URL_FALLBACK: ['POLYGON_RPC_FALLBACK_URL'],
  CONTRACT_REGISTRY_ADDRESS: ['CONTRACT_REGISTRY'],
  CONTRACT_CERTIFICATE_ADDRESS: ['CONTRACT_CERTIFICATE'],
  CONTRACT_BADGE_ADDRESS: ['CONTRACT_BADGE'],
  CONTRACT_AUTO_ISSUER_ADDRESS: ['CONTRACT_AUTO_ISSUER'],
  ARWEAVE_JWK_JSON: ['ARWEAVE_WALLET_JSON'],
  RESEND_FROM: ['EMAIL_FROM'],
};

for (const [target, sources] of Object.entries(aliases)) {
  if (process.env[target]) continue;
  const source = sources.find((key) => process.env[key]);
  if (source) process.env[target] = process.env[source];
}
