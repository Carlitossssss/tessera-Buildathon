import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  GraduationCap,
  Layers,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard, SectionHeading, EmptyState } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch, formatNumber, relativeTime } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

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

export default async function TeacherDashboardPage() {
  const { token, session } = await requireSession();
  const dash = await safeFetch(() => meApi.teacherDashboard(token));

  if (!dash) {
    return (
      <div className="space-y-12">
        <header className="flex flex-col gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            Bienvenido
          </span>
          <h1 className="text-[34px] font-semibold tracking-tight text-[var(--color-fg)]">
            {session.user?.name ?? 'Docente'}
          </h1>
        </header>
        <EmptyState
          icon={GraduationCap}
          title="No pudimos cargar tu panel"
          description="Reintenta en unos segundos. Si el problema persiste avisa a tu administrador."
        />
      </div>
    );
  }

  const data = dash.data;
  const c = data.counts;

  return (
    <div className="space-y-16">
      {/* Hero asimétrico */}
      <header className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-end">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-brand-300)]">
            <span className="h-1 w-6 rounded-full bg-[var(--color-brand-400)]" />
            Espacio del docente
          </span>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-tight text-[var(--color-fg)]">
            Hola, {session.user?.name?.split(' ')[0] ?? 'profe'}
          </h1>
          <p className="max-w-2xl text-[14.5px] leading-relaxed text-[var(--color-fg-muted)]">
            Aquí tienes el resumen vivo de tus cursos, las entregas que esperan tu calificación y
            cómo avanzan tus estudiantes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button asChild size="md">
            <Link href="/teacher/grading">
              Pendientes ({formatNumber(c.pendingGrading)})
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="md" variant="secondary">
            <Link href="/teacher/courses">Mis cursos</Link>
          </Button>
        </div>
      </header>

      {/* Stats principales: tarjetas de tamaños variados */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Cursos asignados"
          value={formatNumber(c.courses)}
          icon={BookOpen}
          hint="incluye borradores"
        />
        <StatCard
          label="Estudiantes activos"
          value={formatNumber(c.activeStudents)}
          icon={Users}
          hint={`${formatNumber(c.students)} en total`}
        />
        <StatCard
          label="Para calificar"
          value={formatNumber(c.pendingGrading)}
          icon={FileSignature}
          hint="entregas tipo ensayo"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Módulos" value={formatNumber(c.modules)} icon={Layers} />
        <StatCard label="Evaluaciones" value={formatNumber(c.assessments)} icon={ClipboardList} />
        <StatCard
          label="Promedio final"
          value={
            data.avgFinalScore != null ? `${formatNumber(Math.round(data.avgFinalScore))}` : '—'
          }
          icon={TrendingUp}
          hint="último puntaje por estudiante"
        />
        <StatCard
          label="Tasa de aprobación"
          value={data.avgPassingRate != null ? `${Math.round(data.avgPassingRate * 100)}%` : '—'}
          icon={CheckCircle2}
          hint={`${formatNumber(c.completedStudents)} completados`}
        />
      </section>

      {/* Actividad reciente */}
      <section>
        <SectionHeading
          title="Actividad reciente"
          description="Últimos intentos enviados o calificados en tus cursos"
          actions={
            <Button asChild size="sm" variant="ghost">
              <Link href="/teacher/grading">Cola completa</Link>
            </Button>
          }
        />
        {data.recentActivity.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            title="Sin actividad reciente"
            description="Cuando tus estudiantes envíen evaluaciones aparecerán aquí."
          />
        ) : (
          <ol className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.015]">
            {data.recentActivity.map((a) => (
              <li
                key={a.attemptId}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
              >
                <InitialsChip name={a.studentName ?? a.studentEmail ?? '?'} />
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-[14px] font-medium text-[var(--color-fg)]">
                    {a.studentName ?? a.studentEmail ?? 'Estudiante'}
                  </p>
                  <p className="truncate text-[12.5px] text-[var(--color-fg-muted)]">
                    {a.assessmentTitle} · {a.courseTitle}
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  <Badge
                    variant={
                      a.status === 'graded'
                        ? 'success'
                        : a.status === 'submitted'
                          ? 'warning'
                          : 'default'
                    }
                  >
                    {a.status === 'graded'
                      ? a.score != null
                        ? `${a.score} pts`
                        : 'Calificado'
                      : a.status === 'submitted'
                        ? 'Pendiente'
                        : a.status}
                  </Badge>
                  <span className="text-[12px] text-[var(--color-fg-subtle)]">
                    {relativeTime(a.submittedAt)}
                  </span>
                  {a.status === 'submitted' ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/teacher/grading/${a.attemptId}`}>Calificar</Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/teacher/grading/${a.attemptId}`}>Ver</Link>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
