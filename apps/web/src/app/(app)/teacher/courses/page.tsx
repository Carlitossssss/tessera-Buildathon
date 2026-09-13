import Link from 'next/link';
import { ArrowUpRight, BookOpen, Users, FileSignature, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard, SectionHeading, EmptyState } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch, formatNumber, relativeTime } from '@/lib/dashboard';
import { RefreshWhileSuspended } from '../../refresh-while-suspended';

export const dynamic = 'force-dynamic';

export default async function TeacherCoursesPage() {
  const { token } = await requireSession();
  const res = await safeFetch(() => meApi.teacherCourses(token));
  const courses = res?.data ?? [];

  const totals = courses.reduce(
    (acc, c) => {
      acc.modules += c.modules;
      acc.enrollments += c.enrollments;
      acc.completed += c.completed;
      acc.pendingGrading += c.pendingGrading;
      return acc;
    },
    { modules: 0, enrollments: 0, completed: 0, pendingGrading: 0 },
  );
  const hasSuspendedCourses = courses.some((course) => course.institutionStatus === 'suspended');

  return (
    <div className="space-y-12">
      <RefreshWhileSuspended active={hasSuspendedCourses} />
      <header className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-brand-300)]">
          Catálogo asignado
        </span>
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]">
          Mis cursos
        </h1>
        <p className="max-w-2xl text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
          Cursos donde figuras como docente. Puedes editar el contenido, gestionar evaluaciones y
          revisar el avance de tus estudiantes.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cursos" value={formatNumber(courses.length)} icon={BookOpen} />
        <StatCard label="Módulos" value={formatNumber(totals.modules)} />
        <StatCard
          label="Inscripciones"
          value={formatNumber(totals.enrollments)}
          icon={Users}
          hint={`${formatNumber(totals.completed)} completadas`}
        />
        <StatCard
          label="Por calificar"
          value={formatNumber(totals.pendingGrading)}
          icon={FileSignature}
        />
      </section>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aún no tienes cursos asignados"
          description="Cuando tu institución te asigne como docente de un curso lo verás aquí."
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.015]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-5 py-3 font-medium">Curso</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Institución</th>
                  <th className="px-5 py-3 text-center font-medium">Módulos</th>
                  <th className="px-5 py-3 text-center font-medium">Estudiantes</th>
                  <th className="px-5 py-3 text-center font-medium">Avance</th>
                  <th className="px-5 py-3 text-center font-medium">Promedio</th>
                  <th className="px-5 py-3 text-center font-medium">Pend.</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="text-[13.5px]">
                {courses.map((c) => {
                  const completionPct =
                    c.enrollments === 0 ? null : Math.round((c.completed / c.enrollments) * 100);
                  const institutionSuspended = c.institutionStatus === 'suspended';
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-[var(--color-border)] last:border-0 ${
                        institutionSuspended
                          ? 'bg-white/[0.015] opacity-85'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          {institutionSuspended ? (
                            <span className="font-medium text-[var(--color-fg)]">{c.title}</span>
                          ) : (
                            <Link
                              href={`/teacher/courses/${c.id}`}
                              className="font-medium text-[var(--color-fg)] hover:text-[var(--color-brand-200)]"
                            >
                              {c.title}
                            </Link>
                          )}
                          <span className="text-[12px] text-[var(--color-fg-subtle)]">
                            actualizado {relativeTime(c.updatedAt)}
                          </span>
                          {institutionSuspended ? (
                            <span className="mt-1 inline-flex max-w-md items-start gap-1.5 text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
                              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-300)]" />
                              <span>Esta institución ha sido suspendida.</span>
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {institutionSuspended ? (
                          <Badge variant="danger">Suspendida</Badge>
                        ) : (
                          <Badge
                            variant={
                              c.status === 'published'
                                ? 'success'
                                : c.status === 'draft'
                                  ? 'warning'
                                  : 'default'
                            }
                          >
                            {c.status === 'published'
                              ? 'Publicado'
                              : c.status === 'draft'
                                ? 'Borrador'
                                : 'Archivado'}
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="block max-w-[180px] truncate text-[13px] text-[var(--color-fg-muted)]">
                          {c.institutionName}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center tabular-nums">{c.modules}</td>
                      <td className="px-5 py-4 text-center tabular-nums">{c.enrollments}</td>
                      <td className="px-5 py-4 text-center tabular-nums">
                        {completionPct == null ? '—' : `${completionPct}%`}
                      </td>
                      <td className="px-5 py-4 text-center tabular-nums">
                        {c.avgScore == null ? '—' : Math.round(c.avgScore)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {c.pendingGrading > 0 ? (
                          <Badge variant="warning">{c.pendingGrading}</Badge>
                        ) : (
                          <span className="text-[var(--color-fg-subtle)]">0</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {institutionSuspended ? (
                          <Button size="sm" variant="ghost" disabled title="Institución suspendida">
                            Bloqueado
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/teacher/courses/${c.id}`}>
                              Abrir <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <SectionHeading
        title="¿Buscas calificar entregas?"
        description="Encuentra todas tus tareas pendientes en un solo lugar."
        actions={
          <Button asChild size="sm">
            <Link href="/teacher/grading">Ir a calificaciones</Link>
          </Button>
        }
      />
    </div>
  );
}
