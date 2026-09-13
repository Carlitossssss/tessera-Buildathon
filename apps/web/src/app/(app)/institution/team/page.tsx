import { Eye, GraduationCap, Users } from 'lucide-react';
import { EmptyState, SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { formatNumber, requireSession, safeFetch } from '@/lib/dashboard';
import { TeamClient } from './team-client';

export const dynamic = 'force-dynamic';

function bucket(role: string): 'admin' | 'teacher' | 'reviewer' {
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'owner') return 'admin';
  if (r === 'reviewer') return 'reviewer';
  return 'teacher';
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams?: Promise<{ invitesPage?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { session, token } = await requireSession();
  const invitationsPage = Math.max(1, Number(params.invitesPage ?? 1) || 1);
  const [list, invitationsRes] = await Promise.all([
    safeFetch(() => meApi.team(token)),
    safeFetch(() => meApi.teamInvitations(token, { page: invitationsPage, limit: 15 })),
  ]);
  const members = list?.data ?? [];
  const invitationsPayload = invitationsRes ?? {
    page: invitationsPage,
    limit: 15,
    total: 0,
    totalPages: 1,
    data: [],
  };

  const counts = members.reduce(
    (acc, m) => {
      acc[bucket(m.memberRole)] += 1;
      return acc;
    },
    { admin: 0, teacher: 0, reviewer: 0 } as Record<'admin' | 'teacher' | 'reviewer', number>,
  );

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Equipo"
        description="Personas con acceso al panel de tu institución. Invita docentes para que emitan certificados y badges en tu nombre."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Miembros" value={formatNumber(members.length)} icon={Users} />
        <StatCard label="Docentes" value={formatNumber(counts.teacher)} icon={GraduationCap} />
        <StatCard label="Revisores" value={formatNumber(counts.reviewer)} icon={Eye} />
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin miembros aún"
          description="Invita a tu primer docente para empezar a delegar la emisión de certificados."
        />
      ) : (
        <TeamClient
          initial={members}
          initialInvitations={invitationsPayload.data}
          invitationsPagination={{
            page: invitationsPayload.page,
            limit: invitationsPayload.limit,
            total: invitationsPayload.total,
            totalPages: invitationsPayload.totalPages,
          }}
          currentUserId={session.user?.id ?? ''}
        />
      )}

      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6 text-sm">
        <h3 className="text-base font-semibold text-[var(--color-fg)]">¿Estudiantes y docentes?</h3>
        <p className="mt-2 text-[var(--color-fg-muted)]">
          Una persona puede ser estudiante en su propio espacio (recibe credenciales en su wallet) y
          al mismo tiempo docente en una institución. Cuando inviten a alguien que ya tiene cuenta
          como estudiante, le elevamos el rol a docente automáticamente sin perder sus credenciales
          personales. Los docentes acceden al panel institucional para emitir, mientras que su
          espacio de estudiante (mis credenciales) sigue funcionando con normalidad.
        </p>
        <ul className="mt-4 grid gap-2 text-xs text-[var(--color-fg-subtle)] md:grid-cols-3">
          <li className="rounded-lg border border-[var(--color-border)] bg-white/[0.02] p-3">
            <strong className="text-[var(--color-fg)]">Admin</strong> — gestiona equipo, plan, API
            keys y configuración.
          </li>
          <li className="rounded-lg border border-[var(--color-border)] bg-white/[0.02] p-3">
            <strong className="text-[var(--color-fg)]">Docente</strong> — emite certificados y
            badges, gestiona cursos y estudiantes.
          </li>
          <li className="rounded-lg border border-[var(--color-border)] bg-white/[0.02] p-3">
            <strong className="text-[var(--color-fg)]">Revisor</strong> — solo lectura: ve panel,
            certificados emitidos y analíticas.
          </li>
        </ul>
      </section>
    </div>
  );
}
