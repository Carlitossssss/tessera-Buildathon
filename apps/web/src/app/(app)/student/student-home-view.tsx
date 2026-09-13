'use client';

import Link from 'next/link';
import { Award, BookOpen, GraduationCap, ShieldAlert, Sparkles, Trophy, Wallet } from 'lucide-react';
import { useI18n, type Dictionary } from '@tessera/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard, SectionHeading, EmptyState } from '@/components/dashboard/stat-card';
import { relativeTime } from '@/lib/format';
import type { StudentDashboardData } from '@/lib/api/endpoints/student';
import { RefreshWhileSuspended } from '../refresh-while-suspended';
import { RedeemCodeForm } from './_components/redeem-code-form';

const PANEL =
  'rounded-[26px] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.88),rgba(10,13,26,0.96))] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]';

const EMPTY_COUNTS = {
  enrollments: 0,
  inProgress: 0,
  completed: 0,
  notStarted: 0,
  certificates: 0,
  certificatesIssued: 0,
  badges: 0,
  pendingGrading: 0,
};

/**
 * El subtitulo del saludo.
 *
 * Tres situaciones distintas, cada una con su frase completa en el
 * diccionario: sin cursos, con cursos en marcha, y todo completado. Armarlo
 * por concatenacion obligaria a que todos los idiomas siguieran el orden del
 * espanol.
 */
function subtitleFor(
  data: StudentDashboardData | null,
  counts: typeof EMPTY_COUNTS,
  t: Dictionary,
) {
  if (!data) return t.student.home.subtitle.failed;
  if (counts.enrollments === 0) return t.student.home.subtitle.empty;

  if (counts.inProgress > 0) {
    const template =
      counts.inProgress === 1
        ? t.student.home.subtitle.inProgressOne
        : t.student.home.subtitle.inProgressMany;
    return template
      .replace('{courses}', String(counts.inProgress))
      .replace('{credentials}', String(counts.certificatesIssued));
  }

  const template =
    counts.completed === 1
      ? t.student.home.subtitle.completedOne
      : t.student.home.subtitle.completedMany;
  return template
    .replace('{completed}', String(counts.completed))
    .replace('{credentials}', String(counts.certificatesIssued));
}

export function StudentHomeView({ data }: { data: StudentDashboardData | null }) {
  const { t, locale } = useI18n();
  const counts = data?.counts ?? EMPTY_COUNTS;

  const firstName =
    data?.user.name?.split(' ')[0] ??
    data?.user.email.split('@')[0] ??
    t.student.home.fallbackName;

  const hasSuspendedCourses =
    data?.activeCourses.some((course) => course.institutionStatus === 'suspended') ?? false;

  return (
    <div className="space-y-10">
      <RefreshWhileSuspended active={hasSuspendedCourses} />
      <section className={`${PANEL} relative overflow-hidden p-8 lg:p-10`}>
        <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(60%_50%_at_85%_15%,rgba(94,109,255,0.18),transparent_70%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <Badge variant="brand" className="uppercase tracking-[0.18em]">
              {t.student.home.eyebrow}
            </Badge>
            <h1 className="mt-5 text-[34px] font-semibold leading-[1.05] tracking-tight text-[var(--color-fg)] lg:text-[42px]">
              {t.student.home.greeting.replace('{name}', firstName)}
            </h1>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-[var(--color-fg-muted)]">
              {subtitleFor(data, counts, t)}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/student/courses">
                  <BookOpen className="h-4 w-4" /> {t.student.home.viewCourses}
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/student/credentials">
                  <Award className="h-4 w-4" /> {t.student.home.myCredentials}
                </Link>
              </Button>
            </div>
          </div>

          <RedeemCodeForm />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.student.home.stats.activeCourses}
          value={counts.inProgress.toString()}
          hint={t.student.home.stats.activeCoursesHint.replace('{n}', String(counts.enrollments))}
          icon={BookOpen}
        />
        <StatCard
          label={t.student.home.stats.completed}
          value={counts.completed.toString()}
          hint={
            data?.avgFinalScore != null
              ? t.student.home.stats.average.replace('{score}', String(data.avgFinalScore))
              : t.student.home.stats.noAverage
          }
          icon={GraduationCap}
        />
        <StatCard
          label={t.student.home.stats.credentials}
          value={counts.certificatesIssued.toString()}
          hint={
            counts.certificates > counts.certificatesIssued
              ? t.student.home.stats.inFlight.replace(
                  '{n}',
                  String(counts.certificates - counts.certificatesIssued),
                )
              : t.student.home.stats.allIssued
          }
          icon={Award}
        />
        <StatCard
          label={t.student.home.stats.badges}
          value={counts.badges.toString()}
          hint={
            counts.pendingGrading > 0
              ? t.student.home.stats.pendingGrading.replace('{n}', String(counts.pendingGrading))
              : t.student.home.stats.noPending
          }
          icon={Trophy}
        />
      </div>

      <section>
        <SectionHeading
          title={t.student.home.continueTitle}
          description={t.student.home.continueBody}
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link href="/student/courses">{t.student.home.viewAll}</Link>
            </Button>
          }
        />
        {data && data.activeCourses.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.activeCourses.map((c) => {
              const institutionSuspended = c.institutionStatus === 'suspended';
              const content = (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                        <span>{c.institutionName ?? t.student.courses.institutionFallback}</span>
                      </div>
                      <h3 className="mt-2 truncate text-[18px] font-semibold leading-tight text-[var(--color-fg)]">
                        {c.courseTitle}
                      </h3>
                    </div>
                    <Badge
                      variant={
                        institutionSuspended
                          ? 'danger'
                          : c.status === 'in_progress'
                            ? 'brand'
                            : 'default'
                      }
                    >
                      {institutionSuspended
                        ? t.student.courses.status.suspended
                        : c.status === 'in_progress'
                          ? t.student.courses.status.inProgress
                          : t.student.courses.status.pendingStart}
                    </Badge>
                  </div>

                  {institutionSuspended ? (
                    <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-4 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
                      <div className="flex items-start gap-2.5">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-300)]" />
                        <div>
                          <p className="font-medium text-[var(--color-fg)]">
                            {t.student.courses.suspendedNotice}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6 space-y-2">
                    <div className="flex items-center justify-between text-[12px] text-[var(--color-fg-subtle)]">
                      <span>
                        {t.student.home.modulesOf
                          .replace('{done}', String(c.completedModules))
                          .replace('{total}', String(c.totalModules))}
                      </span>
                      <span className="font-mono text-[var(--color-brand-200)]">
                        {c.progressPct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-brand-500),var(--color-brand-300))] transition-all"
                        style={{ width: `${Math.max(2, c.progressPct)}%` }}
                      />
                    </div>
                  </div>

                  <p className="mt-5 text-[12px] text-[var(--color-fg-subtle)]">
                    {c.startedAt
                      ? t.student.home.startedAgo.replace('{time}', relativeTime(c.startedAt))
                      : t.student.home.noActivityYet}
                  </p>
                </>
              );

              return institutionSuspended ? (
                <article
                  key={c.enrollmentId}
                  className={`${PANEL} relative block p-6 opacity-85`}
                  aria-label={`${c.courseTitle}: ${t.student.courses.status.suspended}`}
                >
                  {content}
                </article>
              ) : (
                <Link
                  key={c.enrollmentId}
                  href={`/student/courses/${c.enrollmentId}`}
                  className={`${PANEL} group relative block p-6 transition-transform hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]`}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title={t.student.home.noActive.title}
            description={t.student.home.noActive.body}
          />
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className={`${PANEL} p-6`}>
          <h2 className="text-[16px] font-semibold tracking-tight text-[var(--color-fg)]">
            {t.student.home.activity.title}
          </h2>
          <p className="mt-1 text-[12.5px] text-[var(--color-fg-muted)]">
            {t.student.home.activity.body}
          </p>
          {data && data.recentActivity.length > 0 ? (
            <ul className="mt-5 divide-y divide-[var(--color-border)]">
              {data.recentActivity.map((a) => (
                <li key={a.attemptId} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-[var(--color-fg)]">
                      {a.assessmentTitle}
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-fg-subtle)]">
                      {a.courseTitle} \u00b7 {a.moduleTitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <Badge
                      variant={
                        a.status === 'graded'
                          ? a.score != null && a.score >= 70
                            ? 'success'
                            : 'warning'
                          : 'default'
                      }
                    >
                      {a.status === 'graded'
                        ? t.student.home.activity.graded
                        : a.status === 'submitted'
                          ? t.student.home.activity.submitted
                          : a.status}
                    </Badge>
                    <span className="w-12 font-mono text-[13px] tabular-nums text-[var(--color-fg)]">
                      {a.score != null ? a.score : '\u2014'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-[13px] text-[var(--color-fg-subtle)]">
              {t.student.home.activity.empty}
            </p>
          )}
        </div>

        <div className={`${PANEL} flex flex-col gap-5 p-6`}>
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold tracking-tight text-[var(--color-fg)]">
              {t.student.home.wallet.title}
            </h2>
            <Wallet className="h-4 w-4 text-[var(--color-brand-300)]" />
          </div>
          <p className="text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
            {t.student.home.wallet.body}
          </p>
          <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              {t.student.home.wallet.address}
            </p>
            <p className="mt-1.5 break-all font-mono text-[12.5px] text-[var(--color-fg)]">
              {data?.user.walletAddress ?? '\u2014'}
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/student/wallet">{t.student.home.wallet.detail}</Link>
          </Button>
          <p className="text-[11px] text-[var(--color-fg-subtle)]">
            {data?.user.emailVerifiedAt
              ? t.student.home.wallet.verifiedOn.replace(
                  '{date}',
                  new Date(data.user.emailVerifiedAt).toLocaleDateString(locale),
                )
              : t.student.home.wallet.unverified}
          </p>
        </div>
      </section>
    </div>
  );
}
