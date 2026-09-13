'use client';

import Link from 'next/link';
import { ArrowRight, Linkedin } from 'lucide-react';
import { motion } from 'framer-motion';
import { ShimmerButton } from '@/components/fx/shimmer-button';
import { Button } from '@/components/ui/button';
import { useT } from '@tessera/i18n';
import { Meteors } from '@/components/fx/meteors';

export function StudentCallToAction() {
  const t = useT();
  return (
    <section className="relative isolate py-24 sm:py-28">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
          className="relative isolate overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[#101827] via-[#080d1a] to-[#172033] px-6 py-16 text-center shadow-[var(--shadow-glow)] sm:px-12 sm:py-20"
        >
          <Meteors count={14} />

          <div
            aria-hidden
            className="absolute inset-x-0 -top-1/2 h-[140%] bg-[radial-gradient(ellipse_at_center,rgba(43,217,154,0.22),transparent_55%)]"
          />

          <div className="relative">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-accent-400)]">
              {t.marketing.studentCta.eyebrow}
            </p>
            <h2 className="mx-auto mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-4xl md:text-5xl">
              {t.marketing.studentCta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-fg-muted)]">
              {t.marketing.studentCta.body}
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <ShimmerButton asChild>
                <Link href="/register?role=student">
                  {t.marketing.studentCta.primary} <ArrowRight className="h-4 w-4" />
                </Link>
              </ShimmerButton>
              <Button variant="outline" size="lg" asChild>
                <Link href="/login?role=student">
                  <Linkedin className="h-4 w-4" />
                  {t.marketing.studentCta.secondary}
                </Link>
              </Button>
            </div>

            <p className="mt-6 text-xs text-[var(--color-fg-subtle)]">
              {t.marketing.studentCta.noCard}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
