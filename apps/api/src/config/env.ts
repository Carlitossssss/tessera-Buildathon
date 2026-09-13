import './load-env.js';
import { cleanEnv, str, url, num, bool, port } from 'envalid';

const zeroAddress = '0x0000000000000000000000000000000000000000';
const localDefault = <Value>(value: Value): Value | undefined => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  return nodeEnv === 'development' || nodeEnv === 'test' ? value : undefined;
};

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ['development', 'test', 'staging', 'production'],
    default: 'development',
  }),
  LOG_LEVEL: str({ choices: ['trace', 'debug', 'info', 'warn', 'error'], default: 'info' }),

  API_HOST: str({ default: '0.0.0.0' }),
  API_PORT: port({ default: 3001 }),
  API_PUBLIC_URL: url({ default: 'http://localhost:3001' }),
  API_CORS_ORIGINS: str({ default: 'http://localhost:3000' }),

  AUTH_SECRET: str({ devDefault: localDefault('dev-secret-change-me-please-32-chars-minimum-ok') }),
  AUTH_URL: url({ default: 'http://localhost:3000' }),
  AUTH_TRUST_HOST: bool({ default: true }),
  INSTITUTION_DOCS_REQUIRE_AUTH: bool({ default: process.env.NODE_ENV === 'production' }),
  JWT_EXPIRES_IN: str({ default: '4h' }),
  REFRESH_TOKEN_EXPIRES_IN: str({ default: '30d' }),

  DATABASE_URL: url({
    devDefault: localDefault('postgres://tessera:tessera@localhost:5432/tessera'),
  }),
  DATABASE_POOL_MAX: num({ default: 20 }),

  REDIS_URL: str({ default: 'redis://localhost:6379' }),

  POLYGON_CHAIN: str({ choices: ['polygon', 'polygonAmoy', 'localhost'], default: 'polygonAmoy' }),
  POLYGON_RPC_URL: url({ devDefault: localDefault('https://polygon-amoy-bor-rpc.publicnode.com') }),
  POLYGON_RPC_URL_FALLBACK: str({ default: '' }),
  POLYGON_CHAIN_ID: num({ default: 80002 }),

  CONTRACT_REGISTRY_ADDRESS: str({ devDefault: localDefault(zeroAddress) }),
  CONTRACT_CERTIFICATE_ADDRESS: str({ devDefault: localDefault(zeroAddress) }),
  CONTRACT_BADGE_ADDRESS: str({ devDefault: localDefault(zeroAddress) }),
  CONTRACT_AUTO_ISSUER_ADDRESS: str({ devDefault: localDefault(zeroAddress) }),

  SIGNER_PRIVATE_KEY: str({ default: '' }),

  // Web3Signer is the production Ethereum signer. It reads the secp256k1
  // key from OpenBao KV v2, keeping it out of API and worker memory.
  WEB3SIGNER_URL: str({ default: '' }),

  // OpenBao KV v2 is consumed by Web3Signer in production. The legacy direct
  // fallback remains only for local migration and is never used by Dokploy.
  // acá dejamos que OPENBAO_URL acepte string vacío para que el
  // validator de envalid no falle cuando no usamos OpenBao (Opción A
  // del deploy.md, con SIGNER_PRIVATE_KEY). Si se setea un valor,
  // se valida el formato URL en runtime cuando se hace el fetch.
  OPENBAO_URL: str({ default: '' }),
  OPENBAO_TOKEN: str({ default: '' }),
  OPENBAO_CUSTODY_TOKEN: str({ default: '' }),
  OPENBAO_CUSTODY_KEY_PATH: str({ default: 'secret/data/tessera/students' }),
  OPENBAO_SIGNING_KEY_PATH: str({ default: 'secret/data/tessera/signer' }),
  OPENBAO_SIGNING_KEY_FIELD: str({ default: 'private_key' }),
  BACKEND_SIGNER_ADDRESS: str({ default: '' }),

  ARWEAVE_JWK_JSON: str({ default: '' }),
  // Aceptan string vacío por la misma razón que OPENBAO_URL: si no
  // configurás Arweave/Pinata, el storage usa mock://metadata/<id>
  // (ver services/storage.ts). El URL se valida en runtime sólo si
  // intentás subir metadata.
  ARWEAVE_GATEWAY: str({ default: 'https://arweave.net' }),
  PINATA_JWT: str({ default: '' }),
  PINATA_GATEWAY: str({ default: 'https://gateway.pinata.cloud' }),
  PINATA_DEDICATED_GATEWAY: str({ default: '' }),
  // Gateway written into the token URI and the metadata image. It ends up
  // immutable on-chain, so it must be a long-lived public gateway.
  IPFS_PUBLIC_GATEWAY: str({ default: 'https://ipfs.io' }),
  IPFS_FALLBACK_GATEWAYS: str({ default: 'https://dweb.link,https://ipfs.io,https://w3s.link' }),
  IPFS_READINESS_TIMEOUT_SECONDS: num({ default: 45 }),
  IPFS_REQUEST_TIMEOUT_MS: num({ default: 15000 }),
  IPFS_POLL_INTERVAL_MS: num({ default: 3000 }),

  // Unlock Protocol: capa de membresias del portal de contenido.
  // UNLOCK_RPC_URL es opcional; si no se define usamos los RPC publicos de
  // cada red soportada. UNLOCK_DEFAULT_* son los valores que propone el panel
  // al publicar contenido nuevo.
  // Redes donde se replica cada certificado ademas de la principal, separadas
  // por coma (ej: "43113"). Vacio = no replicar. Un fallo aqui nunca invalida
  // el certificado de la red principal.
  MIRROR_CHAIN_IDS: str({ default: '' }),

  // RPC por cadena espejo, separados por coma y en orden de preferencia. Se
  // anteponen a los publicos que trae el codigo. Util cuando un proveedor
  // bloquea la IP del servidor: se pone aqui uno privado sin tocar codigo.
  MIRROR_RPC_URLS_FUJI: str({ default: '' }),
  MIRROR_RPC_URLS_SEPOLIA: str({ default: '' }),

  // Clave que firma las replicas. Web3Signer arranca con un unico --chain-id
  // (el de la red principal) y no puede firmar para otra cadena, asi que las
  // replicas necesitan su propia clave. Vacio = no se replica.
  // Es una wallet de bajo valor: solo paga gas de testnet en redes espejo.
  MIRROR_SIGNER_PRIVATE_KEY: str({ default: '' }),

  UNLOCK_RPC_URL: str({ default: '' }),
  UNLOCK_DEFAULT_LOCK_ADDRESS: str({ default: '' }),
  // Ethereum Sepolia. Debe coincidir con el default de NEXT_PUBLIC_UNLOCK_CHAIN_ID
  // en apps/web: si divergen, el panel propone una red y el navegador otra.
  UNLOCK_DEFAULT_CHAIN_ID: num({ default: 11155111 }),

  OBJECT_STORAGE_PROVIDER: str({ choices: ['minio', 'r2', 's3'], default: 'minio' }),
  S3_ENDPOINT: str({ default: '' }),
  S3_ACCESS_KEY_ID: str({ default: '' }),
  S3_SECRET_ACCESS_KEY: str({ default: '' }),
  S3_BUCKET: str({ default: 'tessera-assets' }),
  S3_PUBLIC_URL: str({ default: '' }),
  SIGNED_URL_TTL_SECONDS: num({ default: 604800 }),

  RESEND_API_KEY: str({ default: '' }),
  RESEND_FROM: str({ default: 'Tessera <no-reply@tessera.io>' }),
  EMAIL_REPLY_TO: str({ default: 'support@tessera.io' }),

  STRIPE_SECRET_KEY: str({ devDefault: localDefault('sk_test_tessera') }),
  STRIPE_WEBHOOK_SECRET: str({ devDefault: localDefault('') }),
  STRIPE_ENVIRONMENT: str({ choices: ['sandbox', 'live'], default: 'sandbox' }),
  STRIPE_PRICE_ESSENTIAL_MONTHLY: str({ devDefault: localDefault('') }),
  STRIPE_PRICE_GROWTH_MONTHLY: str({ devDefault: localDefault('') }),
  STRIPE_PRICE_INSTITUTIONAL_MONTHLY: str({ devDefault: localDefault('') }),
  STRIPE_PRICE_SCALE_MONTHLY: str({ devDefault: localDefault('') }),
  STRIPE_PRICE_PACKAGE_200: str({ devDefault: localDefault('') }),
  STRIPE_PRICE_PACKAGE_500: str({ devDefault: localDefault('') }),
  STRIPE_PRICE_PACKAGE_1000: str({ devDefault: localDefault('') }),
  STRIPE_PRICE_PACKAGE_2000: str({ devDefault: localDefault('') }),

  SENTRY_DSN: str({ default: '' }),
  OTEL_EXPORTER_OTLP_ENDPOINT: str({ default: '' }),

  RATE_LIMIT_STARTER: num({ default: 100 }),
  RATE_LIMIT_PRO: num({ default: 1000 }),
  RATE_LIMIT_PRO_EXTENDED: num({ default: 2500 }),

  GDPR_DELETION_GRACE_DAYS: num({ default: 30 }),

  WEBHOOK_MAX_ATTEMPTS: num({ default: 7 }),
  WEBHOOK_TTL_DAYS: num({ default: 7 }),
});

export type Env = typeof env;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
