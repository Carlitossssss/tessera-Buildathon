'use client';

import Link from 'next/link';
import { BookOpen, ExternalLink, KeyRound, ShieldCheck, Webhook } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { useT, type Dictionary } from '@tessera/i18n';
import { publicEnv } from '@/lib/env';

/** Las tres capacidades de la API, en el idioma activo. */
function sectionsFor(t: Dictionary) {
  const s = t.public.docs.sections;
  return [
    { icon: KeyRound, title: s.auth.title, description: s.auth.description },
    { icon: Webhook, title: s.webhooks.title, description: s.webhooks.description },
    { icon: ShieldCheck, title: s.verification.title, description: s.verification.description },
  ];
}

export default function ApiDocsPage() {
  const t = useT();
  const sections = sectionsFor(t);
  return (
    <article className="py-24">
      <Container size="lg">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-brand-200)]">
            {t.public.docs.eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-5xl">
            {t.public.docs.title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
            {t.public.docs.body}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/register">{t.public.docs.createKey}</Link>
            </Button>
            <Button asChild variant="secondary">
              {/* La referencia completa es privada: exige sesion. */}
              <Link href="/login?next=/institution/developers">
                {t.public.docs.viewDocs} <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {sections.map((section) => (
            <div
              key={section.title}
              className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6"
            >
              <section.icon className="h-5 w-5 text-[var(--color-accent-400)]" />
              <h2 className="mt-4 text-base font-semibold text-[var(--color-fg)]">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {section.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[#070b1c] p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-fg)]">
            <BookOpen className="h-4 w-4 text-[var(--color-brand-200)]" />
            {t.public.docs.baseEndpoint}
          </div>
          <code className="mt-3 block overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-4 text-sm text-[var(--color-fg-muted)]">
            {`${publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/v1`}
          </code>
        </div>
      </Container>
    </article>
  );
}
