import Link from 'next/link';
import { ArrowUpRight, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard, SectionHeading, EmptyState } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch, formatNumber, relativeTime } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: Promise<{ status?: string; courseId?: string }>;
}

function InitialsChip({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white/[0.04] text-[12px] font-semibold tracking-wide text-[var(--color-brand-200)]">
      {initials || '?'}
    </span>
  );
}

export default async function TeacherGradingPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const status: 'submitted' | 'graded' | 'all' =
    sp.status === 'graded' ? 'graded' : sp.status === 'all' ? 'all' : 'submitted';
  const courseId = sp.courseId;
  const { token } = await requireSession();
  const res = await safeFetch(() => meApi.teacherGradingQueue(token, { status, courseId }));
  const items = res?.data ?? [];
  const totals = res?.totals ?? { pending: 0, graded: 0 };

  const tabs: Array<{ id: 'submitted' | 'graded' | 'all'; label: string; count: number | null }> = [
    { id: 'submitted', label: 'Pendientes', count: totals.pending },
    { id: 'graded', label: 'Calificados', count: totals.graded },
    { id: 'all', label: 'Todo', count: null },
  ];

  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-brand-300)]">
          Cola de calificación
        </span>
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]">
          Calificaciones
        </h1>
        <p className="max-w-2xl text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
          Entregas tipo ensayo enviadas por tus estudiantes. Las preguntas de opción múltiple,
          verdadero/falso y respuesta corta se califican automáticamente.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pendientes" value={formatNumber(totals.pending)} icon={FileSignature} />
        <StatCard label="Calificadas" value={formatNumber(totals.graded)} />
        <StatCard
          label="Filtrando por"
          value={courseId ? '1 curso' : 'Todos'}
          hint={courseId ? courseId.slice(0, 8) + '…' : 'Sin filtro'}
        />
      </section>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-3">
        {tabs.map((t) => {
          const params = new URLSearchParams();
          params.set('status', t.id);
          if (courseId) params.set('courseId', courseId);
          const active = t.id === status;
          return (
            <Link
              key={t.id}
              href={`/teacher/grading?${params.toString()}`}
              className={
                'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[12.5px] font-medium transition-colors ' +
                (active
                  ? 'border-[var(--color-brand-400)]/60 bg-[var(--color-brand-500)]/15 text-[var(--color-brand-200)]'
                  : 'border-[var(--color-border)] bg-white/[0.02] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]')
              }
            >
              {t.label}
              {t.count != null ? (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] tabular-nums">
                  {t.count}
                </span>
              ) : null}
            </Link>
          );
        })}
        {courseId ? (
          <Link
            href="/teacher/grading"
            className="ml-auto text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
          >
            Limpiar filtro de curso
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title={
            status === 'submitted'
              ? 'Sin entregas pendientes'
              : status === 'graded'
                ? 'Sin entregas calificadas todavía'
                : 'Sin actividad'
          }
          description="Cuando tus estudiantes envíen ensayos aparecerán aquí listos para calificar."
        />
      ) : (
        <ol className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.015]">
          {items.map((it) => (
            <li
              key={it.attemptId}
              className="grid gap-3 px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
              <InitialsChip name={it.student.name ?? it.student.email ?? '?'} />
              <div className="min-w-0 space-y-1">
                <p className="truncate text-[14px] font-medium text-[var(--color-fg)]">
                  {it.student.name ?? it.student.email ?? 'Estudiante'}
                </p>
                <p className="truncate text-[12.5px] text-[var(--color-fg-muted)]">
                  {it.assessment?.title ?? 'Evaluación'} · {it.course?.title ?? 'Curso'} · intento #
                  {it.attemptNumber}
                </p>
                <p className="text-[11.5px] text-[var(--color-fg-subtle)]">
                  {it.status === 'submitted'
                    ? `enviado ${relativeTime(it.submittedAt)}`
                    : `calificado ${relativeTime(it.gradedAt)}`}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                {it.status === 'graded' && it.score != null ? (
                  <Badge variant="success">
                    {it.score} / {it.assessment?.maxScore ?? 100}
                  </Badge>
                ) : (
                  <Badge variant="warning">Pendiente</Badge>
                )}
                <Button
                  asChild
                  size="sm"
                  variant={it.status === 'submitted' ? 'primary' : 'secondary'}
                >
                  <Link href={`/teacher/grading/${it.attemptId}`}>
                    {it.status === 'submitted' ? 'Calificar' : 'Ver'}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <SectionHeading
        title="Atajos"
        description="Filtra por curso desde la página del curso para enfocarte."
      />
    </div>
  );
}
