'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Archive, Cpu, Fingerprint, Globe2, Lock, ScrollText } from 'lucide-react';
import { useT, type Dictionary } from '@tessera/i18n';
import { Reveal } from '@/components/fx/reveal';

/**
 * Pilares tecnicos, en el idioma activo.
 *
 * Los titulos son nombres de estandar --ERC-5192, Polygon, EIP-712-- y se
 * quedan igual en los dos idiomas: son nombres, no palabras.
 */
function pillarsFor(t: Dictionary) {
  return [
    { icon: Lock, title: 'ERC-5192', body: t.marketing.trust.pillars.soulbound },
    { icon: ScrollText, title: 'ERC-721 + ERC-4906', body: t.marketing.trust.pillars.standards },
    { icon: Globe2, title: 'Polygon', body: t.marketing.trust.pillars.polygon },
    { icon: Fingerprint, title: 'Verificacion por hash', body: t.marketing.trust.pillars.hash },
    { icon: Archive, title: 'IPFS + Pinata', body: t.marketing.trust.pillars.storage },
    { icon: Cpu, title: 'Firma EIP-712', body: t.marketing.trust.pillars.signature },
  ];
}

export function TrustStrip() {
  const t = useT();
  const reduced = useReducedMotion();
  const pillars = pillarsFor(t);

  return (
    <section className="relative overflow-hidden border-b border-[var(--color-border)] py-20 sm:py-24 lg:py-28">
      <div className="container-page relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">
            {t.marketing.trust.eyebrow}
          </span>
          <h2
            className="mt-5 text-balance font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--color-fg)]"
            style={{ fontSize: 'clamp(1.75rem, 2.2vw + 0.7rem, 2.6rem)' }}
          >
            {t.marketing.trust.title}
          </h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-[var(--color-fg-muted)]">
            {t.marketing.trust.body}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: reduced ? 0 : 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
                transition={{
                  duration: reduced ? 0.2 : 0.55,
                  delay: reduced ? 0 : (i % 3) * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={reduced ? undefined : { y: -4 }}
                className="group rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)]/40 p-6 backdrop-blur transition-colors duration-300 hover:border-[var(--color-brand-500)]/40"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] transition-colors duration-300 group-hover:border-[var(--color-brand-400)]/50">
                  <Icon className="h-4.5 w-4.5 text-[var(--color-brand-300)]" />
                </span>
                <h3 className="mt-4 font-mono text-sm font-semibold tracking-[-0.01em] text-[var(--color-fg)]">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{p.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
