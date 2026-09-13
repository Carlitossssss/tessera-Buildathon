'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check, FileWarning, X } from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/fx/reveal';
import { useT } from '@tessera/i18n';
import { DotPattern } from '@/components/fx/dot-pattern';

export function ProblemShift() {
  const t = useT();
  const reduced = useReducedMotion();
  const oldItems = [
    t.marketing.problem.old.items.edited,
    t.marketing.problem.old.items.phone,
    t.marketing.problem.old.items.lost,
    t.marketing.problem.old.items.proof,
  ];
  const newItems = [
    t.marketing.problem.new.items.signed,
    t.marketing.problem.new.items.selfCheck,
    t.marketing.problem.new.items.lives,
    t.marketing.problem.new.items.soulbound,
  ];

  return (
    <section className="relative overflow-hidden border-b border-[var(--color-border)] py-20 sm:py-24 lg:py-28">
      <DotPattern className="opacity-40" />

      <div className="container-page relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">
            <FileWarning className="h-3.5 w-3.5" />
            {t.marketing.problem.eyebrow}
          </span>
          <h2
            className="mt-5 text-balance font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--color-fg)]"
            style={{ fontSize: 'clamp(1.75rem, 2.2vw + 0.7rem, 2.6rem)' }}
          >
            {t.marketing.problem.title}
          </h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-[var(--color-fg-muted)]">
            {t.marketing.problem.body}
          </p>
        </Reveal>

        <div className="relative mx-auto mt-14 grid max-w-4xl items-stretch gap-5 lg:grid-cols-[1fr_auto_1fr] lg:gap-4">
          {/* Antes */}
          <RevealGroup className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white/[0.015] p-6 sm:p-7">
            <RevealItem>
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-danger-500)]/25 bg-[var(--color-danger-500)]/10">
                  <AlertTriangle className="h-4 w-4 text-[var(--color-danger-500)]" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">
                    {t.marketing.problem.old.title}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
                    {t.marketing.problem.old.subtitle}
                  </p>
                </div>
              </div>
            </RevealItem>
            <ul className="mt-6 space-y-3.5">
              {oldItems.map((item) => (
                <RevealItem key={item}>
                  <li className="flex items-start gap-3">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger-500)]/70" />
                    <span className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
                      {item}
                    </span>
                  </li>
                </RevealItem>
              ))}
            </ul>
          </RevealGroup>

          {/* Flecha */}
          <div className="flex items-center justify-center lg:px-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: reduced ? 0.2 : 0.5, delay: 0.25 }}
              className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
            >
              <ArrowRight className="h-4 w-4 rotate-90 text-[var(--color-brand-300)] lg:rotate-0" />
            </motion.div>
          </div>

          {/* Después */}
          <RevealGroup
            delay={0.1}
            className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-accent-500)]/25 bg-[var(--color-accent-500)]/[0.04] p-6 shadow-[var(--shadow-glow)] sm:p-7"
          >
            <RevealItem>
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/10">
                  <Check className="h-4 w-4 text-[var(--color-accent-400)]" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">
                    {t.marketing.problem.new.title}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-accent-400)]">
                    {t.marketing.problem.new.subtitle}
                  </p>
                </div>
              </div>
            </RevealItem>
            <ul className="mt-6 space-y-3.5">
              {newItems.map((item) => (
                <RevealItem key={item}>
                  <li className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent-400)]" />
                    <span className="text-sm leading-relaxed text-[var(--color-fg)]">{item}</span>
                  </li>
                </RevealItem>
              ))}
            </ul>
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
