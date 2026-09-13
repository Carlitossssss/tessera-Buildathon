'use client';

import { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { GraduationCap, Share2, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { useT, type Dictionary } from '@tessera/i18n';
import { Reveal } from '@/components/fx/reveal';
import { cn } from '@/lib/utils';

/** Los cuatro pasos del recorrido, en el idioma activo. */
function stepsFor(t: Dictionary) {
  const n = (i: number) => `${t.marketing.journey.step} 0${i}`;
  return [
    {
      icon: GraduationCap,
      title: t.marketing.journey.steps.finish.title,
      body: t.marketing.journey.steps.finish.body,
      tag: n(1),
    },
    {
      icon: Wallet,
      title: t.marketing.journey.steps.receive.title,
      body: t.marketing.journey.steps.receive.body,
      tag: n(2),
    },
    {
      icon: Share2,
      title: t.marketing.journey.steps.share.title,
      body: t.marketing.journey.steps.share.body,
      tag: n(3),
    },
    {
      icon: ShieldCheck,
      title: t.marketing.journey.steps.verify.title,
      body: t.marketing.journey.steps.verify.body,
      tag: n(4),
    },
  ];
}

export function Journey() {
  const t = useT();
  const steps = stepsFor(t);
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 65%', 'end 55%'],
  });
  const raw = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 });
  const height = useTransform(raw, [0, 1], ['0%', '100%']);

  return (
    <section className="relative overflow-hidden border-b border-[var(--color-border)] py-20 sm:py-24 lg:py-28">
      <div className="container-page relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent-400)]" />
            {t.marketing.journey.eyebrow}
          </span>
          <h2
            className="mt-5 text-balance font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--color-fg)]"
            style={{ fontSize: 'clamp(1.75rem, 2.2vw + 0.7rem, 2.6rem)' }}
          >
            {t.marketing.journey.title}
          </h2>
        </Reveal>

        <div ref={ref} className="relative mx-auto mt-16 max-w-3xl">
          {/* Riel de progreso */}
          <div className="absolute left-[19px] top-2 hidden h-[calc(100%-1rem)] w-px bg-[var(--color-border)] sm:block">
            <motion.div
              className="w-px origin-top bg-gradient-to-b from-[var(--color-brand-400)] to-[var(--color-accent-500)]"
              style={{ height: reduced ? '100%' : height }}
            />
          </div>

          <ol className="space-y-5 sm:space-y-7">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.li
                  key={step.title}
                  initial={{ opacity: 0, y: reduced ? 0 : 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-15% 0px -15% 0px' }}
                  transition={{
                    duration: reduced ? 0.2 : 0.6,
                    delay: reduced ? 0 : i * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="relative sm:pl-16"
                >
                  <span
                    className={cn(
                      'absolute left-0 top-1 hidden h-10 w-10 place-items-center rounded-xl',
                      'border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] sm:grid',
                    )}
                  >
                    <Icon className="h-4 w-4 text-[var(--color-brand-300)]" />
                  </span>

                  <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)]/40 p-5 backdrop-blur transition-colors duration-300 hover:border-[var(--color-border-strong)] sm:p-6">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] sm:hidden">
                        <Icon className="h-4 w-4 text-[var(--color-brand-300)]" />
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-accent-400)]">
                        {step.tag}
                      </span>
                    </div>
                    <h3 className="mt-2.5 text-lg font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                      {step.body}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
