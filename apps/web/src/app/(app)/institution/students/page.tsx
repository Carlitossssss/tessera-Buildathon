import Link from 'next/link';
import { ArrowLeft, ArrowRight, Award, Mail, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { formatNumber, relativeTime, requireSession, safeFetch, shortAddr } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function StudentsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const { token } = await requireSession();
  const result = await safeFetch(() => meApi.students(token, { page, limit: PAGE_SIZE }));

  const data = result?.data ?? [];
  const total = result?.total ?? 0;
  const issued = data.reduce((acc, s) => acc + s.totalIssued, 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Estudiantes"
        description="Estudiantes registrados o inscritos en cursos de tu institución."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total estudiantes" value={formatNumber(total)} icon={Users} />
        <StatCard
          label="Inscripciones en página"
          value={formatNumber(data.reduce((acc, s) => acc + s.enrollments, 0))}
          icon={Award}
        />
        <StatCard
          label="Certificados emitidos en página"
          value={formatNumber(issued)}
          icon={Mail}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin estudiantes todavía"
          description="Cuando inscribas estudiantes o se registren en cursos de tu institución, aparecerán aquí."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Estudiante</th>
                  <th className="px-5 py-3 font-medium">Wallet</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">Inscripciones</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">Certificados</th>
                  <th className="px-5 py-3 font-medium">Último</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
                {data.map((s) => (
                  <tr key={s.email} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-[var(--color-fg)]">{s.name || '—'}</p>
                      <p className="text-xs text-[var(--color-fg-subtle)]">{s.email}</p>
                      {s.courses.length > 0 ? (
                        <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
                          {s.courses.map((course) => course.title).join(' · ')}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5">
                      {s.wallet ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white/[0.02] px-2 py-1 font-mono text-xs">
                          <Wallet className="h-3 w-3 text-[var(--color-brand-300)]" />
                          {shortAddr(s.wallet)}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-fg-subtle)]">Sin wallet</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell font-mono text-[var(--color-fg)]">
                      {formatNumber(s.enrollments)}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell font-mono text-[var(--color-fg-muted)]">
                      {formatNumber(s.totalAll)}
                    </td>
                    <td className="px-5 py-3.5 text-xs">{relativeTime(s.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--color-fg-subtle)]">
            <span>
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de{' '}
              {formatNumber(total)}
            </span>
            <div className="flex gap-2">
              <Link href={`/institution/students?page=${Math.max(1, page - 1)}`}>
                <Button variant="ghost" size="sm" disabled={page <= 1}>
                  <ArrowLeft className="h-3.5 w-3.5" /> Anterior
                </Button>
              </Link>
              <Link href={`/institution/students?page=${Math.min(totalPages, page + 1)}`}>
                <Button variant="ghost" size="sm" disabled={page >= totalPages}>
                  Siguiente <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
