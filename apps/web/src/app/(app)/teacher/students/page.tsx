import Link from 'next/link';
import { ArrowUpRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard, EmptyState } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch, formatNumber, relativeTime } from '@/lib/dashboard';
import { StudentsFilterBar } from './students-filter-bar';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: Promise<{ courseId?: string; search?: string }>;
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

export default async function TeacherStudentsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const { token } = await requireSession();
  const [studentsRes, coursesRes] = await Promise.all([
    safeFetch(() => meApi.teacherStudents(token, sp)),
    safeFetch(() => meApi.teacherCourses(token)),
  ]);
  const rows = studentsRes?.data ?? [];
  const totals = studentsRes?.totals ?? { enrollments: 0, students: 0 };
  const courses = [...(coursesRes?.data ?? [])].sort((a, b) =>
    a.title.localeCompare(b.title, 'es'),
  );

  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-brand-300)]">
          Tus estudiantes
        </span>
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]">
          Estudiantes
        </h1>
        <p className="max-w-2xl text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
          Inscripciones a través de todos los cursos donde figuras como docente. Filtra por curso o
          busca por nombre/correo.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Inscripciones" value={formatNumber(totals.enrollments)} icon={Users} />
        <StatCard label="Estudiantes únicos" value={formatNumber(totals.students)} />
        <StatCard
          label="Cursos disponibles"
          value={formatNumber(courses.length)}
          hint="puedes filtrar abajo"
        />
      </section>

      <StudentsFilterBar
        courses={courses.map((course) => ({ id: course.id, title: course.title }))}
        search={sp.search ?? ''}
        courseId={sp.courseId ?? ''}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin resultados"
          description="Ajusta los filtros o invita estudiantes desde la página del curso."
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.015]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-5 py-3 font-medium">Estudiante</th>
                  <th className="px-5 py-3 font-medium">Curso</th>
                  <th className="px-5 py-3 text-right font-medium">Nota final</th>
                  <th className="px-5 py-3 text-right font-medium">Pend.</th>
                  <th className="px-5 py-3 font-medium">Inscrito</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="text-[13.5px]">
                {rows.map((r) => (
                  <tr
                    key={r.enrollmentId}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <InitialsChip name={r.name ?? r.email ?? '?'} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--color-fg)]">
                            {r.name ?? r.email ?? 'Estudiante'}
                          </p>
                          {r.email && r.name ? (
                            <p className="truncate text-[12px] text-[var(--color-fg-subtle)]">
                              {r.email}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/teacher/courses/${r.courseId}`}
                        className="text-[var(--color-fg)] hover:text-[var(--color-brand-200)]"
                      >
                        {r.courseTitle}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {r.finalScore != null ? Math.round(r.finalScore) : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {r.pendingGrading > 0 ? (
                        <Badge variant="warning">{r.pendingGrading}</Badge>
                      ) : (
                        <span className="text-[var(--color-fg-subtle)]">0</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[12.5px] text-[var(--color-fg-muted)]">
                      {relativeTime(r.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/teacher/students/${r.enrollmentId}`}>
                          Detalle <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
