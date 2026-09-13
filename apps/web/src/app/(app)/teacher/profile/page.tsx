import Link from 'next/link';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  FileSignature,
  GraduationCap,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCircle2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/endpoints/auth';
import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch, formatDate, formatNumber } from '@/lib/dashboard';
import { AccountDeletionAction } from '../../account-deletion-action';
import { UserDetailedProfileForm } from '../../user-detailed-profile-form';

export const dynamic = 'force-dynamic';

const PANEL =
  'rounded-[26px] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.88),rgba(10,13,26,0.96))] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]';
const SUBPANEL = 'rounded-2xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.82)]';

function InitialsChip({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  return (
    <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border)] bg-white/[0.04] text-[18px] font-semibold tracking-wide text-[var(--color-brand-200)]">
      {initials}
    </span>
  );
}

function memberRoleLabel(role: string) {
  if (role === 'reviewer') return 'Revisor';
  if (role === 'admin') return 'Admin';
  return 'Docente';
}

function institutionStatusLabel(status: string) {
  if (status === 'approved') return 'Activa';
  if (status === 'pending') return 'Pendiente';
  if (status === 'suspended') return 'Suspendida';
  if (status === 'revoked') return 'Revocada';
  return status;
}

export default async function TeacherProfilePage() {
  const { token, session } = await requireSession();

  const [dash, coursesRes, institutionsRes, current] = await Promise.all([
    safeFetch(() => meApi.teacherDashboard(token)),
    safeFetch(() => meApi.teacherCourses(token)),
    safeFetch(() => meApi.teacherInstitutions(token)),
    safeFetch(() => authApi.me(token)),
  ]);

  const data = dash?.data;
  const courses = coursesRes?.data ?? [];
  const institutions = institutionsRes?.data ?? [];

  const userName = session.user?.name ?? 'Docente';
  const userEmail = session.user?.email ?? '';
  const profile = current?.user.profile ?? null;

  return (
    <div className="space-y-12">
      {/* Hero */}
      <header className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-brand-300)]">
            <span className="h-1 w-6 rounded-full bg-[var(--color-brand-400)]" />
            Mi perfil
          </span>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-tight text-[var(--color-fg)]">
            {userName}
          </h1>
          <p className="max-w-2xl text-[14.5px] leading-relaxed text-[var(--color-fg-muted)]">
            Resumen de tu cuenta como docente, los cursos a tu cargo y la institución a la que
            perteneces.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button asChild variant="secondary" size="md">
            <Link href="/teacher">
              <ArrowUpRight className="h-4 w-4" />
              Ir al panel
            </Link>
          </Button>
        </div>
      </header>

      {/* Identidad */}
      <section className={`${PANEL} p-6 sm:p-7`}>
        <div className="flex flex-wrap items-center gap-5">
          <InitialsChip name={userName} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-semibold tracking-tight text-[var(--color-fg)]">
                {userName}
              </h2>
              <Badge variant="brand">Docente</Badge>
            </div>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-fg-muted)]">
              <Mail className="h-3.5 w-3.5" /> {userEmail}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">
              <ShieldCheck className="mr-1 h-3 w-3" /> Cuenta verificada
            </Badge>
          </div>
        </div>

        {profile?.status !== 'approved' ? (
          <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-4 text-sm text-[var(--color-fg-muted)]">
            Completa tus datos obligatorios para habilitar tu espacio docente.
          </div>
        ) : null}
      </section>

      <section className={`${PANEL} p-6 sm:p-7`}>
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
          Información personal
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
          Estos datos validan tu perfil docente dentro de Tessera.
        </p>
        <div className="mt-7">
          <UserDetailedProfileForm initialFullName={userName} profile={profile} role="teacher" />
        </div>
      </section>

      <section className="rounded-[26px] border border-red-500/30 bg-red-500/[0.04] p-6 sm:p-7">
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
          Eliminar mi cuenta
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
          Inicia un proceso de eliminación de 30 días. Tu acceso quedará bloqueado y tus datos
          personales se anonimizarán al finalizar el período.
        </p>
        <div className="mt-5">
          <AccountDeletionAction
            accountRole="teacher"
            selectedName={userName}
            selectedDetail={userEmail}
          />
        </div>
      </section>

      {/* Métricas operativas */}
      {data && (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<GraduationCap className="h-4 w-4" />}
            label="Cursos asignados"
            value={formatNumber(data.counts.courses)}
            hint="incluye borradores"
          />
          <MetricCard
            icon={<UserCircle2 className="h-4 w-4" />}
            label="Estudiantes activos"
            value={formatNumber(data.counts.activeStudents)}
            hint={`${formatNumber(data.counts.students)} en total`}
          />
          <MetricCard
            icon={<FileSignature className="h-4 w-4" />}
            label="Por calificar"
            value={formatNumber(data.counts.pendingGrading)}
            hint="entregas tipo ensayo"
          />
          <MetricCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Completados"
            value={formatNumber(data.counts.completedStudents)}
            hint={`Aprob. ${data.avgPassingRate != null ? Math.round(data.avgPassingRate) + '%' : '—'}`}
          />
        </section>
      )}

      {/* Instituciones */}
      {institutions.length > 0 && (
        <section className={`${PANEL} p-6 sm:p-7`}>
          <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
                Instituciones
              </h2>
              <p className="mt-0.5 text-[12.5px] text-[var(--color-fg-muted)]">
                Organizaciones donde formas parte del equipo académico.
              </p>
            </div>
          </header>
          <div className="grid gap-3 lg:grid-cols-2">
            {institutions.map((institution) => (
              <article key={institution.id} className={`${SUBPANEL} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-[var(--color-brand-300)]" />
                      <h3 className="truncate text-[14px] font-semibold text-[var(--color-fg)]">
                        {institution.name}
                      </h3>
                    </div>
                    <p className="mt-1 font-mono text-[11.5px] text-[var(--color-fg-subtle)]">
                      /{institution.slug}
                    </p>
                  </div>
                  <Badge variant={institution.status === 'approved' ? 'success' : 'warning'}>
                    {institutionStatusLabel(institution.status)}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                      Rol
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--color-fg)]">
                      {memberRoleLabel(institution.memberRole)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                      Cursos
                    </p>
                    <p className="mt-1 font-mono text-[13px] tabular-nums text-[var(--color-fg)]">
                      {formatNumber(institution.courseCount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                      País
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--color-fg)]">
                      {institution.country ?? '—'}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Cursos asignados */}
      <section className={`${PANEL} overflow-hidden`}>
        <header className="flex items-baseline justify-between gap-3 px-6 py-5">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
              Cursos a mi cargo
            </h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--color-fg-muted)]">
              Lectura. La asignación a cursos la realiza tu administración.
            </p>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href="/teacher/courses">
              Ver mis cursos
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </header>
        {courses.length === 0 ? (
          <div className="border-t border-[var(--color-border)] p-8 text-center">
            <Sparkles className="mx-auto h-7 w-7 text-[var(--color-fg-subtle)]" />
            <p className="mt-3 text-[13.5px] text-[var(--color-fg-muted)]">
              Aún no tienes cursos asignados. Solicita a tu administración que te asigne al menos
              uno.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]/60 border-t border-[var(--color-border)]">
            {courses.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-4 px-6 py-3.5 transition-colors hover:bg-white/[0.02]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[14px] font-medium text-[var(--color-fg)]">
                      {c.title}
                    </p>
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
                    {c.pendingGrading > 0 && (
                      <Badge variant="warning">{c.pendingGrading} por calificar</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11.5px] text-[var(--color-fg-subtle)]">
                    {c.institutionName} · /{c.slug} · creado {formatDate(c.createdAt)}
                  </p>
                </div>
                <span className="font-mono text-[11.5px] tabular-nums text-[var(--color-fg-muted)]">
                  {c.modules} módulos · {c.enrollments} inscritos
                </span>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/teacher/courses/${c.id}`}>
                    Abrir
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Permisos del rol */}
      <section className={`${PANEL} p-6 sm:p-7`}>
        <header className="mb-5">
          <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
            Qué puedes hacer como docente
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-fg-muted)]">
            Tu rol está enfocado en enseñanza, contenido y evaluación. Las acciones administrativas
            las gestiona tu institución.
          </p>
        </header>
        <div className="grid gap-3 md:grid-cols-2">
          <PermissionGroup
            title="Sí puedes"
            tone="success"
            items={[
              'Ver el detalle de los cursos a tu cargo',
              'Crear, editar y eliminar lecturas (topics) de cada módulo',
              'Crear y editar quizzes (selección múltiple, V/F y ensayo)',
              'Crear y eliminar preguntas dentro de un quiz',
              'Calificar entregas tipo ensayo y dar retroalimentación',
              'Marcar manualmente el progreso de un estudiante en un módulo',
              'Ver la lista de estudiantes inscritos y su avance',
            ]}
          />
          <PermissionGroup
            title="No puedes (lo hace la administración)"
            tone="muted"
            items={[
              'Crear, archivar o eliminar cursos',
              'Cambiar visibilidad, código de acceso o precio',
              'Crear, editar o reordenar módulos',
              'Asignar o revocar docentes a un curso',
              'Inscribir o dar de baja estudiantes',
              'Emitir, revocar o reemitir certificados',
              'Gestionar API keys, webhooks y plantillas',
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={`${SUBPANEL} flex flex-col gap-2 p-5`}>
      <span className="inline-flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
        <span className="text-[var(--color-brand-300)]">{icon}</span>
        {label}
      </span>
      <span className="font-mono text-[28px] leading-none tabular-nums text-[var(--color-fg)]">
        {value}
      </span>
      {hint && <span className="text-[11.5px] text-[var(--color-fg-muted)]">{hint}</span>}
    </div>
  );
}

function PermissionGroup({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'success' | 'muted';
  items: string[];
}) {
  const dotClass = tone === 'success' ? 'bg-emerald-400' : 'bg-[var(--color-fg-subtle)]';
  const titleClass = tone === 'success' ? 'text-emerald-300' : 'text-[var(--color-fg-muted)]';
  return (
    <div className={`${SUBPANEL} p-5`}>
      <h3 className={`text-[12px] font-semibold uppercase tracking-[0.16em] ${titleClass}`}>
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-[13px] text-[var(--color-fg-muted)]"
          >
            <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
