/**
 * ERC-721 metadata for a Tessera certificate.
 *
 * The document is complete: every field of the credential travels with it, so a
 * wallet, an explorer or an integrator can render or audit the certificate from
 * the metadata alone, without calling Tessera.
 *
 * It is also deliberately flat. Explorers read `name`, `description`, `image`,
 * `image_url`, `external_url` and `attributes`; everything else rides as
 * top-level scalars, which any indexer can ignore safely. Nested objects and
 * `display_type` hints are avoided because a strict parser that trips on them
 * drops the whole document, and there is nothing they express that a flat key
 * cannot.
 */
export interface CertificateMetadataInput {
  certificateId: string;
  studentWallet: string | null;
  institutionWallet: string | null;
  network: string;
  chainId: number;
  contractAddress: string | null;
  issuedAt: string;
  completedAt?: string | null;
  institutionName: string;
  studentName: string;
  achievementName: string;
  courseId?: string | null;
  description: string | null;
  grade: number | null;
  /** Public gateway URL of the certificate image, e.g. `https://ipfs.io/ipfs/<cid>`. */
  imageUrl: string;
  /** `ipfs://<cid>` of that same image. */
  imageIpfsUri: string | null;
  externalUrl: string;
  /**
   * Redes donde existe este certificado. La primera es la principal, que
   * determina su validez; las demas son replicas del mismo contenido. Se
   * publica para que un explorador o un verificador sepa que el mismo
   * tokenURI aparece legitimamente en varias cadenas.
   *
   * Las replicas llevan ademas su estado y, cuando existe, el tokenId que les
   * asigno esa cadena: el id no tiene por que coincidir con el de la red
   * principal, asi que sin el no se puede localizar la copia en su explorador.
   */
  deployments?: {
    chainId: number;
    network: string;
    contractAddress: string;
    role: string;
    status?: string;
    tokenId?: string;
    txHash?: string;
  }[];
}

const NETWORK_LABELS: Record<string, string> = {
  polygon: 'Polygon',
  polygonAmoy: 'Polygon Amoy',
  localhost: 'Localhost',
};

function isoDate(value: string): string {
  return value.slice(0, 10);
}

function longDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return isoDate(value);
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildCertificateMetadata(
  input: CertificateMetadataInput,
): Record<string, unknown> {
  const networkLabel = NETWORK_LABELS[input.network] ?? input.network;
  const issuedDate = isoDate(input.issuedAt);
  const completedDate = input.completedAt ? isoDate(input.completedAt) : null;

  const description =
    input.description ??
    `Certificado de ${input.achievementName} otorgado a ${input.studentName} por ` +
      `${input.institutionName} el ${longDate(input.issuedAt)}` +
      `${input.grade !== null ? ` con una calificacion de ${input.grade}` : ''}. ` +
      'Credencial soulbound no transferible (ERC-721 + ERC-5192), emitida y verificable en Tessera.';

  const attributes: Array<Record<string, unknown>> = [
    { trait_type: 'Recipient', value: input.studentName },
    { trait_type: 'Course', value: input.achievementName },
    { trait_type: 'Institution', value: input.institutionName },
  ];
  if (input.grade !== null) attributes.push({ trait_type: 'Grade', value: input.grade });
  if (completedDate) attributes.push({ trait_type: 'Completed At', value: completedDate });
  attributes.push(
    { trait_type: 'Issued At', value: issuedDate },
    { trait_type: 'Network', value: networkLabel },
    { trait_type: 'Token Standard', value: 'ERC-721 + ERC-5192' },
    { trait_type: 'Transferable', value: 'No' },
    { trait_type: 'Issuer', value: 'Tessera' },
    { trait_type: 'Certificate ID', value: input.certificateId },
  );
  // La institucion emisora es la autoria del certificado, y queda ademas en
  // storage del contrato (certificateIssuer). Tessera firma y paga el gas, de
  // modo que el pagador nunca aparece como emisor.
  if (input.institutionWallet) {
    attributes.push({ trait_type: 'Issuer Wallet', value: input.institutionWallet });
  }

  return {
    schema: 'tessera.certificate.v3',
    id: input.certificateId,
    certificate_id: input.certificateId,
    name: `${input.achievementName} - ${input.studentName}`,
    description,

    course_name: input.achievementName,
    ...(input.courseId ? { course_id: input.courseId } : {}),
    recipient_name: input.studentName,
    ...(input.studentWallet ? { recipient_wallet: input.studentWallet } : {}),
    institution_name: input.institutionName,
    ...(input.institutionWallet ? { institution_wallet: input.institutionWallet } : {}),
    ...(input.grade !== null ? { grade: input.grade } : {}),

    issued_at: issuedDate,
    issued_at_iso: input.issuedAt,
    ...(completedDate ? { completed_at: completedDate } : {}),

    certificate_type: 'Soulbound Certificate (ERC-721 + ERC-5192)',
    token_standard: 'ERC-721',
    transferable: false,
    revocable: true,
    issuer: 'Tessera',
    blockchain: networkLabel,
    network: input.network,
    chain_id: input.chainId,
    ...(input.contractAddress ? { contract_address: input.contractAddress } : {}),
    ...(input.deployments?.length ? { deployments: input.deployments } : {}),
    ...(input.institutionWallet ? { issuer_wallet: input.institutionWallet } : {}),
    ...(input.institutionWallet
      ? { issuer_onchain_getter: 'certificateIssuer(uint256)' }
      : {}),
    gas_sponsor: 'Tessera',
    verify_url: input.externalUrl,

    ...(input.imageIpfsUri ? { image_ipfs: input.imageIpfsUri } : {}),
    attributes,
    image: input.imageUrl,
    image_url: input.imageUrl,
    external_url: input.externalUrl,
  };
}
