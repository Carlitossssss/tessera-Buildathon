import Link from 'next/link';
import { BarChart3, BookOpen, FileSignature, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { formatNumber, requireSession, safeFetch } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

function formatMoney(cents: number, currency: string) {
  const value = cents / 100;
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}

function deltaLabel(pct: number): { delta: string; positive: boolean } {
  const sign = pct > 0 ? '+' : '';
  return { delta: `${sign}${pct}%`, positive: pct >= 0 };
}

export default async function AnalyticsPage() {
  const { token } = await requireSession();
  const data = await safeFetch(() => meApi.analyticsOverview(token));

  if (!data) {
    return (
      <div className="space-y-8">
        <EmptyState
          icon={BarChart3}
          title="Analytics no disponible"
          description="No pudimos cargar las métricas. Verifica que la API esté disponible y que tu sesión siga activa."
        />
      </div>
    );
  }

  const { kpis, courses, series } = data;
  const issuedDelta = deltaLabel(kpis.issuedMonthDeltaPct);
  const studentsDelta = deltaLabel(kpis.activeStudentsDeltaPct);
  const maxIssued = Math.max(1, ...series.map((s) => s.issued));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Certificados emitidos"
          value={formatNumber(kpis.issuedThisMonth)}
          icon={FileSignature}
          trend={issuedDelta}
          hint="este mes vs anterior"
        />
        <StatCard
          label="Estudiantes activos"
          value={formatNumber(kpis.activeStudents30d)}
          icon={Users}
          trend={studentsDelta}
          hint="únicos últimos 30 días"
        />
        <StatCard
          label="Cursos activos"
          value={formatNumber(kpis.activeCourses)}
          icon={BookOpen}
          hint={`de ${formatNumber(kpis.totalCourses)} totales`}
        />
        <StatCard
          label="Tasa de completación"
          value={`${kpis.completionRate}%`}
          icon={kpis.completionRate >= 50 ? TrendingUp : TrendingDown}
          hint="promedio entre todos los cursos"
        />
      </div>

      <section>
        <SectionHeading
          title="Emisión diaria"
          description="Certificados emitidos día a día en los últimos 30 días."
        />
        <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
          {series.every((s) => s.issued === 0) ? (
            <p className="py-8 text-center text-sm text-[var(--color-fg-muted)]">
              Aún no hay certificados emitidos en este periodo.
            </p>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {series.map((s) => {
                const h = Math.round((s.issued / maxIssued) * 100);
                return (
                  <div
                    key={s.day}
                    className="group relative flex-1"
                    title={`${s.day}: ${s.issued}`}
                  >
                    <div
                      className="rounded-sm bg-[var(--color-brand-400)]/30 transition-colors group-hover:bg-[var(--color-brand-300)]"
                      style={{ height: `${Math.max(h, s.issued > 0 ? 4 : 1)}%` }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Rendimiento por curso"
          description="Inscriptos, completaciones e ingresos calculados sobre datos reales."
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link href="/institution/revenue">Ver ingresos</Link>
            </Button>
          }
        />
        {courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Aún no hay cursos"
            description="Crea tu primer curso para empezar a ver métricas reales de inscritos y completaciones."
            action={
              <Button asChild>
                <Link href="/institution/courses">Crear curso</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Curso</th>
                  <th className="px-4 py-3 font-medium text-center">Inscriptos</th>
                  <th className="px-4 py-3 font-medium text-center">Completaron</th>
                  <th className="px-4 py-3 font-medium text-center hidden sm:table-cell">Tasa</th>
                  <th className="px-4 py-3 font-medium text-center hidden md:table-cell">
                    Ingresos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
                {courses.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-[var(--color-fg)]">{c.title}</td>
                    <td className="px-4 py-3 text-center">{formatNumber(c.enrollments)}</td>
                    <td className="px-4 py-3 text-center">{formatNumber(c.completions)}</td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="font-medium text-[var(--color-fg)]">
                        {c.completionRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell font-mono text-emerald-400">
                      {c.revenueCents > 0 ? formatMoney(c.revenueCents, c.currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
