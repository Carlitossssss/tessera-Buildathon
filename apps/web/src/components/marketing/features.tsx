'use client';

import { motion } from 'framer-motion';
import { Activity, Code2, Database, Globe2, Lock, Webhook } from 'lucide-react';
import { CardSpotlight } from '@/components/fx/card-spotlight';
import { useT, type Dictionary } from '@tessera/i18n';
import { Sparkles } from '@/components/fx/sparkles';

/**
 * Las seis celdas de la parrilla, en el idioma activo.
 *
 * El fragmento de codigo no se traduce: es codigo, no interfaz.
 */
function cellsFor(t: Dictionary) {
  const c = t.marketing.features.cells;
  return [
    {
      span: 'col-span-12 md:col-span-7 row-span-2',
      eyebrow: c.soulbound.eyebrow,
      title: c.soulbound.title,
      description: c.soulbound.description,
      visual: <CodeSnippet />,
      icon: undefined,
    },
    {
      span: 'col-span-12 md:col-span-5',
      eyebrow: c.storage.eyebrow,
      title: c.storage.title,
      description: c.storage.description,
      visual: <StoragePill t={t} />,
      icon: Database,
    },
    {
      span: 'col-span-12 sm:col-span-6 md:col-span-5',
      eyebrow: c.webhooks.eyebrow,
      title: c.webhooks.title,
      description: c.webhooks.description,
      visual: <WebhookPing />,
      icon: Webhook,
    },
    {
      span: 'col-span-12 sm:col-span-6 md:col-span-4',
      eyebrow: c.gdpr.eyebrow,
      title: c.gdpr.title,
      description: c.gdpr.description,
      visual: undefined,
      icon: Lock,
    },
    {
      span: 'col-span-12 sm:col-span-6 md:col-span-4',
      eyebrow: c.api.eyebrow,
      title: c.api.title,
      description: c.api.description,
      visual: undefined,
      icon: Activity,
    },
    {
      span: 'col-span-12 sm:col-span-6 md:col-span-4',
      eyebrow: c.verification.eyebrow,
      title: c.verification.title,
      description: c.verification.description,
      visual: undefined,
      icon: Globe2,
    },
  ];
}

export function Features() {
  const t = useT();
  const cells = cellsFor(t);
  return (
    <section id="features" className="relative isolate border-b border-[var(--color-border)] py-28">
      <Sparkles density={26} />
      <div className="container-page relative">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-brand-200)]">
            {t.marketing.features.eyebrow}
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-5xl">
            {t.marketing.features.title}
          </h2>
          <p className="mt-4 text-[var(--color-fg-muted)]">
            {t.marketing.features.body}
          </p>
        </header>

        <div className="mt-16 grid auto-rows-[minmax(220px,auto)] grid-cols-12 gap-4">
          {cells.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className={c.span}
            >
              <CardSpotlight className="flex h-full flex-col justify-between p-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-brand-200)]">
                      {c.eyebrow}
                    </span>
                    {c.icon ? (
                      <span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-fg-muted)]">
                        <c.icon className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-fg-muted)]">
                        <Code2 className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--color-fg)]">{c.title}</h3>
                  <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{c.description}</p>
                </div>
                {c.visual ? <div className="mt-6">{c.visual}</div> : null}
              </CardSpotlight>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CodeSnippet() {
  return (
    <pre className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[#070b1c] p-4 text-[12.5px] leading-relaxed">
      <code className="font-mono text-[var(--color-fg-muted)]">
        <span className="text-[var(--color-brand-200)]">await</span>{' '}
        <span className="text-[var(--color-accent-400)]">tessera</span>.certificates.mint(&#123;
        {'\n'}
        {'  '}recipient: <span className="text-[#f7c98b]">&apos;0x84e…&apos;</span>,{'\n'}
        {'  '}course: <span className="text-[#f7c98b]">&apos;Solidity Avanzado&apos;</span>,{'\n'}
        {'  '}metadata: &#123; cohort: <span className="text-[#f7c98b]">&apos;Q4-2025&apos;</span>{' '}
        &#125;,{'\n'}
        &#125;);{'\n'}
        <span className="text-[var(--color-fg-subtle)]">
          {'// → token #1042 · soulbound · 42s'}
        </span>
      </code>
    </pre>
  );
}

function StoragePill({ t }: { t: Dictionary }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-brand-500)]/15 text-[var(--color-brand-200)]">
          AR
        </span>
        <div>
          <p className="font-medium text-[var(--color-fg)]">Arweave</p>
          <p className="text-[var(--color-fg-subtle)]">
            {t.marketing.features.cells.storage.permanent}
          </p>
        </div>
      </div>
      <span className="h-px flex-1 bg-gradient-to-r from-[var(--color-brand-500)]/40 to-[var(--color-accent-500)]/40" />
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-accent-500)]/15 text-[var(--color-accent-400)]">
          IPFS
        </span>
        <div>
          <p className="font-medium text-[var(--color-fg)]">Pinata</p>
          <p className="text-[var(--color-fg-subtle)]">
            {t.marketing.features.cells.storage.replicated}
          </p>
        </div>
      </div>
    </div>
  );
}

function WebhookPing() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-3 font-mono text-xs">
      <span className="rounded-md bg-[var(--color-accent-500)]/15 px-2 py-0.5 text-[var(--color-accent-400)]">
        POST
      </span>
      <span className="truncate text-[var(--color-fg-muted)]">/lms.tudominio.com/hook</span>
      <span className="ml-auto text-[var(--color-accent-400)]">200 OK</span>
    </div>
  );
}
