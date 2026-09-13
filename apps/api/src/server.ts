import closeWithGrace from 'close-with-grace';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { wellKnownKeyWarning } from './services/wellknown-keys.js';
import { closeQueues } from './services/queues.js';

async function main() {
  const app = await buildApp();

  closeWithGrace({ delay: 10_000 }, async ({ err }) => {
    if (err) logger.error({ err }, 'Shutdown con error');
    logger.info('Cerrando servidor...');
    await app.close();
    await closeQueues();
  });

  try {
    await app.listen({ host: env.API_HOST, port: env.API_PORT });

    // Si la clave de firma es una publica de Anvil o Hardhat, queda dicho en
    // el arranque. No se bloquea nada --en una cadena local es legitima-- pero
    // asi nadie la lleva a un servidor creyendo que es propia.
    const keyWarning = wellKnownKeyWarning(env.SIGNER_PRIVATE_KEY);
    if (keyWarning) logger.warn({ chainId: env.POLYGON_CHAIN_ID }, keyWarning);

    logger.info({ url: env.API_PUBLIC_URL }, 'API lista');
  } catch (err) {
    logger.fatal({ err }, 'No se pudo iniciar el servidor');
    process.exit(1);
  }
}

main();
