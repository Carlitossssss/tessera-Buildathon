'use client';

import { useT, type Dictionary } from '@tessera/i18n';

/**
 * Cabecera y explicacion de la pagina de verificacion.
 *
 * Vive aparte porque la pagina lee searchParams en el servidor y no puede ser
 * un componente de cliente.
 */
function stepsFor(t: Dictionary) {
  const s = t.public.verify.steps;
  return [
    { step: '01', title: s.id.title, desc: s.id.desc },
    { step: '02', title: s.onchain.title, desc: s.onchain.desc },
    { step: '03', title: s.independent.title, desc: s.independent.desc },
  ];
}

export function VerifyIntro() {
  const t = useT();

  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-brand-300)]">
        {t.public.verify.eyebrow}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-5xl">
        {t.public.verify.title}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--color-fg-muted)] sm:text-lg">
        {t.public.verify.body}
      </p>
    </div>
  );
}

export function VerifyHowItWorks() {
  const t = useT();

  return (
    <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-[var(--color-border)] bg-white/[0.015] p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-[var(--color-fg)]">{t.public.verify.howTitle}</h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {stepsFor(t).map((item) => (
          <li key={item.step} className="flex flex-col gap-2">
            <span className="text-2xl font-bold tabular-nums text-[var(--color-brand-500)]/30">
              {item.step}
            </span>
            <p className="text-sm font-medium text-[var(--color-fg)]">{item.title}</p>
            <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">{item.desc}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
