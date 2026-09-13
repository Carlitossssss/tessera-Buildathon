'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ShimmerButton } from '@/components/fx/shimmer-button';
import { AuroraBackground } from '@/components/fx/aurora-background';
import { GridBackground } from '@/components/fx/grid-background';
import { Sparkles } from '@/components/fx/sparkles';
import { AnimatedCounter } from '@/components/fx/animated-counter';
import { CertificateMock } from '@/components/marketing/certificate-mock';
import { useT } from '@tessera/i18n';
import { cn } from '@/lib/utils';

interface HeroStats {
  certificatesIssued: number;
  apiUptimePct: number;
  avgEmissionSeconds: number;
}

export function Hero({
  stats = { certificatesIssued: 0, apiUptimePct: 0, avgEmissionSeconds: 0 },
}: {
  stats?: HeroStats;
}) {
  const t = useT();
  const signals = [
    t.marketing.hero.signals.custody,
    t.marketing.hero.signals.api,
    t.marketing.hero.signals.storage,
  ];
  return (
    <section className="relative isolate flex items-center overflow-hidden border-b border-[var(--color-border)] pt-24 sm:pt-28 lg:min-h-[88vh] lg:pt-20">
      <AuroraBackground intensity="medium" />
      <GridBackground />
      <Sparkles density={42} />

      <div className="container-page relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-20 xl:gap-14 xl:py-24">
        <div className="min-w-0 max-w-[620px]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-200)] backdrop-blur"
          >
            {t.marketing.hero.eyebrow}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 max-w-[15ch] text-balance font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--color-fg)]"
            style={{ fontSize: 'clamp(2.1rem, 3vw + 0.6rem, 3.4rem)' }}
          >
            {t.marketing.hero.title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="mt-6 max-w-[60ch] text-[1.05rem] leading-relaxed text-[var(--color-fg-muted)]"
          >
            {t.marketing.hero.body}
          </motion.p>

          <motion.ul
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.68 }}
            className="mt-7 space-y-3"
          >
            {signals.map((signal) => (
              <li
                key={signal}
                className="flex items-start gap-3 text-sm text-[var(--color-fg-muted)]"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--color-accent-400)]" />
                <span>{signal}</span>
              </li>
            ))}
          </motion.ul>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <ShimmerButton asChild>
              <Link href="/register">
                {t.marketing.hero.ctaPrimary} <ArrowRight className="h-4 w-4" />
              </Link>
            </ShimmerButton>
            <Button variant="outline" size="lg" asChild>
              <Link href="/pricing">{t.marketing.hero.ctaSecondary}</Link>
            </Button>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9 }}
            className="mt-12 grid max-w-2xl gap-3 sm:grid-cols-3"
          >
            <Stat
              label={t.marketing.hero.stats.issued}
              value={<AnimatedCounter to={stats.certificatesIssued} suffix="+" />}
            />
            <Stat
              label={t.marketing.hero.stats.uptime}
              value={<AnimatedCounter to={stats.apiUptimePct} decimals={1} suffix="%" />}
            />
            <Stat
              label={t.marketing.hero.stats.emission}
              value={<AnimatedCounter to={stats.avgEmissionSeconds} suffix="s" />}
            />
          </motion.dl>

          <p className="mt-8 inline-flex items-center gap-2 text-xs text-[var(--color-fg-subtle)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent-400)]" />
            {t.marketing.hero.compliance}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full min-w-0 max-w-[560px]"
        >
          <div className="rounded-[32px] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 shadow-[var(--shadow-card)] backdrop-blur md:p-5">
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <SignalCard
                label={t.marketing.hero.panel.webhookEvents}
                value="132 ms"
                tone="accent"
              />
              <SignalCard label={t.marketing.hero.panel.activeNetwork} value="Polygon" />
              <SignalCard
                label={t.marketing.hero.panel.status}
                value={t.marketing.hero.panel.operational}
                tone="accent"
              />
            </div>
            <CertificateMock />
          </div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="absolute -left-10 top-14 hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)]/92 p-3 backdrop-blur xl:block"
          >
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
              {t.marketing.hero.panel.audit}
            </p>
            <p className="mt-1 font-mono text-xs text-[var(--color-accent-400)]">
              {t.marketing.hero.panel.auditValue}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 1.25 }}
            className="absolute -right-8 bottom-10 hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)]/92 p-3 backdrop-blur xl:block"
          >
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
              {t.marketing.hero.panel.verification}
            </p>
            <p className="mt-1 font-mono text-xs text-[var(--color-fg)]">
              {t.marketing.hero.panel.verificationValue}
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.03] px-4 py-4 backdrop-blur">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-2 text-[1.8rem] font-semibold tracking-[-0.03em] text-[var(--color-fg)]">
        {value}
      </dd>
    </div>
  );
}

function SignalCard({ label, value, tone }: { label: string; value: string; tone?: 'accent' }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[rgba(10,13,26,0.62)] px-4 py-3 backdrop-blur">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </p>
      <p
        className={cn(
          'mt-2 text-sm font-semibold text-[var(--color-fg)]',
          tone === 'accent' && 'text-[var(--color-accent-400)]',
        )}
      >
        {value}
      </p>
    </div>
  );
}
