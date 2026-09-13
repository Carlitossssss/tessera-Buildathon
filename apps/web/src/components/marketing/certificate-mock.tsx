'use client';

import { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { Award, ShieldCheck } from 'lucide-react';
import { BorderBeam } from '@/components/fx/border-beam';
import { cn } from '@/lib/utils';

interface CertificateMockProps {
  className?: string;
  recipient?: string;
  course?: string;
  institution?: string;
  tokenId?: string;
  date?: string;
}

/**
 * Tarjeta de certificado SBT con efecto tilt 3D que sigue al cursor.
 */
export function CertificateMock({
  className,
  recipient = 'Sofía Pérez',
  course = 'Solidity Avanzado',
  institution = 'Bootcamp Devstart',
  tokenId = '0x1042',
  date = '12 ago 2025',
}: CertificateMockProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const sheen = useMotionValue('50% 50%');

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current!.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 8);
    rotateX.set(-(py - 0.5) * 8);
    sheen.set(`${px * 100}% ${py * 100}%`);
  };
  const onLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    sheen.set('50% 50%');
  };

  const sheenBg = useMotionTemplate`radial-gradient(circle at ${sheen}, rgba(255,255,255,0.18), transparent 55%)`;

  return (
    <div className={cn('[perspective:1200px]', className)}>
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-[28px] border border-[color-mix(in_oklab,var(--color-border),white_8%)] bg-[linear-gradient(180deg,#101735_0%,#0b1026_48%,#0b1021_100%)] px-7 pt-7 pb-12 shadow-[var(--shadow-glow)]"
      >
        <BorderBeam duration={9} />

        {/* Signature stamp — sello "VERIFICADO" que aparece en delay con rotación */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 1.4, rotate: -28 }}
          whileInView={{ opacity: 1, scale: 1, rotate: -16 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.9, ease: [0.25, 1, 0.5, 1] }}
          className="pointer-events-none absolute right-5 top-5 z-20 grid h-16 w-16 place-items-center rounded-full border-2 border-[var(--color-accent-400)]/65 text-[8.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent-400)] [text-shadow:0_0_18px_rgba(122,242,199,0.4)]"
          style={{ transform: 'translateZ(80px)' }}
        >
          <span className="leading-tight text-center">
            Verif.
            <br />
            on-chain
          </span>
        </motion.div>
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
            maskImage: 'radial-gradient(circle at center, #000, transparent 90%)',
            WebkitMaskImage: 'radial-gradient(circle at center, #000, transparent 90%)',
          }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: sheenBg }}
        />

        <div
          className="relative flex h-full flex-col justify-between"
          style={{ transform: 'translateZ(40px)' }}
        >
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-400)]" />
              Registro verificable · ERC-5192
            </div>
            <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white/[0.04] px-2.5 py-1 text-[10px] font-mono text-[var(--color-brand-200)]">
              {tokenId}
            </div>
          </header>

          <div className="space-y-4">
            <p className="text-[11px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
              Otorgado a
            </p>
            <h3 className="text-[1.9rem] font-semibold tracking-[-0.03em] text-[var(--color-fg)]">
              {recipient}
            </h3>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" />

            <div>
              <p className="text-[11px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
                Por completar
              </p>
              <p className="mt-1 text-lg font-medium tracking-[-0.02em] text-[var(--color-fg)]">
                {course}
              </p>
            </div>
          </div>

          <footer className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--color-fg-muted)]">{institution}</p>
              <p className="text-[10px] text-[var(--color-fg-subtle)]">{date} · Polygon mainnet</p>
              <p className="mt-1 text-[10px] font-mono text-[var(--color-brand-200)]">
                hash: 0x7af2...3e91
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-accent-500)]/40 bg-[var(--color-accent-500)]/10 text-[var(--color-accent-400)]">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/10 text-[var(--color-brand-200)]">
                <Award className="h-4 w-4" />
              </span>
            </div>
          </footer>
        </div>
      </motion.div>
    </div>
  );
}
