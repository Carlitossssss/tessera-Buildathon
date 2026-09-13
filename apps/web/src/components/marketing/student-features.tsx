'use client';

import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Building2,
  Linkedin,
  Lock,
  Share2,
  Sparkles,
  WalletMinimal,
  Globe,
} from 'lucide-react';
import { useT, type Dictionary } from '@tessera/i18n';

/** Las seis promesas del portafolio, en el idioma activo. */
function itemsFor(t: Dictionary) {
  const i = t.marketing.studentFeatures.items;
  return [
    { icon: BadgeCheck, title: i.verifiable.title, desc: i.verifiable.desc },
    { icon: Linkedin, title: i.linkedin.title, desc: i.linkedin.desc },
    { icon: Lock, title: i.unforgeable.title, desc: i.unforgeable.desc },
    { icon: WalletMinimal, title: i.noWallet.title, desc: i.noWallet.desc },
    { icon: Globe, title: i.forever.title, desc: i.forever.desc },
    { icon: Share2, title: i.publicPage.title, desc: i.publicPage.desc },
  ];
}

export function StudentFeatures() {
  const t = useT();
  const items = itemsFor(t);
  return (
    <section className="container-page py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-200)]">
          <Sparkles className="h-3.5 w-3.5" />
          {t.marketing.studentFeatures.eyebrow}
        </p>
        <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.04em] text-[var(--color-fg)] sm:text-5xl">
          {t.marketing.studentFeatures.title}
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-fg-muted)]">
          {t.marketing.studentFeatures.body}
        </p>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="group rounded-2xl border border-[var(--color-border)] bg-white/[0.025] p-6 backdrop-blur transition hover:border-[var(--color-border-strong)] hover:bg-white/[0.04]"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/10 text-[var(--color-accent-400)]">
              <item.icon className="h-4 w-4" />
            </div>
            <h3 className="mt-4 text-base font-semibold tracking-[-0.01em] text-[var(--color-fg)]">
              {item.title}
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-fg-muted)]">
              {item.desc}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-14 flex items-center justify-center gap-2 text-sm text-[var(--color-fg-muted)]">
        <Building2 className="h-3.5 w-3.5" />
        {t.marketing.studentFeatures.institutionQuestion}{' '}
        <a
          href="/instituciones"
          className="font-semibold text-[var(--color-brand-300)] hover:text-[var(--color-brand-200)]"
        >
          {t.marketing.studentFeatures.institutionLink}
        </a>
      </div>
    </section>
  );
}
