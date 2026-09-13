import type { FastifyInstance } from 'fastify';
import { getDb } from '../../lib/db.js';
import { chainClients, contractAddresses } from '../../services/nonce.js';
import { createRedis } from '../../lib/redis.js';
import { sql } from '@tessera/db';
import { env } from '../../config/env.js';
import { TESSERA_NETWORKS } from '../../config/networks.js';
import { isWellKnownDevKey } from '../../services/wellknown-keys.js';
import { activeMirrorChainIds } from '../../services/certificate-mirror.js';
import type { Address } from 'viem';

export default async function healthRoutes(app: FastifyInstance) {
  app.get(
    '/v1/health',
    {
      schema: {
        description: 'Health check con dependencias',
        tags: ['Public API', 'Health'],
      },
    },
    async (_req, reply) => {
      const started = Date.now();
      const db = getDb();
      const redis = createRedis();

      const arweaveProbe = env.ARWEAVE_JWK_JSON
        ? fetch(`${env.ARWEAVE_GATEWAY.replace(/\/$/, '')}/info`, {
            signal: AbortSignal.timeout(3_000),
          }).then((r) => r.ok)
        : null;
      const pinataProbe = env.PINATA_JWT
        ? fetch('https://api.pinata.cloud/data/testAuthentication', {
            headers: { Authorization: `Bearer ${env.PINATA_JWT}` },
            signal: AbortSignal.timeout(3_000),
          }).then((r) => r.ok)
        : Promise.resolve(true);
      const signerBalanceProbe = env.BACKEND_SIGNER_ADDRESS
        ? chainClients.publicClient.getBalance({ address: env.BACKEND_SIGNER_ADDRESS as Address })
        : Promise.resolve(null);

      // OpenBao arranca sellado tras cada reinicio del contenedor y responde
      // 503 a todo. Sin esta comprobacion el health decia "ok" mientras la
      // emision fallaba, porque nada vigilaba la boveda que guarda las wallets
      // custodiadas. /sys/seal-status no requiere token.
      const openbaoProbe = env.OPENBAO_URL
        ? fetch(`${env.OPENBAO_URL.replace(/\/$/, '')}/v1/sys/seal-status`, {
            signal: AbortSignal.timeout(3_000),
          })
            .then((r) => r.json() as Promise<{ sealed?: boolean }>)
            .then((body) => (body.sealed === false ? 'unsealed' : 'sealed'))
        : Promise.resolve('not_configured');

      const [dbRes, redisRes, rpcRes, arweaveRes, pinataRes, signerBalanceRes, openbaoRes] =
        await Promise.allSettled([
          db.execute(sql`SELECT 1`),
          redis.ping().finally(() => redis.quit()),
          chainClients.publicClient.getBlockNumber(),
          arweaveProbe ?? Promise.resolve(false),
          pinataProbe,
          signerBalanceProbe,
          openbaoProbe,
        ]);

      const checks = {
        db: dbRes.status === 'fulfilled' ? 'ok' : 'down',
        redis: redisRes.status === 'fulfilled' ? 'ok' : 'down',
        rpc: rpcRes.status === 'fulfilled' ? 'ok' : 'down',
        arweave: env.ARWEAVE_JWK_JSON
          ? arweaveRes.status === 'fulfilled' && arweaveRes.value
            ? 'ok'
            : 'degraded'
          : 'not_configured',
        pinata: env.PINATA_JWT
          ? pinataRes.status === 'fulfilled' && pinataRes.value
            ? 'ok'
            : 'degraded'
          : 'not_configured',
        signer: env.WEB3SIGNER_URL
          ? 'web3signer'
          : env.OPENBAO_URL && env.OPENBAO_TOKEN && env.OPENBAO_SIGNING_KEY_PATH
            ? 'openbao'
            : env.SIGNER_PRIVATE_KEY
              ? 'local'
              : 'none',
        // Una clave publica de Anvil/Hardhat deja la wallet en manos de
        // cualquiera. En local es legitima, asi que no degrada el servicio:
        // solo queda visible para que nadie la lleve a un servidor creyendo
        // que es propia.
        signerKey: isWellKnownDevKey(env.SIGNER_PRIVATE_KEY) ? 'well_known_dev_key' : 'ok',
        // Sin custodia no se pueden crear wallets: registrar un estudiante o
        // emitirle un certificado a alguien sin wallet propia falla. No se
        // nota hasta que alguien lo intenta, asi que se vigila aqui.
        custodyWallets:
          env.OPENBAO_URL && env.OPENBAO_CUSTODY_TOKEN ? 'ok' : 'not_configured',
        // La replica es lo que hace que el certificado se vea en el explorador
        // de la red secundaria. Apagada no da error: el worker simplemente no
        // la intenta, el certificado principal queda bien y nadie se entera.
        // Se midio asi en produccion --19 certificados, 0 replicas--, de modo
        // que su estado tiene que ser visible sin abrir los logs.
        certificateMirrors:
          activeMirrorChainIds().length === 0
            ? 'disabled'
            : env.MIRROR_SIGNER_PRIVATE_KEY.trim()
              ? 'ok'
              : 'missing_signer',
        signerFunding: !env.BACKEND_SIGNER_ADDRESS
          ? 'not_configured'
          : signerBalanceRes.status !== 'fulfilled' || signerBalanceRes.value === null
            ? 'down'
            : signerBalanceRes.value > 0n
              ? 'funded'
              : 'unfunded',
        openbao: openbaoRes.status === 'fulfilled' ? openbaoRes.value : 'down',
        stripeWebhook: env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'not_configured',
        objectStorage: env.S3_ENDPOINT ? env.OBJECT_STORAGE_PROVIDER : 'not_configured',
        email: env.RESEND_API_KEY ? 'ok' : 'mock',
      } as const;

      const blockNumber = rpcRes.status === 'fulfilled' ? rpcRes.value.toString() : null;

      const degraded =
        checks.db === 'down' ||
        checks.redis === 'down' ||
        checks.rpc === 'down' ||
        checks.signerFunding === 'down' ||
        checks.signerFunding === 'unfunded' ||
        // Sellado o caido: no se pueden crear wallets custodiadas ni firmar,
        // asi que el servicio esta degradado aunque el resto responda.
        checks.openbao === 'sealed' ||
        checks.openbao === 'down';
      const status = degraded ? 'degraded' : 'ok';
      reply.status(degraded ? 503 : 200);
      return {
        status,
        timestamp: new Date().toISOString(),
        uptimeMs: Math.floor(process.uptime() * 1000),
        responseMs: Date.now() - started,
        version: process.env.GIT_SHA ?? 'dev',
        checks,
        // Despliegues en todas las redes soportadas. `issuing` marca la unica
        // que emite ahora mismo; las demas estan desplegadas y validadas, cada
        // una con un proposito distinto. Distinguirlas evita dar a entender que
        // emitimos en cuatro cadenas a la vez.
        networks: TESSERA_NETWORKS.map((n) => ({
          chainId: n.chainId,
          name: n.name,
          currency: n.currency,
          explorer: n.explorer,
          purpose: n.purpose,
          role: n.role,
          rationale: n.rationale,
          value: n.value,
          contracts: n.contracts,
          verificationUnavailable: n.verificationUnavailable ?? false,
          issuing: n.chainId === env.POLYGON_CHAIN_ID,
        })),
        blockchain: blockNumber
          ? {
              network: env.POLYGON_CHAIN,
              chainId: env.POLYGON_CHAIN_ID,
              blockNumber,
              // Los contratos contra los que se esta emitiendo ahora mismo.
              // Publicarlos deja que cualquiera audite la emision sin pedirnos
              // nada: son direcciones publicas, no configuracion sensible.
              contracts: {
                registry: contractAddresses.registry,
                certificate: contractAddresses.certificate,
                badge: contractAddresses.badge,
                autoIssuer: contractAddresses.autoIssuer,
              },
              signerAddress: env.BACKEND_SIGNER_ADDRESS || null,
              signerBalanceWei:
                signerBalanceRes.status === 'fulfilled' && signerBalanceRes.value !== null
                  ? signerBalanceRes.value.toString()
                  : null,
            }
          : null,
      };
    },
  );

  app.get('/v1/ready', async (_req, reply) => {
    return reply.status(200).send({ ready: true });
  });
}
