'use client';

import Link from 'next/link';
import { BookOpen, GraduationCap, PlayCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { useI18n, type Dictionary } from '@tessera/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionHeading } from '@/components/dashboard/stat-card';
import { relativeTime } from '@/lib/format';
import type { StudentCourseRow } from '@/lib/api/endpoints/student';
import { RefreshWhileSuspended } from '../../refresh-while-suspended';
import { RedeemCodeForm } from '../_components/redeem-code-form';

const PANEL =
  'rounded-[26px] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.88),rgba(10,13,26,0.96))] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]';

interface Totals {
  total: number;
  inProgress: number;
  completed: number;
  notStarted: number;
}

/**
 * El resumen lleva plural.
 *
 * Se elige entre dos frases completas en vez de concatenar trozos: el orden de
 * las palabras cambia entre idiomas, y una frase armada por partes se traduce
 * mal en cuanto el idioma no sigue el mismo orden que el espanol.
 */
function subtitleFor(totals: Totals, t: Dictionary) {
  if (totals.total === 0) return t.student.courses.subtitleEmpty;
  const template =
    totals.total === 1 ? t.student.courses.subtitleOne : t.student.courses.subtitleMany;
  return template
    .replace('{total}', String(totals.total))
    .replace('{inProgress}', String(totals.inProgress))
    .replace('{completed}', String(totals.completed));
}

export function StudentCoursesView({
  courses,
  totals,
}: {
  courses: StudentCourseRow[];
  totals: Totals;
}) {
  const { t, locale } = useI18n();

  const grouped = {
    in_progress: courses.filter((c) => c.status === 'in_progress'),
    not_started: courses.filter((c) => c.status === 'not_started'),
    completed: courses.filter((c) => c.status === 'completed'),
  };
  const hasSuspendedCourses = courses.some((course) => course.institutionStatus === 'suspended');

  return (
    <div className="space-y-10">
      <RefreshWhileSuspended active={hasSuspendedCourses} />
      <header className={`${PANEL} relative overflow-hidden p-8 lg:p-10`}>
        <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(50%_45%_at_85%_20%,rgba(94,109,255,0.18),transparent_70%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <Badge variant="brand" className="uppercase tracking-[0.18em]">
              {t.student.courses.eyebrow}
            </Badge>
            <h1 className="mt-5 text-[32px] font-semibold leading-[1.05] tracking-tight text-[var(--color-fg)] lg:text-[40px]">
              {t.student.courses.title}
            </h1>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-[var(--color-fg-muted)]">
              {subtitleFor(totals, t)}
            </p>
          </div>
          <RedeemCodeForm />
        </div>
      </header>

      {courses.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t.student.courses.empty.title}
          description={t.student.courses.empty.body}
        />
      ) : (
        <>
          <CourseGroup
            title={t.student.courses.groups.inProgress}
            items={grouped.in_progress}
            accent="brand"
            locale={locale}
            t={t}
          />
          <CourseGroup
            title={t.student.courses.groups.notStarted}
            items={grouped.not_started}
            locale={locale}
            t={t}
          />
          <CourseGroup
            title={t.student.courses.groups.completed}
            items={grouped.completed}
            accent="success"
            locale={locale}
            t={t}
          />
        </>
      )}
    </div>
  );
}

function CourseGroup({
  title,
  items,
  accent,
  locale,
  t,
}: {
  title: string;
  items: StudentCourseRow[];
  accent?: 'brand' | 'success';
  locale: string;
  t: Dictionary;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeading title={`${title} \u00b7 ${items.length}`} />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {items.map((c) => (
          <CourseCard key={c.enrollmentId} course={c} accent={accent} locale={locale} t={t} />
        ))}
      </div>
    </section>
  );
}

function CourseCard({
  course: c,
  accent,
  locale,
  t,
}: {
  course: StudentCourseRow;
  accent?: 'brand' | 'success';
  locale: string;
  t: Dictionary;
}) {
  const institutionSuspended = c.institutionStatus === 'suspended';
  const status = t.student.courses.status;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            {c.institutionName ?? t.student.courses.institutionFallback}
          </p>
          <h3 className="mt-2 line-clamp-2 text-[18px] font-semibold leading-tight text-[var(--color-fg)]">
            {c.courseTitle}
          </h3>
        </div>
        <Badge variant={institutionSuspended ? 'danger' : (accent ?? 'default')}>
          {institutionSuspended
            ? status.suspended
            : c.status === 'completed'
              ? status.completed
              : c.status === 'in_progress'
                ? status.inProgress
                : status.notStarted}
        </Badge>
      </div>

      {institutionSuspended ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-4 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-300)]" />
            <div>
              <p className="font-medium text-[var(--color-fg)]">
                {t.student.courses.suspendedNotice}
              </p>
            </div>
          </div>
        </div>
      ) : c.courseDescription ? (
        <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
          {c.courseDescription}
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[12px] text-[var(--color-fg-subtle)]">
          <span>
            {t.student.courses.modules
              .replace('{done}', String(c.completedModules))
              .replace('{total}', String(c.totalModules))}
          </span>
          <span className="font-mono text-[var(--color-brand-200)]">{c.progressPct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-brand-500),var(--color-brand-300))]"
            style={{ width: `${Math.max(2, c.progressPct)}%` }}
          />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <div className="text-[11px] text-[var(--color-fg-subtle)]">
          {c.completedAt
            ? t.student.courses.completedOn.replace(
                '{date}',
                new Date(c.completedAt).toLocaleDateString(locale),
              )
            : c.startedAt
              ? t.student.courses.lastActivity.replace('{time}', relativeTime(c.startedAt))
              : t.student.courses.noActivity}
          {c.finalScore != null ? (
            <span className="ml-2 font-mono text-[var(--color-fg)]">
              \u00b7 {t.student.courses.score.replace('{n}', String(c.finalScore))}
            </span>
          ) : null}
        </div>
        <Button variant="secondary" size="sm" className="pointer-events-none" aria-hidden>
          {institutionSuspended ? (
            <>
              <ShieldAlert className="h-3.5 w-3.5" /> {t.student.courses.actions.blocked}
            </>
          ) : c.status === 'completed' ? (
            <>
              <GraduationCap className="h-3.5 w-3.5" /> {t.student.courses.actions.view}
            </>
          ) : c.status === 'in_progress' ? (
            <>
              <PlayCircle className="h-3.5 w-3.5" /> {t.student.courses.actions.continue}
            </>
          ) : (
            <>
              <BookOpen className="h-3.5 w-3.5" /> {t.student.courses.actions.start}
            </>
          )}
        </Button>
      </div>
    </>
  );

  if (institutionSuspended) {
    return (
      <article
        className={`${PANEL} relative flex flex-col gap-5 p-6 opacity-85`}
        aria-label={`${c.courseTitle}: ${t.student.courses.status.suspended}`}
      >
        {content}
      </article>
    );
  }

  return (
    <Link
      href={`/student/courses/${c.enrollmentId}`}
      className={`${PANEL} group relative flex flex-col gap-5 p-6 transition-transform hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]`}
    >
      {content}
    </Link>
  );
}
