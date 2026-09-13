'use client';

import Link from 'next/link';
import { LanguageSwitcher, useT } from '@tessera/i18n';
import { BrandMark } from '@/components/brand/brand-mark';
import { Container } from '@/components/ui/container';

/**
 * Pie del sitio público.
 *
 * Pasa a ser componente de cliente porque lee el idioma activo. No trae estado
 * ni efectos: sólo consume el diccionario, así que el coste es el del propio
 * árbol de enlaces.
 *
 * Aquí vive el selector de idioma para las páginas públicas: es donde alguien
 * que llega sin cuenta lo busca, junto a los enlaces legales.
 */
export function SiteFooter() {
  const t = useT();

  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: t.footer.product.title,
      links: [
        { label: t.footer.product.institutions, href: '/instituciones#features' },
        { label: t.footer.product.howItWorks, href: '/instituciones#how' },
        { label: t.footer.product.pricing, href: '/pricing' },
        { label: t.footer.product.api, href: '/docs/api' },
      ],
    },
    {
      title: t.footer.resources.title,
      links: [
        { label: t.footer.resources.verify, href: '/verify' },
        { label: t.footer.resources.status, href: '/status' },
        { label: t.footer.resources.changelog, href: '/changelog' },
        { label: t.footer.resources.support, href: 'mailto:support@tessera.io' },
      ],
    },
    {
      title: t.footer.legal.title,
      links: [
        { label: t.footer.legal.terms, href: '/legal/terms' },
        { label: t.footer.legal.privacy, href: '/legal/privacy' },
        { label: t.footer.legal.compliance, href: '/legal/compliance' },
        { label: t.footer.legal.cookies, href: '/legal/cookies' },
      ],
    },
  ];

  return (
    <footer className="border-t border-[var(--color-border)] bg-[rgba(7,9,22,0.6)] py-14">
      <Container size="xl">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="col-span-2 space-y-4 md:col-span-4 lg:col-span-1">
            <BrandMark />
            <p className="max-w-sm text-sm leading-relaxed text-[var(--color-fg-muted)]">
              {t.footer.tagline}
            </p>
            <LanguageSwitcher variant="full" />
            <p className="text-xs text-[var(--color-fg-subtle)]">
              © {new Date().getFullYear()} Tessera Labs. {t.footer.rights}
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </footer>
  );
}
