import type { Metadata } from 'next';
import { VerifyForm } from '@/components/verify/verify-form';
import { VerifyHowItWorks, VerifyIntro } from './verify-intro';

export const metadata: Metadata = {
  title: 'Verificar certificado',
  description:
    'Verifica la autenticidad de cualquier certificado emitido en Tessera. Comprobacion on-chain en Polygon, sin necesidad de cuenta.',
  openGraph: {
    title: 'Verificar certificado - Tessera',
    description:
      'Verifica la autenticidad de cualquier certificado emitido en Tessera contra la blockchain de Polygon.',
  },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ certificateId?: string }>;
}) {
  const { certificateId } = await searchParams;

  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-5xl py-14 sm:py-20">
        <VerifyIntro />

        <div className="mt-10">
          <VerifyForm initialCertificateId={certificateId} />
        </div>

        <VerifyHowItWorks />
      </div>
    </div>
  );
}
