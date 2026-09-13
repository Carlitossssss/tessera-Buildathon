import type { FastifyInstance } from 'fastify';
import { type Address } from 'viem';
import { eq } from '@tessera/db';
import { schema } from '@tessera/db';
import { CREDIT_LOW_THRESHOLD } from '@tessera/shared/constants';
import { getTscPackages, getTscPerCertificate } from '../../services/payments/catalog.js';
import { getDb } from '../../lib/db.js';
import { errors } from '@tessera/shared/errors';
import { getCreditBalance } from '../../services/credits.js';

export default async function walletRoutes(app: FastifyInstance) {
  app.get(
    '/v1/wallet/balance',
    {
      preHandler: [app.requireApiKey(['wallet:read']), app.rateLimit()],
      schema: {
        description:
          'Saldo TSC interno no transferible. Cada emisión consume el costo TSC configurado por Tessera.',
        tags: ['Public API', 'Wallet', 'TSC'],
      },
    },
    async (req) => {
      const db = getDb();
      const inst = await db.query.institutions.findFirst({
        where: eq(schema.institutions.id, req.apiKey!.institutionId),
      });
      if (!inst) throw errors.notFound('Institucion');

      const unitsPerCertificate = await getTscPerCertificate();
      const tsc = await getCreditBalance(inst.id);
      const lowBalance = tsc < unitsPerCertificate || tsc <= CREDIT_LOW_THRESHOLD;

      return {
        walletAddress: inst.walletAddress as Address,
        issuerWalletNote:
          'Esta direccion queda registrada como issuer en cada SBT, pero no necesita MATIC: Tessera paga el gas internamente.',
        tsc: {
          balance: tsc,
          lowBalance,
          lowBalanceThreshold: CREDIT_LOW_THRESHOLD,
          unitsPerCertificate,
        },
        packages: await getTscPackages(),
      };
    },
  );
}
