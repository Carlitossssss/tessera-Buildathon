import type { Metadata } from 'next';
import { VerifyResultClient } from './verify-result-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ tokenId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tokenId } = await params;
  return {
    title: `Certificado #${tokenId} · Verificación`,
    description: `Verificación on-chain del certificado SBT #${tokenId} emitido en Tessera sobre Polygon.`,
    openGraph: {
      title: `Certificado #${tokenId} · Verificación Tessera`,
      description: `Verificación on-chain del certificado SBT #${tokenId}.`,
    },
  };
}

export default function VerifyTokenPage({ params }: PageProps) {
  return <VerifyResultClient params={params} />;
}
