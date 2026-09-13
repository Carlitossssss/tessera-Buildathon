import { z } from 'zod';

const serverSchema = z.object({
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET debe tener al menos 32 caracteres'),
  AUTH_URL: z.string().url(),
  AUTH_TRUST_HOST: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

const publicSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_AUTH_URL: z.string().url(),
  NEXT_PUBLIC_POLYGON_CHAIN_ID: z.coerce.number().int().positive(),
  NEXT_PUBLIC_POLYGON_RPC_URL: z.string().url(),
  NEXT_PUBLIC_CONTRACT_REGISTRY: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  NEXT_PUBLIC_CONTRACT_CERTIFICATE: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  NEXT_PUBLIC_CONTRACT_BADGE: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  // Portal token-gated. El Lock por defecto es solo una sugerencia del panel:
  // cada contenido guarda el suyo, asi que el portal funciona aunque falte.
  NEXT_PUBLIC_UNLOCK_LOCK_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional()
    .or(z.literal('')),
  NEXT_PUBLIC_UNLOCK_CHAIN_ID: z.coerce.number().int().positive().default(11155111),
});

const isServer = typeof window === 'undefined';
const localDefault = <Value>(value: Value): Value | undefined => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  return nodeEnv === 'development' || nodeEnv === 'test' ? value : undefined;
};

const publicValues = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
  NEXT_PUBLIC_POLYGON_CHAIN_ID: process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID,
  NEXT_PUBLIC_POLYGON_RPC_URL: process.env.NEXT_PUBLIC_POLYGON_RPC_URL,
  NEXT_PUBLIC_CONTRACT_REGISTRY: process.env.NEXT_PUBLIC_CONTRACT_REGISTRY,
  NEXT_PUBLIC_CONTRACT_CERTIFICATE: process.env.NEXT_PUBLIC_CONTRACT_CERTIFICATE,
  NEXT_PUBLIC_CONTRACT_BADGE: process.env.NEXT_PUBLIC_CONTRACT_BADGE,
  NEXT_PUBLIC_UNLOCK_LOCK_ADDRESS: process.env.NEXT_PUBLIC_UNLOCK_LOCK_ADDRESS,
  NEXT_PUBLIC_UNLOCK_CHAIN_ID: process.env.NEXT_PUBLIC_UNLOCK_CHAIN_ID,
};

const publicParsed = publicSchema.safeParse(publicValues);
if (!publicParsed.success) {
  if (isServer) {
    console.error(
      '[env] Variables NEXT_PUBLIC_* invalidas:',
      publicParsed.error.flatten().fieldErrors,
    );
  }
}

export const publicEnv = publicParsed.success
  ? publicParsed.data
  : ({
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      NEXT_PUBLIC_AUTH_URL: 'http://localhost:3000',
      NEXT_PUBLIC_POLYGON_CHAIN_ID: 80002,
      NEXT_PUBLIC_POLYGON_RPC_URL: 'https://polygon-amoy-bor-rpc.publicnode.com',
      NEXT_PUBLIC_CONTRACT_REGISTRY: '0x0000000000000000000000000000000000000000',
      NEXT_PUBLIC_CONTRACT_CERTIFICATE: '0x0000000000000000000000000000000000000000',
      NEXT_PUBLIC_CONTRACT_BADGE: '0x0000000000000000000000000000000000000000',
      NEXT_PUBLIC_UNLOCK_LOCK_ADDRESS: '',
      NEXT_PUBLIC_UNLOCK_CHAIN_ID: 11155111,
    } as const);

export const serverEnv = isServer
  ? serverSchema.parse({
      AUTH_SECRET:
        process.env.AUTH_SECRET ?? localDefault('dev-secret-change-me-please-32-chars-minimum-ok'),
      AUTH_URL:
        process.env.AUTH_URL ??
        process.env.NEXT_PUBLIC_AUTH_URL ??
        localDefault('http://localhost:3000'),
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? localDefault('true'),
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    })
  : (undefined as never);
