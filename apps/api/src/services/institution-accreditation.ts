import { createPublicClient, createWalletClient, fallback, getAddress, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { eq, and } from '@tessera/db';
import { schema } from '@tessera/db';
import { registryAbi } from '@tessera/contracts';
import { env } from '../config/env.js';
import { networkFor } from '../config/networks.js';
import { getDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';

/**
 * Acreditacion institucional en HashKey Chain.
 *
 * La aprobacion principal ocurre en la red de emision (Amoy) y es la que
 * decide: sin ella la institucion no emite. Esto es distinto y adicional.
 *
 * HSK es una cadena compliance-first: su propuesta es que un regulador o un
 * auditor pueda comprobar hechos sin confiar en la plataforma que los afirma.
 * Registrar alli la institucion hace que su acreditacion sea consultable
 * directamente en el contrato:
 *
 *   isApprovedInstitution(wallet) -> bool
 *
 * Nadie necesita nuestra API para responder "quien es una institucion
 * legitima". Eso es lo que convierte un diploma en un activo del mundo real
 * auditable: el emisor tiene respaldo verificable de forma independiente.
 *
 * Dos decisiones que sostienen el diseno:
 *
 *  1. NUNCA bloquea la aprobacion. El RPC de HSK testnet es intermitente
 *     --medido: responde y deja de responder en cuestion de minutos--, y una
 *     institucion no puede quedarse sin aprobar porque una cadena secundaria
 *     no conteste. Si falla, se guarda el motivo y se reintenta.
 *
 *  2. Firma con MIRROR_SIGNER_PRIVATE_KEY. Web3Signer arranca con un unico
 *     --chain-id (el de la red principal) y no puede firmar para otra cadena.
 *     Es el mismo problema que ya resolvimos para replicar certificados, asi
 *     que se reutiliza la misma clave en vez de introducir otra.
 */

/**
 * Redes donde se puede LEER la acreditacion.
 *
 * Incluye la principal (Amoy) aunque no se escriba en ella desde aqui: la
 * pagina publica muestra las dos, y sin Amoy en esta lista la red que de
 * verdad habilita la emision aparecia como "no soportada".
 */
const ACCREDITATION_CHAINS = {
  80002: {
    name: 'Polygon Amoy',
    currency: 'POL',
    rpcUrls: ['https://polygon-amoy-bor-rpc.publicnode.com', 'https://rpc-amoy.polygon.technology'],
  },
  133: {
    name: 'HashKey Chain Testnet',
    currency: 'HSK',
    // Un solo endpoint a proposito. El respaldo que habia aqui
    // --hashkeychain-testnet.alt.technology-- no existe: su DNS no resuelve, ni
    // siquiera el dominio padre. No solo no servia de respaldo; viem arrastra
    // el detalle de cada transporte que intenta, asi que metia un "fetch
    // failed" dentro de errores que en realidad eran de permisos o de revert,
    // y eso mandaba a diagnosticar una caida de red que no existia.
    rpcUrls: ['https://testnet.hsk.xyz'],
  },
} as const;

/**
 * Redes donde se ESCRIBE la acreditacion desde aqui.
 *
 * Amoy queda fuera: alli escribe approveInstitutionOnchain con el signer de
 * plataforma, y duplicar esa escritura enviaria dos transacciones para lo
 * mismo.
 */
const WRITABLE_CHAIN_IDS = [133] as const;

export type AccreditationChainId = keyof typeof ACCREDITATION_CHAINS;

/**
 * Redes donde acreditar esta habilitado.
 *
 * Vacio si no hay clave para firmar: sin ella no se puede escribir en la
 * cadena, y prometer una acreditacion que nunca ocurrira seria peor que no
 * ofrecerla.
 */
export function activeAccreditationChainIds(): number[] {
  if (!env.MIRROR_SIGNER_PRIVATE_KEY.trim()) return [];
  return [...WRITABLE_CHAIN_IDS];
}

/**
 * Redes que la pagina publica muestra, se escriba o no en ellas.
 *
 * El orden es explicito: primero la red que habilita la emision y luego las de
 * auditoria. Object.keys sobre claves numericas las devuelve en orden
 * ascendente --133 antes que 80002--, que dejaria la red principal en segundo
 * lugar sin ninguna razon.
 */
export function readableAccreditationChainIds(): number[] {
  return [80002, ...WRITABLE_CHAIN_IDS];
}

function clientsFor(chainId: AccreditationChainId) {
  const network = ACCREDITATION_CHAINS[chainId];
  const contracts = networkFor(chainId)?.contracts;
  if (!contracts) throw new Error(`La red ${chainId} no tiene contratos configurados`);

  const key = env.MIRROR_SIGNER_PRIVATE_KEY.trim();
  if (!key) throw new Error('MIRROR_SIGNER_PRIVATE_KEY es requerida para acreditar');

  const account = privateKeyToAccount((key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`);

  // El chain se declara en linea --y no con una constante de viem-- porque HSK
  // no viene en viem/chains. rank: false mantiene el orden declarado: el
  // primer RPC es el oficial y los siguientes son respaldo.
  const chain = {
    id: chainId,
    name: network.name,
    nativeCurrency: { name: network.currency, symbol: network.currency, decimals: 18 },
    rpcUrls: { default: { http: [...network.rpcUrls] } },
  } as const;

  const transport = fallback(
    network.rpcUrls.map((url) => http(url, { timeout: 15_000 })),
    { rank: false },
  );

  return {
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
    registry: getAddress(contracts.registry) as Address,
    account,
  };
}

/**
 * Traduce el error a algo accionable.
 *
 * El mensaje se lee en el panel de administracion, donde nadie tiene el codigo
 * delante: "fetch failed" no dice que hacer, "el RPC no responde" si.
 */
function summarize(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const text = raw.toLowerCase();

  // El orden importa. viem arrastra el detalle de CADA transporte que intento,
  // asi que un revert legitimo llega con "HTTP request failed" pegado dentro
  // --el de un RPC de respaldo caido--. Si se buscara primero el fallo de red,
  // un problema de permisos se reportaria como "el RPC no respondio" y quien
  // lo lee reintentaria para siempre sin llegar a la causa.
  if (
    text.includes('ownable') ||
    text.includes('caller is not the owner') ||
    text.includes('unauthorized') ||
    text.includes('not the owner')
  ) {
    return 'La wallet que firma no es owner del registry en esta red. Transfiere el ownership a esa wallet para poder acreditar.';
  }
  if (text.includes('insufficient funds')) {
    return 'La wallet que firma no tiene gas suficiente en esta red.';
  }
  if (text.includes('nonce')) {
    return 'Conflicto de nonce: otra transaccion estaba en curso. Reintenta.';
  }
  // Un revert sin motivo reconocible suele ser el contrato rechazando la
  // llamada, no la red fallando. Decir "reintenta en unos minutos" ahi manda a
  // repetir algo que nunca va a funcionar.
  if (text.includes('reverted') || text.includes('execution reverted')) {
    return `El contrato rechazo la llamada: ${raw.slice(0, 180)}`;
  }
  if (text.includes('fetch failed') || text.includes('timeout') || text.includes('econnrefused')) {
    return 'El RPC de la red no respondio. HSK testnet es intermitente; volve a intentar en unos minutos.';
  }
  return raw.slice(0, 300);
}

export interface AccreditationResult {
  chainId: number;
  status: 'confirmed' | 'failed' | 'skipped';
  txHash: string | null;
  error: string | null;
}

/**
 * Acredita una institucion en una red secundaria.
 *
 * Es idempotente: si el contrato ya la reconoce, no envia transaccion y marca
 * confirmed. Eso permite reintentar sin gastar gas de mas.
 */
export async function accreditInstitution(input: {
  institutionId: string;
  walletAddress: string;
  name: string;
  chainId: number;
}): Promise<AccreditationResult> {
  const chainId = input.chainId as AccreditationChainId;
  if (!(chainId in ACCREDITATION_CHAINS)) {
    return { chainId: input.chainId, status: 'skipped', txHash: null, error: 'Red no soportada' };
  }
  if (!env.MIRROR_SIGNER_PRIVATE_KEY.trim()) {
    return {
      chainId: input.chainId,
      status: 'skipped',
      txHash: null,
      error: 'MIRROR_SIGNER_PRIVATE_KEY no esta configurada',
    };
  }

  const db = getDb();
  let wallet: Address;
  try {
    wallet = getAddress(input.walletAddress);
  } catch {
    await recordFailure(input, 'La wallet de la institucion no es una address valida');
    return {
      chainId: input.chainId,
      status: 'failed',
      txHash: null,
      error: 'La wallet de la institucion no es una address valida',
    };
  }

  try {
    const { publicClient, walletClient, registry, account } = clientsFor(chainId);

    // Se comprueba el owner ANTES de intentar escribir. Un revert por falta de
    // permisos llega envuelto en el detalle de cada transporte que viem
    // intento, y ahi es facil confundirlo con un fallo de red. Preguntarlo
    // directo da un mensaje exacto y dice que wallet hay que autorizar.
    const owner = (await publicClient.readContract({
      address: registry,
      abi: registryAbi,
      functionName: 'owner',
    })) as Address;

    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      // Ownable2Step: si ya hay una transferencia pendiente a nuestro nombre,
      // se acepta aqui. Es lo mismo que hace la red principal al aprobar, y
      // evita un paso manual mas despues de transferir.
      const pending = (await publicClient.readContract({
        address: registry,
        abi: registryAbi,
        functionName: 'pendingOwner',
      })) as Address;

      if (pending.toLowerCase() !== account.address.toLowerCase()) {
        const reason =
          `La wallet que firma (${account.address}) no es owner del registry en esta red. ` +
          `El owner es ${owner}. Transfiere el ownership a la wallet que firma para poder acreditar.`;
        await recordFailure(input, reason);
        return { chainId: input.chainId, status: 'failed', txHash: null, error: reason };
      }

      const { request: acceptRequest } = await publicClient.simulateContract({
        address: registry,
        abi: registryAbi,
        functionName: 'acceptOwnership',
        account,
      });
      const acceptTx = await walletClient.writeContract(acceptRequest);
      await publicClient.waitForTransactionReceipt({ hash: acceptTx, confirmations: 1 });
      logger.info({ chainId, txHash: acceptTx }, 'Propiedad del registry aceptada');
    }

    // Si ya esta acreditada, no se gasta gas en repetirlo.
    const already = await publicClient.readContract({
      address: registry,
      abi: registryAbi,
      functionName: 'isApprovedInstitution',
      args: [wallet],
    });

    if (already) {
      await upsert(db, input, {
        status: 'confirmed',
        txHash: null,
        failureReason: null,
        accreditedAt: new Date(),
      });
      return { chainId: input.chainId, status: 'confirmed', txHash: null, error: null };
    }

    // simulateContract da el error real del contrato antes de gastar gas: un
    // revert por no ser owner se ve aqui y no despues de pagar.
    const { request } = await publicClient.simulateContract({
      address: registry,
      abi: registryAbi,
      functionName: 'approveInstitution',
      args: [wallet, input.name],
      account,
    });

    const txHash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });

    await upsert(db, input, {
      status: 'confirmed',
      txHash,
      failureReason: null,
      accreditedAt: new Date(),
    });

    logger.info({ institutionId: input.institutionId, chainId, txHash }, 'Institucion acreditada');
    return { chainId: input.chainId, status: 'confirmed', txHash, error: null };
  } catch (err) {
    const reason = summarize(err);
    logger.warn({ err, institutionId: input.institutionId, chainId }, 'Fallo la acreditacion');
    await recordFailure(input, reason);
    return { chainId: input.chainId, status: 'failed', txHash: null, error: reason };
  }
}

async function recordFailure(
  input: { institutionId: string; walletAddress: string; chainId: number },
  reason: string,
) {
  await upsert(getDb(), input, {
    status: 'failed',
    txHash: null,
    failureReason: reason,
    accreditedAt: null,
  });
}

/** Una fila por institucion y red: reintentar actualiza, no acumula. */
async function upsert(
  db: ReturnType<typeof getDb>,
  input: { institutionId: string; walletAddress: string; chainId: number },
  values: {
    status: string;
    txHash: string | null;
    failureReason: string | null;
    accreditedAt: Date | null;
  },
) {
  const existing = await db.query.institutionAccreditations.findFirst({
    where: and(
      eq(schema.institutionAccreditations.institutionId, input.institutionId),
      eq(schema.institutionAccreditations.chainId, input.chainId),
    ),
  });

  if (existing) {
    await db
      .update(schema.institutionAccreditations)
      .set({
        ...values,
        attempts: existing.attempts + 1,
        walletAddress: input.walletAddress,
        updatedAt: new Date(),
      })
      .where(eq(schema.institutionAccreditations.id, existing.id));
    return;
  }

  await db.insert(schema.institutionAccreditations).values({
    institutionId: input.institutionId,
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    attempts: 1,
    ...values,
  });
}

/**
 * Lee el estado de acreditacion directamente del contrato.
 *
 * Se consulta la cadena y no la base: el valor de esta funcion es justamente
 * que la respuesta no dependa de lo que nosotros afirmemos.
 */
export async function readAccreditationOnchain(input: {
  walletAddress: string;
  chainId: number;
}): Promise<{ accredited: boolean | null; error: string | null }> {
  const chainId = input.chainId as AccreditationChainId;
  if (!(chainId in ACCREDITATION_CHAINS)) return { accredited: null, error: 'Red no soportada' };

  try {
    const network = ACCREDITATION_CHAINS[chainId];
    const contracts = networkFor(chainId)?.contracts;
    if (!contracts) return { accredited: null, error: 'Red sin contratos configurados' };

    const client = createPublicClient({
      chain: {
        id: chainId,
        name: network.name,
        nativeCurrency: { name: network.currency, symbol: network.currency, decimals: 18 },
        rpcUrls: { default: { http: [...network.rpcUrls] } },
      },
      transport: fallback(
        network.rpcUrls.map((url) => http(url, { timeout: 10_000 })),
        { rank: false },
      ),
    });

    const accredited = await client.readContract({
      address: getAddress(contracts.registry),
      abi: registryAbi,
      functionName: 'isApprovedInstitution',
      args: [getAddress(input.walletAddress)],
    });

    return { accredited: accredited as boolean, error: null };
  } catch (err) {
    return { accredited: null, error: summarize(err) };
  }
}
