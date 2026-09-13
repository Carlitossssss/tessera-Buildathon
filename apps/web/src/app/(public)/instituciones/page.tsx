import type { Metadata } from 'next';
import { Hero } from '@/components/marketing/hero';
import { LogoCloud } from '@/components/marketing/logo-cloud';
import { Features } from '@/components/marketing/features';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { Pricing } from '@/components/marketing/pricing';
import { Testimonials } from '@/components/marketing/testimonials';
import { FAQ } from '@/components/marketing/faq';
import { CallToAction } from '@/components/marketing/cta';
import { apiRequest } from '@/lib/api/client';
import { safeFetch } from '@/lib/dashboard';
import type { PublicBillingCatalog } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Tessera para Instituciones · Credenciales on-chain con grado profesional',
  description:
    'Emisión, revocación y verificación pública de credenciales académicas y profesionales con SLA institucional, API y custodia opcional.',
};

export const dynamic = 'force-dynamic';

interface PublicStats {
  certificatesIssued: number;
  avgEmissionSeconds: number;
}

export default async function InstitutionsLandingPage() {
  const [statsPayload, health, catalog] = await Promise.all([
    safeFetch(() => apiRequest<PublicStats>('/v1/public/stats')),
    safeFetch(() => apiRequest<{ status: 'ok' | 'degraded' }>('/v1/health')),
    safeFetch(() => apiRequest<PublicBillingCatalog>('/v1/public/billing-catalog')),
  ]);
  const stats = {
    certificatesIssued: statsPayload?.certificatesIssued ?? 0,
    apiUptimePct: health?.status === 'ok' ? 100 : 0,
    avgEmissionSeconds: statsPayload?.avgEmissionSeconds ?? 0,
  };

  return (
    <>
      <Hero stats={stats} />
      <LogoCloud />
      <Features />
      <HowItWorks />
      <Pricing catalog={catalog} />
      <Testimonials />
      <FAQ />
      <CallToAction />
    </>
  );
}
