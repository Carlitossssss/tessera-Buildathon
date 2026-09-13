'use client';

import Link from 'next/link';
import { ArrowRight, BadgeCheck, Box, ShieldCheck, Zap } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ShimmerButton } from '@/components/fx/shimmer-button';
import { AuroraBackground } from '@/components/fx/aurora-background';
import { GridBackground } from '@/components/fx/grid-background';
import { Sparkles as SparklesFX } from '@/components/fx/sparkles';
import { useT, type Dictionary } from '@tessera/i18n';
import { VerifyDemo } from '@/components/marketing/verify-demo';

/** Las tres pruebas bajo el hero, en el idioma activo. */
function proofItemsFor(t: Dictionary) {
  const p = t.marketing.studentHero.proof;
  return [
    { icon: Zap, title: p.verification.title, body: p.verification.body },
    { icon: Box, title: p.onchain.title, body: p.onchain.body },
    { icon: ShieldCheck, title: p.fast.title, body: p.fast.body },
  ];
}

const ecosystem = [
  { name: 'polygon', logo: PolygonLogo },
  { name: 'avalanche', logo: AvalancheLogo },
  { name: 'unlock', logo: UnlockLogo },
  { name: 'hsk chain', logo: HskLogo },
];

interface StudentHeroProps {
  stats?: {
    studentsVerified: number;
    badgesShared: number;
  };
}

export function StudentHero(_props: StudentHeroProps) {
  const t = useT();
  const signals = [
    t.marketing.studentHero.signals.verifiable,
    t.marketing.studentHero.signals.linkedin,
    t.marketing.studentHero.signals.forever,
  ];
  const proofItems = proofItemsFor(t);
  const reduced = useReducedMotion();
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 18 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduced ? 0.2 : 0.65,
      delay: reduced ? 0 : delay,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  });

  return (
    <section className="relative isolate flex items-center overflow-hidden border-b border-[var(--color-border)] pt-18 sm:pt-20 lg:pt-16">
      <AuroraBackground intensity="medium" />
      <GridBackground />
      <SparklesFX density={36} />

      <div className="container-page relative pb-10 pt-5 sm:pb-12 sm:pt-6 lg:pb-14 lg:pt-7 xl:pb-16 xl:pt-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_1fr] lg:gap-14">
          <div className="min-w-0 max-w-[620px]">
            <motion.h1
              {...rise(0.08)}
              className="text-balance font-semibold leading-[1.03] tracking-[-0.04em] text-[var(--color-fg)]"
              style={{ fontSize: 'clamp(2.1rem, 3vw + 0.6rem, 3.4rem)' }}
            >
              {t.marketing.studentHero.titleStart}{' '}
              <span className="gradient-text">{t.marketing.studentHero.titleAccent}</span>.
            </motion.h1>

            <motion.p
              {...rise(0.18)}
              className="mt-6 max-w-[56ch] text-[1.05rem] leading-relaxed text-[var(--color-fg-muted)]"
            >
              {t.marketing.studentHero.body}
            </motion.p>

            <motion.ul {...rise(0.28)} className="mt-7 space-y-3">
              {signals.map((signal) => (
                <li
                  key={signal}
                  className="flex items-start gap-3 text-sm text-[var(--color-fg-muted)]"
                >
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent-400)]" />
                  <span>{signal}</span>
                </li>
              ))}
            </motion.ul>

            <motion.div {...rise(0.38)} className="mt-9 flex flex-wrap items-center gap-3">
              <ShimmerButton asChild>
                <Link href="/register?role=student">
                  {t.marketing.studentHero.ctaPrimary} <ArrowRight className="h-4 w-4" />
                </Link>
              </ShimmerButton>
              <Button variant="outline" size="lg" asChild>
                <Link href="/instituciones">{t.marketing.studentHero.ctaSecondary}</Link>
              </Button>
            </motion.div>

            <motion.p
              {...rise(0.5)}
              className="mt-8 inline-flex items-center gap-2 text-xs text-[var(--color-fg-subtle)]"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent-400)]" />
              {t.marketing.studentHero.free}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 28, scale: reduced ? 1 : 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduced ? 0.2 : 0.9, delay: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0"
          >
            <VerifyDemo />
          </motion.div>
        </div>

        <motion.div
          {...rise(0.62)}
          className="mt-6 border-t border-[var(--color-border)] pt-4"
        >
          <div className="grid gap-5 lg:grid-cols-3 lg:divide-x lg:divide-[var(--color-border)]">
            {proofItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-4 lg:px-8 first:lg:pl-0 last:lg:pr-0"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[color-mix(in_oklab,var(--color-brand-400),transparent_45%)] bg-[var(--color-bg-card)]/70 text-[var(--color-brand-300)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[var(--color-fg)]">
                      {item.title}
                    </span>
                    <span className="mt-1 block max-w-[28ch] text-xs leading-relaxed text-[var(--color-fg-muted)]">
                      {item.body}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-4 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-fg-subtle)] md:flex-row md:items-center">
            <span className="font-semibold text-[var(--color-fg)]">Tessera.</span>
            <span className="hidden h-px flex-1 bg-[var(--color-border)] md:block" />
            <span>{t.marketing.studentHero.tagline}</span>
            <span className="hidden h-px flex-1 bg-[var(--color-border)] md:block" />
            <span className="font-semibold text-[var(--color-fg-muted)]">
              {t.marketing.studentHero.poweredBy}
            </span>
            <span className="flex flex-wrap items-center gap-3">
              {ecosystem.map((item, index) => {
                const Logo = item.logo;
                return (
                  <span key={item.name} className="inline-flex items-center gap-3">
                    {index > 0 ? (
                      <span className="h-5 w-px bg-[var(--color-border)]" aria-hidden />
                    ) : null}
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-fg-muted)]">
                      <Logo />
                      {item.name}
                    </span>
                  </span>
                );
              })}
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function PolygonLogo() {
  return (
    <svg className="h-4 w-4 text-[#8247e5]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m8.2 8.4 3.8-2.2 3.8 2.2v4.4L12 15l-3.8-2.2V8.4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m15.8 8.4 3.2-1.9 3.2 1.9v3.8L19 14.1l-3.2-1.9M8.2 12.8 5 14.7l-3.2-1.9V9L5 7.1l3.2 1.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AvalancheLogo() {
  return (
    <svg className="h-4 w-4 text-[#e84142]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3 22 21h-6.5L12 14.6 8.5 21H2L12 3Z" fill="currentColor" />
      <path d="M15.1 21h-6.2l3.1-5.5 3.1 5.5Z" fill="#fff" opacity="0.18" />
    </svg>
  );
}

function UnlockLogo() {
  return (
    <svg className="h-4 w-4 text-[#8b5cf6]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 10V8a5 5 0 0 1 9.7-1.7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M6 10h12v4.5a6 6 0 0 1-12 0V10Z"
        fill="currentColor"
      />
      <circle cx="12" cy="14" r="1.4" fill="#080d1a" />
    </svg>
  );
}

function HskLogo() {
  return (
    <svg className="h-4 w-4 text-[#22d3ee]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.5 20.2 7v10L12 21.5 3.8 17V7L12 2.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8 9.2 12 7l4 2.2v5.6L12 17l-4-2.2V9.2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}
