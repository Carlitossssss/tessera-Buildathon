'use client';

import { Container } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { useT } from '@tessera/i18n';
import type { PublicBillingCatalog } from '@/lib/plans';

/**
 * Cabecera de la página de precios, en el idioma activo.
 *
 * Vive aparte porque la página sigue siendo un Server Component (necesita
 * `await safeFetch` para pedir el catálogo antes de renderizar); el texto —y
 * el nombre de los planes por defecto, que también depende del idioma— es lo
 * único que necesita `useT()`, así que solo eso se aísla aquí.
 */
export function PricingHeader({ catalog }: { catalog: PublicBillingCatalog | null }) {
  const t = useT();
  const tscPerCertificate = catalog?.tscPerCertificate ?? 2;
  const planNames = catalog?.plans?.length
    ? catalog.plans.map((plan) => plan.name).join(', ')
    : t.marketing.pricing.defaultPlans;

  return (
    <Container size="md" className="text-center">
      <Badge variant="brand" className="mx-auto">
        {t.marketing.pricing.eyebrow}
      </Badge>
      <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        {t.marketing.pricing.pageTitle}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-base text-[var(--color-fg-muted)]">
        {t.marketing.pricing.pageBody
          .replace('{plans}', planNames)
          .replace('{tsc}', String(tscPerCertificate))}
      </p>
    </Container>
  );
}
