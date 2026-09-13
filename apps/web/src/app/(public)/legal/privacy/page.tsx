'use client';

import { useI18n } from '@tessera/i18n';
import { Container } from '@/components/ui/container';

/** Intl entiende el codigo corto; no hace falta mapear a 'es-ES'. */

export default function PrivacyPage() {
  const { t, locale } = useI18n();

  return (
    <article className="py-24">
      <Container size="md" className="prose-invert">
        <h1 className="text-3xl font-semibold tracking-tight">{t.public.legal.privacy.title}</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-subtle)]">
          {t.public.legal.lastUpdated} {new Date().toLocaleDateString(locale)}
        </p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--color-fg-muted)]">
          <p>{t.public.legal.privacy.intro}</p>
          <h2 className="text-base font-semibold text-[var(--color-fg)]">
            {t.public.legal.privacy.rightsTitle}
          </h2>
          <p>
            {t.public.legal.privacy.rightsBody}{' '}
            <a className="text-[var(--color-brand-300)]" href="mailto:dpo@tessera.io">
              dpo@tessera.io
            </a>
            .
          </p>
          <h2 className="text-base font-semibold text-[var(--color-fg)]">
            {t.public.legal.privacy.retentionTitle}
          </h2>
          <p>{t.public.legal.privacy.retentionBody}</p>
        </div>
      </Container>
    </article>
  );
}
