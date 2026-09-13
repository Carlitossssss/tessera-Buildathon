'use client';

import { useI18n } from '@tessera/i18n';
import { Container } from '@/components/ui/container';

/** Intl entiende el codigo corto; no hace falta mapear a 'es-ES'. */

export default function CompliancePage() {
  const { t } = useI18n();
  const sections = [
    t.public.legal.compliance.sections.privacy,
    t.public.legal.compliance.sections.audit,
    t.public.legal.compliance.sections.continuity,
  ];

  return (
    <article className="py-24">
      <Container size="md">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t.public.legal.compliance.title}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-subtle)]">
          {t.public.legal.compliance.subtitle}
        </p>
        <div className="mt-8 grid gap-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6"
            >
              <h2 className="text-base font-semibold text-[var(--color-fg)]">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </Container>
    </article>
  );
}
