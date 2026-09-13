'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BadgeCheck,
  Check,
  Fingerprint,
  Link2,
  Loader2,
  Lock,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT, type Dictionary } from '@tessera/i18n';

interface Step {
  icon: typeof Search;
  label: string;
  detail: string;
  /** Duracion simulada del paso, en ms. */
  ms: number;
}

/**
 * Pasos y campos de ejemplo, en el idioma activo.
 *
 * Las etiquetas son interfaz y se traducen; los valores de ejemplo --nombre,
 * institucion, fecha-- son datos de muestra y se dejan como se escribieron.
 */
function stepsFor(t: Dictionary): Step[] {
  const s = t.marketing.verifyDemo.steps;
  return [
    { icon: Search, label: s.readToken.label, detail: s.readToken.detail, ms: 900 },
    { icon: Link2, label: s.resolveMetadata.label, detail: s.resolveMetadata.detail, ms: 800 },
    { icon: Fingerprint, label: s.compareHash.label, detail: s.compareHash.detail, ms: 1000 },
    { icon: Lock, label: s.checkLock.label, detail: s.checkLock.detail, ms: 700 },
  ];
}

function fieldsFor(t: Dictionary): Array<{ k: string; v: string }> {
  const f = t.marketing.verifyDemo.fields;
  return [
    { k: f.student, v: 'Sofía Pérez' },
    { k: f.program, v: 'Solidity Avanzado' },
    { k: f.institution, v: 'Bootcamp Devstart' },
    { k: f.issued, v: '29 ago 2026' },
    { k: f.network, v: 'Polygon · 80002' },
    { k: f.standard, v: 'ERC-721 + ERC-5192' },
  ];
}

type Phase = 'idle' | 'running' | 'done';

/**
 * Demo de verificacion. No golpea la red: reproduce la secuencia real que
 * ejecuta /verify para que el visitante entienda el producto sin registrarse.
 */
export function VerifyDemo() {
  const t = useT();
  const STEPS = stepsFor(t);
  const FIELDS = fieldsFor(t);
  const [phase, setPhase] = useState<Phase>('idle');
  const [active, setActive] = useState(-1);
  const reduced = useReducedMotion();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const run = useCallback(() => {
    clearTimers();
    setPhase('running');
    setActive(0);

    if (reduced) {
      setActive(STEPS.length);
      setPhase('done');
      return;
    }

    let elapsed = 0;
    STEPS.forEach((step, i) => {
      elapsed += step.ms;
      timers.current.push(
        setTimeout(() => {
          if (i === STEPS.length - 1) {
            setActive(STEPS.length);
            setPhase('done');
          } else {
            setActive(i + 1);
          }
        }, elapsed),
      );
    });
  }, [clearTimers, reduced, STEPS]);

  const reset = useCallback(() => {
    clearTimers();
    setPhase('idle');
    setActive(-1);
  }, [clearTimers]);

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-[color-mix(in_oklab,var(--color-brand-500),transparent_62%)] bg-[linear-gradient(180deg,rgba(16,24,39,0.82),rgba(8,13,26,0.92))] shadow-[0_28px_90px_-46px_rgba(99,102,241,0.65)] backdrop-blur">
      {/* Barra de navegador simulada */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-white/[0.025] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-black/25 px-3 py-1.5">
          <Lock className="h-3 w-3 shrink-0 text-[var(--color-accent-500)]" />
          <span className="truncate font-mono text-[11px] text-[var(--color-fg-subtle)]">
            tessera.blokis.dev/verify/1
          </span>
        </div>
      </div>

      <div className="relative p-5 sm:p-7">
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-10 h-36 w-36 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.32),transparent_66%)] blur-sm"
        />
        <AnimatePresence mode="wait">
          {phase === 'idle' ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="relative flex flex-col items-center py-8 text-center"
            >
              <div className="relative">
                <span className="absolute -inset-8 rounded-full bg-[var(--color-brand-500)]/10" />
                <span className="absolute -inset-4 animate-ping rounded-3xl bg-[var(--color-brand-500)]/20" />
                <div className="relative grid h-[74px] w-[74px] place-items-center rounded-[24px] border border-[color-mix(in_oklab,var(--color-brand-300),transparent_35%)] bg-[radial-gradient(circle_at_50%_35%,rgba(99,102,241,0.24),rgba(16,24,39,0.92))] shadow-[0_0_34px_rgba(99,102,241,0.56),inset_0_0_24px_rgba(99,102,241,0.18)]">
                  <ShieldCheck className="h-8 w-8 text-[var(--color-brand-300)]" />
                </div>
              </div>
              <p className="mt-5 text-base font-semibold text-[var(--color-fg)]">
                {t.marketing.verifyDemo.idle.title}
              </p>
              <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {t.marketing.verifyDemo.idle.body}
              </p>
              <div className="mt-5 flex w-full max-w-[360px] items-center gap-3 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg)]/60 px-4 py-3 text-left">
                <Link2 className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
                <span className="truncate font-mono text-xs text-[var(--color-fg-muted)]">
                  https://tessera.blokis.dev/verify/1
                </span>
              </div>
              <button
                type="button"
                onClick={run}
                className="mt-3 inline-flex w-full max-w-[360px] items-center justify-center gap-2 rounded-xl bg-[linear-gradient(180deg,#6b8cff_0%,#4f6df5_52%,#3f46f2_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-18px_rgba(79,109,245,0.9)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-300)]"
              >
                <Search className="h-4 w-4" />
                {t.marketing.verifyDemo.idle.cta}
              </button>
              <p className="mt-4 inline-flex items-center gap-2 text-[11px] text-[var(--color-fg-subtle)]">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-brand-300)]" />
                {t.marketing.verifyDemo.idle.note}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="run"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              <ol className="space-y-1.5">
                {STEPS.map((step, i) => {
                  const state = active > i ? 'done' : active === i ? 'busy' : 'wait';
                  const Icon = step.icon;
                  return (
                    <li
                      key={step.label}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors duration-300',
                        state === 'done' &&
                          'border-[var(--color-accent-500)]/25 bg-[var(--color-accent-500)]/[0.06]',
                        state === 'busy' &&
                          'border-[var(--color-brand-400)]/40 bg-[var(--color-brand-500)]/[0.08]',
                        state === 'wait' && 'border-transparent opacity-40',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-lg border',
                          state === 'done'
                            ? 'border-[var(--color-accent-500)]/40 text-[var(--color-accent-400)]'
                            : 'border-[var(--color-border-strong)] text-[var(--color-fg-muted)]',
                        )}
                      >
                        {state === 'done' ? (
                          <Check className="h-4 w-4" />
                        ) : state === 'busy' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand-300)]" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--color-fg)]">
                          {step.label}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-[var(--color-fg-subtle)]">
                          {step.detail}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>

              <AnimatePresence>
                {phase === 'done' && (
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-5 overflow-hidden rounded-xl border border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/[0.05]"
                  >
                    <div className="flex items-center gap-2.5 border-b border-[var(--color-accent-500)]/20 px-4 py-3">
                      <BadgeCheck className="h-5 w-5 text-[var(--color-accent-400)]" />
                      <span className="text-sm font-semibold text-[var(--color-fg)]">
                        {t.marketing.verifyDemo.result.authentic}
                      </span>
                      <span className="ml-auto rounded-full border border-[var(--color-accent-500)]/30 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent-400)]">
                        {t.marketing.verifyDemo.result.valid}
                      </span>
                    </div>
                    <dl className="grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-2">
                      {FIELDS.map((f, i) => (
                        <motion.div
                          key={f.k}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + i * 0.06, duration: 0.4 }}
                        >
                          <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                            {f.k}
                          </dt>
                          <dd className="mt-0.5 truncate text-sm text-[var(--color-fg)]">{f.v}</dd>
                        </motion.div>
                      ))}
                    </dl>
                    <div className="flex items-center justify-between gap-3 border-t border-[var(--color-accent-500)]/20 px-4 py-3">
                      <span className="truncate font-mono text-[10px] text-[var(--color-fg-subtle)]">
                        0xC1264850…734713 · #1
                      </span>
                      <button
                        type="button"
                        onClick={reset}
                        className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t.marketing.verifyDemo.result.repeat}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
