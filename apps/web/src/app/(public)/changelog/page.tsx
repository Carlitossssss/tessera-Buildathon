'use client';

import { GitCommit } from 'lucide-react';
import { useT, type Dictionary } from '@tessera/i18n';
import { Container } from '@/components/ui/container';

/** Las entradas del registro, en el idioma activo. */
function entriesFor(t: Dictionary) {
  const e = t.public.changelog.entries;
  return [
    {
      version: 'v1.0',
      date: '2026',
      items: [e.v10.issuing, e.v10.verification, e.v10.courses],
    },
    {
      version: 'v0.9',
      date: '2026',
      items: [e.v09.webhooks, e.v09.tsc, e.v09.gdpr],
    },
  ];
}

export default function ChangelogPage() {
  const t = useT();
  const entries = entriesFor(t);
  return (
    <article className="py-24">
      <Container size="md">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-brand-200)]">
          {t.public.changelog.eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-fg)]">
          {t.public.changelog.title}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
          {t.public.changelog.body}
        </p>

        <div className="mt-10 space-y-6">
          {entries.map((entry) => (
            <section
              key={entry.version}
              className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-200)]">
                  <GitCommit className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-semibold text-[var(--color-fg)]">{entry.version}</h2>
                  <p className="text-xs text-[var(--color-fg-subtle)]">{entry.date}</p>
                </div>
              </div>
              <ul className="mt-5 space-y-2 text-sm text-[var(--color-fg-muted)]">
                {entry.items.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Container>
    </article>
  );
}
