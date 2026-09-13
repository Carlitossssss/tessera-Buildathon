'use client';

import { motion } from 'framer-motion';
import { ClipboardList, Cpu, Send, ShieldCheck } from 'lucide-react';
import { useT, type Dictionary } from '@tessera/i18n';
import { Spotlight } from '@/components/fx/spotlight';

/** Los cuatro pasos de la emision, en el idioma activo. */
function stepsFor(t: Dictionary) {
  const s = t.marketing.howItWorks.steps;
  return [
    { icon: ClipboardList, title: s.template.title, description: s.template.description },
    { icon: Send, title: s.launch.title, description: s.launch.description },
    { icon: Cpu, title: s.mint.title, description: s.mint.description },
    { icon: ShieldCheck, title: s.verify.title, description: s.verify.description },
  ];
}

export function HowItWorks() {
  const t = useT();
  const steps = stepsFor(t);
  return (
    <section
      id="how"
      className="relative isolate overflow-hidden border-b border-[var(--color-border)] py-28"
    >
      <div className="container-page relative">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-brand-200)]">
            {t.marketing.howItWorks.eyebrow}
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-5xl">
            {t.marketing.howItWorks.title}
          </h2>
          <p className="mt-4 text-[var(--color-fg-muted)]">
            {t.marketing.howItWorks.body}
          </p>
        </header>

        <div className="relative mx-auto mt-20 max-w-3xl">
          <div
            aria-hidden
            className="absolute left-7 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-[var(--color-brand-500)]/60 to-transparent md:left-1/2 md:-translate-x-1/2"
          />

          <ol className="space-y-12">
            {steps.map((step, i) => (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`relative grid items-center gap-6 md:grid-cols-2 ${
                  i % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''
                }`}
              >
                <div className="relative">
                  <div className="relative ml-12 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6 md:mx-0 md:max-w-sm">
                    <Spotlight />
                    <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-brand-200)]">
                      {t.marketing.howItWorks.step} 0{i + 1}
                    </span>
                    <h3 className="mt-2 text-xl font-semibold text-[var(--color-fg)]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm text-[var(--color-fg-muted)]">{step.description}</p>
                  </div>
                </div>

                <div className="relative flex md:justify-center">
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 grid h-14 w-14 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--shadow-glow)] left-0 md:left-1/2 md:-translate-x-1/2`}
                  >
                    <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--color-brand-500)]/30 to-[var(--color-accent-500)]/30 blur-md" />
                    <step.icon className="relative h-5 w-5 text-[var(--color-fg)]" />
                  </span>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
