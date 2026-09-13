import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch, formatDateTime, relativeTime } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ enrollmentId: string }>;
}

export default async function TeacherStudentDetailPage({ params }: PageProps) {
  const { enrollmentId } = await params;
  const { token } = await requireSession();
  const res = await safeFetch(() => meApi.teacherStudentDetail(token, enrollmentId));
  if (!res) notFound();
  const d = res.data;

  const completedModules = d.modules.filter((m) => m.progress?.status === 'completed').length;

  return (
    <div className="space-y-12">
      <div>
        <Link
          href="/teacher/students"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a estudiantes
        </Link>
      </div>

      <header className="space-y-6">
        <div className="space-y-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-brand-300)]">
            Estudiante
          </span>
          <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]">
            {d.enrollment.name ?? d.enrollment.email ?? 'Estudiante'}
          </h1>
          <p className="text-[13.5px] text-[var(--color-fg-muted)]">
            {d.enrollment.email ?? '—'} · inscrito en{' '}
            <Link
              href={`/teacher/courses/${d.course.id}`}
              className="text-[var(--color-brand-200)] hover:underline"
            >
              {d.course.title}
            </Link>
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <StatCard
            label="Nota final"
            value={d.enrollment.finalScore != null ? `${Math.round(d.enrollment.finalScore)}` : '—'}
            hint={`aprueba con ${d.course.passingScore}`}
            className="min-h-[132px] p-6"
          />
          <StatCard
            label="Módulos"
            value={`${completedModules}/${d.modules.length}`}
            icon={BookOpen}
            className="min-h-[132px] p-6"
          />
          <StatCard
            label="Inscrito"
            value={relativeTime(d.enrollment.createdAt)}
            hint={d.enrollment.startedAt ? 'inició curso' : 'sin iniciar'}
            className="min-h-[132px] p-6"
          />
        </div>
      </header>

      <section className="space-y-6">
        <h2 className="text-[20px] font-semibold tracking-tight text-[var(--color-fg)]">
          Progreso por módulo
        </h2>
        {d.modules.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white/[0.015] px-5 py-10 text-center text-[13.5px] text-[var(--color-fg-muted)]">
            Este curso aún no tiene módulos.
          </p>
        ) : (
          <ol className="space-y-5">
            {d.modules.map((m, idx) => {
              const status = m.progress?.status ?? 'not_started';
              return (
                <li
                  key={m.id}
                  className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.015] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                        Módulo {idx + 1} · peso {m.weight}
                        {m.isRequired ? ' · obligatorio' : ''}
                      </p>
                      <h3 className="mt-1 text-[16px] font-semibold tracking-tight text-[var(--color-fg)]">
                        {m.title}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          status === 'completed'
                            ? 'success'
                            : status === 'in_progress'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {status === 'completed'
                          ? 'Completado'
                          : status === 'in_progress'
                            ? 'En curso'
                            : 'No iniciado'}
                      </Badge>
                      {m.progress?.score != null ? (
                        <Badge variant="brand">{Math.round(m.progress.score)}</Badge>
                      ) : null}
                      {m.progress?.completedAt ? (
                        <span className="text-[11.5px] text-[var(--color-fg-subtle)]">
                          {relativeTime(m.progress.completedAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-4">
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                      Avance en modo lectura
                    </p>
                    <p className="mt-2 text-[12.5px] text-[var(--color-fg-muted)]">
                      Sólo la institución puede editar notas o cerrar módulos. Los docentes pueden
                      revisar el progreso y las entregas sin modificar calificaciones.
                    </p>
                  </div>

                  {m.assessments.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                        Evaluaciones
                      </p>
                      <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white/[0.02]">
                        {m.assessments.map((a) => {
                          const last = a.attempts[a.attempts.length - 1];
                          return (
                            <li
                              key={a.id}
                              className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[13.5px] font-medium text-[var(--color-fg)]">
                                  {a.title}
                                </p>
                                <p className="text-[11.5px] text-[var(--color-fg-subtle)]">
                                  {a.type} · máx. {a.maxScore} · aprobación {a.passingScore} ·{' '}
                                  {a.attempts.length} intento{a.attempts.length === 1 ? '' : 's'}
                                </p>
                              </div>
                              {last ? (
                                <Badge
                                  variant={
                                    last.status === 'graded'
                                      ? last.score != null && last.score >= a.passingScore
                                        ? 'success'
                                        : 'warning'
                                      : last.status === 'submitted'
                                        ? 'warning'
                                        : 'default'
                                  }
                                >
                                  {last.status === 'graded' && last.score != null
                                    ? `${last.score}/${a.maxScore}`
                                    : last.status}
                                </Badge>
                              ) : (
                                <Badge>Sin intento</Badge>
                              )}
                              {last ? (
                                <Button asChild size="sm" variant="ghost">
                                  <Link href={`/teacher/grading/${last.id}`}>Ver intento</Link>
                                </Button>
                              ) : (
                                <span className="text-[11.5px] text-[var(--color-fg-subtle)]">
                                  —
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {m.progress?.startedAt ? (
                    <p className="text-[11.5px] text-[var(--color-fg-subtle)]">
                      Iniciado el {formatDateTime(m.progress.startedAt)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
