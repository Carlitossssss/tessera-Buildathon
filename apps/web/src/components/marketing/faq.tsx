'use client';

import { useState } from 'react';
import { ChevronDown, MessageSquareQuote, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuroraBackground } from '@/components/fx/aurora-background';
import { CardSpotlight } from '@/components/fx/card-spotlight';
import { GridBackground } from '@/components/fx/grid-background';
import { useT, type Dictionary } from '@tessera/i18n';
import { cn } from '@/lib/utils';

/** Las preguntas frecuentes, en el idioma activo. */
function faqItemsFor(t: Dictionary) {
  const i = t.marketing.faq.items;
  return [i.wallet, i.shutdown, i.gdpr, i.lms, i.gas, i.payments];
}

export function FAQ() {
  const t = useT();
  const items = faqItemsFor(t);
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="relative isolate overflow-hidden border-t border-[var(--color-border)] py-24 sm:py-28"
    >
      <GridBackground className="opacity-60" />
      <AuroraBackground intensity="soft" className="opacity-60" />

      <div className="container-page relative grid gap-12 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--color-brand-200)] backdrop-blur">
            <MessageSquareQuote className="h-3.5 w-3.5" />
            FAQ
          </div>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-5xl">
            {t.marketing.faq.title}
          </h2>
          <p className="mt-4 max-w-md text-[var(--color-fg-muted)]">
            {t.marketing.faq.body}
          </p>

          <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-accent-500)]/15 text-[var(--color-accent-400)]">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--color-fg)]">
                  {t.marketing.faq.card.title}
                </p>
                <p className="text-xs text-[var(--color-fg-subtle)]">
                  {t.marketing.faq.card.body}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, delay: idx * 0.04 }}
              >
                <CardSpotlight className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.03] backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setOpenIdx(open ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    aria-expanded={open}
                  >
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-brand-200)]">
                        0{idx + 1}
                      </span>
                      <p className="mt-2 text-base font-medium text-[var(--color-fg)]">{item.q}</p>
                    </div>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-fg-muted)]">
                      <ChevronDown
                        className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
                      />
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-[var(--color-border)] px-6 py-5">
                          <p className="max-w-2xl text-sm leading-relaxed text-[var(--color-fg-muted)]">
                            {item.a}
                          </p>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </CardSpotlight>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
