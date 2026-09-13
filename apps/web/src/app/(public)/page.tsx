import type { Metadata } from 'next';
import { StudentHero } from '@/components/marketing/student-hero';
import { ProblemShift } from '@/components/marketing/problem-shift';
import { Journey } from '@/components/marketing/journey';
import { StudentFeatures } from '@/components/marketing/student-features';
import { TrustStrip } from '@/components/marketing/trust-strip';
import { Testimonials } from '@/components/marketing/testimonials';
import { FAQ } from '@/components/marketing/faq';
import { StudentCallToAction } from '@/components/marketing/student-cta';
import { apiRequest } from '@/lib/api/client';
import { safeFetch } from '@/lib/dashboard';

export const metadata: Metadata = {
  title: 'Tessera · Tu portafolio de logros verificable',
  description:
    'Reúne tus certificados y badges en un perfil verificable on-chain, listo para LinkedIn y portfolio. Sin costo para estudiantes.',
};

export const dynamic = 'force-dynamic';

interface PublicStats {
  studentsVerified: number;
  badgesShared: number;
  certificatesIssued: number;
  avgEmissionSeconds: number;
}

export default async function HomePage() {
  const stats = (await safeFetch(() => apiRequest<PublicStats>('/v1/public/stats'))) ?? {
    studentsVerified: 0,
    badgesShared: 0,
    certificatesIssued: 0,
    avgEmissionSeconds: 0,
  };

  return (
    <>
      <StudentHero stats={stats} />
      <ProblemShift />
      <Journey />
      <StudentFeatures />
      <TrustStrip />
      <Testimonials />
      <FAQ />
      <StudentCallToAction />
    </>
  );
}
