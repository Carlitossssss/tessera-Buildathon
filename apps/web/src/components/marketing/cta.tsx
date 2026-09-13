'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ShimmerButton } from '@/components/fx/shimmer-button';
import { Meteors } from '@/components/fx/meteors';
import { BorderBeam } from '@/components/fx/border-beam';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';

export function CallToAction() {
  const t = useT();
  return (
    <section className="relative isolate py-28">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
          className="relative isolate overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[#101827] via-[#080d1a] to-[#172033] px-8 py-20 text-center shadow-[var(--shadow-glow)] sm:px-16"
        >
          <Meteors count={22} />
          <BorderBeam duration={11} />

          <div
            aria-hidden
            className="absolute inset-x-0 -top-1/2 h-[140%] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.35),transparent_55%)]"
          />

          <div className="relative">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-accent-400)]">
              {t.marketing.cta.eyebrow}
            </p>
            <h2 className="mx-auto mt-4 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-5xl">
              {t.marketing.cta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-fg-muted)]">
              {t.marketing.cta.body}
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <ShimmerButton asChild>
                <Link href="/register">
                  {t.marketing.cta.primary} <ArrowRight className="h-4 w-4" />
                </Link>
              </ShimmerButton>
              <Button variant="outline" size="lg" asChild>
                <Link href="/contact">{t.marketing.cta.secondary}</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
