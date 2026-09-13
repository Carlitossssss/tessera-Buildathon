'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Building2, Clock, Sparkles } from 'lucide-react';
import { useT } from '@tessera/i18n';
import { CourseUnlockGate } from './course-unlock-gate';

type CourseDetail = Awaited<
  ReturnType<typeof import('@/lib/api/endpoints/me').meApi.publicCourseDetail>
>;

interface Props {
  detail: CourseDetail;
  slug: string;
  returnTo: string;
  isFree: boolean;
  isHybrid: boolean;
  canRequestFreeEnrollment: boolean;
  signedInAsStudent: boolean;
  existingEnrollmentId: string | null;
  enrollFreeCourseAction: (formData: FormData) => void;
  enrollAction:
    | ((input: {
        wallet: string;
        signature: string;
        issuedAt: number;
      }) => Promise<{ ok: true; enrollmentId: string } | { ok: false; message: string }>)
    | null;
}

/**
 * Formato de precio.
 *
 * Vive aquí y no en la página: una función no se puede pasar como prop de un
 * Server Component a un Client Component (React no la puede serializar), y
 * hacerlo rompía la página entera en producción.
 *
 * `'Gratis'` y el separador de miles quedan fijos en español ('es-PE'), igual
 * que antes: documentado como pendiente junto a formatPrice y formatDuration
 * de apps/web/src/lib/portal/api.ts.
 */
function priceLabel(cents: number, currency: string, isFree: boolean) {
  if (isFree || !cents) return 'Gratis';
  const amount = (cents / 100).toLocaleString('es-PE', { maximumFractionDigits: 2 });
  return `${currency} ${amount}`;
}

/**
 * Cuerpo de la página de detalle de curso, en el idioma activo.
 *
 * La página en sí sigue siendo un Server Component: pide el catálogo, la
 * sesión y las matrículas existentes con `await`. Aquí sólo llega lo que ya
 * se resolvió, para poder leer el idioma con useT().
 */
export function CourseDetailShell({
  detail,
  slug,
  returnTo,
  isFree,
  isHybrid,
  canRequestFreeEnrollment,
  signedInAsStudent,
  existingEnrollmentId,
  enrollFreeCourseAction,
  enrollAction,
}: Props) {
  const t = useT();
  const membership = detail.membership;

  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-5xl py-12 sm:py-16">
        <Link
          href="/cursos"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> {t.public.courseDetail.backToCatalogue}
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <article>
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
              <Building2 className="h-3.5 w-3.5" />
              <Link href="/instituciones" className="hover:text-[var(--color-fg)]">
                {detail.institution.name}
              </Link>
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-5xl">
              {detail.course.title}
            </h1>
            {detail.course.description && (
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-fg-muted)] sm:text-lg">
                {detail.course.description}
              </p>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Stat
                icon={BookOpen}
                label={t.public.courseDetail.stats.modules}
                value={detail.modules.length.toString()}
              />
              <Stat
                icon={Clock}
                label={t.public.courseDetail.stats.duration}
                value={detail.course.durationHours ? `${detail.course.durationHours} h` : '—'}
              />
              <Stat
                icon={Sparkles}
                label={t.public.courseDetail.stats.passing}
                value={`${detail.course.passingScore}%`}
              />
            </div>

            <section className="mt-10">
              {membership && enrollAction ? (
                /* El recorrido completo del bounty: muestra abierta, verificación
                   on-chain y desbloqueo. El temario plano no aplica aquí porque
                   cada módulo necesita saber si es previsualizable. */
                <CourseUnlockGate
                  courseId={detail.course.id}
                  courseSlug={slug}
                  membership={membership}
                  modules={detail.modules.map((m) => ({
                    id: m.id,
                    title: m.title,
                    description: m.description,
                    previewable: m.previewable,
                  }))}
                  signedIn={signedInAsStudent}
                  loginHref={`/login?next=${encodeURIComponent(returnTo)}`}
                  enrollAction={enrollAction}
                  enrollmentId={existingEnrollmentId}
                />
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-[var(--color-fg)]">
                    {t.public.courseDetail.coursePlan}
                  </h2>
                  <ol className="mt-4 space-y-3">
                    {detail.modules.map((m, i) => (
                      <li
                        key={m.id}
                        className="flex items-start gap-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] bg-white/[0.03] font-mono text-sm text-[var(--color-fg-muted)]">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--color-fg)]">{m.title}</p>
                          {m.description && (
                            <p className="mt-1 text-xs leading-5 text-[var(--color-fg-muted)]">
                              {m.description}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.85),rgba(10,13,26,0.95))] p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]">
              <p className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
                {t.public.courseDetail.enrolment}
              </p>
              <p className="mt-2 font-mono text-3xl text-[var(--color-brand-200)]">
                {/* El precio de un curso token-gated lo fija el Lock on-chain,
                    no priceCents: mostrar ese campo diría un importe falso. */}
                {membership
                  ? t.public.courseDetail.membershipPrice
                  : priceLabel(detail.course.priceCents, detail.course.currency, isFree)}
              </p>
              <p className="mt-2 text-xs text-[var(--color-fg-muted)]">
                {membership
                  ? t.public.courseDetail.enrolmentHint.membership
                  : detail.course.visibility === 'hybrid'
                    ? t.public.courseDetail.enrolmentHint.hybrid
                    : isFree
                      ? t.public.courseDetail.enrolmentHint.free
                      : t.public.courseDetail.enrolmentHint.paid}
              </p>
              <div className="mt-5 grid gap-2">
                {membership ? (
                  /* El botón real vive en el gate, junto a la muestra: duplicarlo
                     aquí haría creer que hay dos caminos distintos de compra. */
                  <a
                    href={membership.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)] transition hover:border-[var(--color-border-strong)] hover:bg-white/[0.06]"
                  >
                    {t.public.courseDetail.getMembership}
                  </a>
                ) : canRequestFreeEnrollment ? (
                  <form action={enrollFreeCourseAction}>
                    <input type="hidden" name="courseId" value={detail.course.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-brand-500)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-400)]"
                    >
                      {isHybrid
                        ? t.public.courseDetail.enrolAsStudent
                        : t.public.courseDetail.enrolFree}
                    </button>
                  </form>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-xl bg-[var(--color-brand-500)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-400)]"
                  >
                    {t.public.courseDetail.signInToContinue}
                  </Link>
                )}
                {detail.course.visibility === 'hybrid' && (
                  <Link
                    href="/cursos/canjear"
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)] transition hover:border-[var(--color-border-strong)] hover:bg-white/[0.06]"
                  >
                    {t.public.courseDetail.haveCode}
                  </Link>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-[var(--color-fg)]">{value}</p>
    </div>
  );
}
