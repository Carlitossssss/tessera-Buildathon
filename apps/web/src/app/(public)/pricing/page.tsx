import type { Metadata } from 'next';
import { Pricing } from '@/components/marketing/pricing';
import { FAQ } from '@/components/marketing/faq';
import { CallToAction } from '@/components/marketing/cta';
import { apiRequest } from '@/lib/api/client';
import { safeFetch } from '@/lib/dashboard';
import type { PublicBillingCatalog } from '@/lib/plans';
import { PricingHeader } from './pricing-header';

export const metadata: Metadata = { title: 'Precios' };

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const catalog = await safeFetch(() =>
    apiRequest<PublicBillingCatalog>('/v1/public/billing-catalog'),
  );

  return (
    <>
      <section className="pt-24 pb-4 sm:pt-32">
        <PricingHeader catalog={catalog} />
      </section>
      <Pricing variant="page" showHeader={false} catalog={catalog} />
      <FAQ />
      <CallToAction />
    </>
  );
}
