'use client';

import Link from 'next/link';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useT } from '@tessera/i18n';

/**
 * Formulario de canje de código, en el idioma activo.
 *
 * La `action` (redeemAction) sigue en la página: es una Server Action y no
 * puede leer el idioma con useT(). Su mensaje de validación —"Ingresa un
 * código válido"— queda en español, igual que el resto de mensajes de
 * servidor documentados en el proyecto; el ok/error que llega por
 * searchParams se muestra tal cual porque puede venir del propio servidor.
 */
export function RedeemView({
  action,
  error,
  ok,
  slug,
}: {
  action: (formData: FormData) => void;
  error?: string;
  ok?: string;
  slug?: string;
}) {
  const t = useT();

  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-xl py-14 sm:py-20">
        <Link
          href="/cursos"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> {t.public.courses.redeem.back}
        </Link>

        <div className="mt-6 rounded-3xl border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.85),rgba(10,13,26,0.95))] p-8 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-border)] bg-white/5 text-[var(--color-brand-200)]">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
                {t.public.courses.redeem.eyebrow}
              </p>
              <h1 className="text-xl font-semibold text-[var(--color-fg)]">
                {t.public.courses.redeem.title}
              </h1>
            </div>
          </div>
          <p className="mt-4 text-sm text-[var(--color-fg-muted)]">
            {t.public.courses.redeem.body}
          </p>

          <form action={action} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
                {t.public.courses.redeem.codeLabel}
              </span>
              <input
                type="text"
                name="code"
                required
                minLength={4}
                maxLength={16}
                autoComplete="off"
                spellCheck={false}
                placeholder="ABCDE12345"
                className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.7)] px-4 py-3 font-mono text-base uppercase tracking-[0.18em] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-brand-400)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-brand-500),transparent_60%)]"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-[color-mix(in_oklab,var(--color-danger-500),transparent_60%)] bg-[color-mix(in_oklab,var(--color-danger-500),transparent_88%)] px-3 py-2 text-xs text-[var(--color-danger-300)]">
                {error}
              </p>
            )}
            {ok && (
              <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {t.public.courses.redeem.confirmedPrefix} {slug ? `«${slug}»` : ''}.
              </p>
            )}

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-brand-500)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-400)]"
            >
              {t.public.courses.redeem.submit}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
