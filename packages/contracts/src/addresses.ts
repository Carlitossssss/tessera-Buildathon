import type { Address } from 'viem';

export interface TesseraAddresses {
  registry: Address;
  certificate: Address;
  badge: Address;
  autoIssuer: Address;
}

export function loadAddresses(env: NodeJS.ProcessEnv = process.env): TesseraAddresses {
  const required = {
    registry: env['CONTRACT_REGISTRY_ADDRESS'],
    certificate: env['CONTRACT_CERTIFICATE_ADDRESS'],
    badge: env['CONTRACT_BADGE_ADDRESS'],
    autoIssuer: env['CONTRACT_AUTO_ISSUER_ADDRESS'],
  };

  for (const [key, value] of Object.entries(required)) {
    if (!value) throw new Error(`Falta direccion de contrato: ${key}`);
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      throw new Error(`Direccion invalida para ${key}: ${value}`);
    }
  }

  return required as TesseraAddresses;
}
