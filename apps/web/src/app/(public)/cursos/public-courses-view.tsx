'use client';

import Link from 'next/link';
import { ArrowRight, Building2, Clock, Globe2, KeyRound, Sparkles } from 'lucide-react';
import { useI18n, type Dictionary } from '@tessera/i18n';
import type { CourseVisibility, PublicCourseListEntry } from '@/lib/api/endpoints/me';

/**
 * Catálogo abierto, en el idioma activo.
 *
 * Vive aparte de la página porque aquélla lee la sesión en el servidor y no
 * puede ser un componente de cliente. Aquí llega ya resuelto lo que importa:
 * los cursos y si hay alguien dentro.
 */

function visibilityBadge(visibility: CourseVisibility, t: Dictionary) {
  const v = t.public.courses.visibility;
  const map: Record<CourseVisibility, { label: string; className: string }> = {
    public_free: {
      label: v.free,
      className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    },
    public_paid: {
      label: v.paid,
      className:
        'border-[var(--color-brand-700)]/40 bg-[var(--color-brand-500)]/10 text-[var(--color-brand-200)]',
    },
    hybrid: {
      label: v.hybrid,
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    },
    token_gated: {
      label: v.membership,
      className:
        'border-[var(--color-brand-700)]/40 bg-[var(--color-brand-500)]/10 text-[var(--color-brand-200)]',
    },
    private_code: { label: '', className: '' },
  };
  return map[visibility];
}

/**
 * Precio legible.
 *
 * El separador de miles sigue al idioma activo: "1.250" en español y "1,250"
 * en inglés. Dejarlo fijo delata que la traducción es superficial.
 */
function priceLabel(
  cents: number,
  currency: string,
  visibility: CourseVisibility,
  t: Dictionary,
  locale: string,
) {
  if (visibility === 'public_free' || !cents) return t.public.courses.visibility.free;
  const amount = (cents / 100).toLocaleString(locale, { maximumFractionDigits: 2 });
  return `${currency} ${amount}`;
}

export function PublicCoursesView({
  courses,
  isSignedIn,
}: {
  courses: PublicCourseListEntry[];
  isSignedIn: boolean;
}) {
  const { t, locale } = useI18n();

  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-7xl py-14 sm:py-20">
        <header className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-brand-300)]">
            {t.public.courses.eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-5xl">
            {t.public.courses.title}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--color-fg-muted)] sm:text-lg">
            {t.public.courses.body}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/cursos/canjear"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/5 px-4 py-2 text-sm text-[var(--color-fg)] transition hover:border-[var(--color-border-strong)] hover:bg-white/10"
            >
              <KeyRound className="h-4 w-4" />
              {t.public.courses.redeemCode}
            </Link>
            {!isSignedIn ? (
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-500)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-brand-400)]"
              >
                {t.public.courses.createAccount}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </header>

        <section className="mt-12">
          {courses.length === 0 ? (
            <div className="rounded-3xl border border-[var(--color-border)] bg-white/[0.02] p-10 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-[var(--color-brand-300)]" />
              <p className="mt-3 text-base font-medium text-[var(--color-fg)]">
                {t.public.courses.empty.title}
              </p>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                {t.public.courses.empty.body}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => {
                const vis = visibilityBadge(c.visibility, t);
                return (
                  <Link
                    key={c.id}
                    href={`/cursos/${c.institutionSlug}/${c.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.85),rgba(10,13,26,0.95))] transition hover:border-[var(--color-brand-500)]/50 hover:shadow-[0_24px_60px_-30px_rgba(56,128,255,0.55)]"
                  >
                    <div className="aspect-[16/9] w-full overflow-hidden bg-[linear-gradient(135deg,rgba(56,128,255,0.18),rgba(126,93,255,0.12))]">
                      {c.thumbnailUrl ? (
                        <img
                          src={c.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--color-fg-subtle)]">
                          <Globe2 className="h-9 w-9" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {vis.label && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${vis.className}`}
                          >
                            {vis.label}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-fg-subtle)]">
                          <Building2 className="h-3 w-3" />
                          {c.institutionName}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold leading-tight text-[var(--color-fg)] group-hover:text-[var(--color-brand-200)]">
                        {c.title}
                      </h3>
                      {c.description && (
                        <p className="line-clamp-3 text-sm leading-6 text-[var(--color-fg-muted)]">
                          {c.description}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-fg-subtle)]">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {c.durationHours
                            ? `${c.durationHours} ${t.public.courses.hours}`
                            : `${c.modulesCount} ${t.public.courses.modules}`}
                        </span>
                        <span className="font-mono text-sm text-[var(--color-brand-300)]">
                          {priceLabel(c.priceCents, c.currency, c.visibility, t, locale)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
