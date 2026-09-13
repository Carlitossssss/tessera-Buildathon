import { createWalletClient, type Address } from 'viem';
import { createRpcTransport, registryAbi } from '@tessera/contracts';
import { env } from '../config/env.js';
import { contractAddresses, chainClients } from './nonce.js';
import { getSigner, getSignerBackend } from './signer.js';

function sameAddress(left: Address, right: Address) {
  return left.toLowerCase() === right.toLowerCase();
}

export async function approveInstitutionOnchain(input: {
  institution: Address;
  name: string;
}): Promise<{ txHash: `0x${string}` | null }> {
  const signer = await getSigner();
  if (!signer.account) throw new Error('El signer de plataforma no puede firmar transacciones');

  const walletClient = createWalletClient({
    account: signer.account,
    chain: chainClients.chain,
    transport: createRpcTransport(env.POLYGON_RPC_URL, env.POLYGON_RPC_URL_FALLBACK),
  });

  let registryOwner = await chainClients.publicClient.readContract({
    address: contractAddresses.registry,
    abi: registryAbi,
    functionName: 'owner',
  });

  if (!sameAddress(registryOwner, signer.address)) {
    const pendingOwner = await chainClients.publicClient.readContract({
      address: contractAddresses.registry,
      abi: registryAbi,
      functionName: 'pendingOwner',
    });
    if (!sameAddress(pendingOwner, signer.address)) {
      // La salida depende de QUE backend esta firmando, y confundirlas cuesta
      // tiempo: con Web3Signer la clave vive en OpenBao y SIGNER_PRIVATE_KEY
      // se ignora, asi que cambiarla no arregla nada aunque lo parezca.
      //
      // El mensaje se lee en el panel de administracion, donde nadie tiene el
      // codigo delante, de modo que dice tambien el paso concreto.
      const usingCustody = getSignerBackend() !== 'local';
      const howToFix = usingCustody
        ? `Transfiere el ownership del registry a ${signer.address} llamando ` +
          'transferOwnership(address) desde la wallet owner. La aceptacion es automatica en el ' +
          'siguiente intento de aprobacion. Cambiar SIGNER_PRIVATE_KEY no sirve aqui: con ' +
          'WEB3SIGNER_URL definida esa clave se ignora.'
        : 'Configura SIGNER_PRIVATE_KEY con la clave de esa wallet (o transfiere el ownership ' +
          'del registry al signer actual) y recrea el contenedor de la API: las variables de ' +
          'entorno se leen al crearlo, reiniciarlo no basta.';

      throw new Error(
        `El signer de Tessera (${signer.address}) no controla TesseraRegistry. ` +
          `El owner actual es ${registryOwner}. ${howToFix}`,
      );
    }
    if (env.POLYGON_CHAIN !== 'polygonAmoy') {
      throw new Error('La aceptación automática de ownership solo está habilitada en Polygon Amoy');
    }

    const { request } = await chainClients.publicClient.simulateContract({
      address: contractAddresses.registry,
      abi: registryAbi,
      functionName: 'acceptOwnership',
      account: signer.account,
    });
    const ownershipTx = await walletClient.writeContract(request);
    await chainClients.publicClient.waitForTransactionReceipt({ hash: ownershipTx });
    registryOwner = await chainClients.publicClient.readContract({
      address: contractAddresses.registry,
      abi: registryAbi,
      functionName: 'owner',
    });
    if (!sameAddress(registryOwner, signer.address)) {
      throw new Error('Tessera no pudo aceptar la propiedad de TesseraRegistry');
    }
  }

  const approved = await chainClients.publicClient.readContract({
    address: contractAddresses.registry,
    abi: registryAbi,
    functionName: 'isApprovedInstitution',
    args: [input.institution],
  });
  if (approved) return { txHash: null };

  const { request } = await chainClients.publicClient.simulateContract({
    address: contractAddresses.registry,
    abi: registryAbi,
    functionName: 'approveInstitution',
    args: [input.institution, input.name],
    account: signer.account,
  });
  const txHash = await walletClient.writeContract(request);
  await chainClients.publicClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash };
}
