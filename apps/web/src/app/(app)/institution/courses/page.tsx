import { BookOpen, GraduationCap, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { EmptyState, SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { formatDate, formatNumber, requireSession, safeFetch } from '@/lib/dashboard';
import { pendingApprovalGate } from '../approval-gate';
import { CreateCourseDialog } from './create-course-dialog';
import { MembershipSettings } from './membership-settings';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, { label: string; variant: 'success' | 'warning' | 'default' }> =
  {
    published: { label: 'Activo', variant: 'success' },
    draft: { label: 'Borrador', variant: 'warning' },
    archived: { label: 'Archivado', variant: 'default' },
  };

const VISIBILITY_LABEL: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'default' | 'brand' | 'accent' }
> = {
  public_free: { label: 'Pública · gratis', variant: 'success' },
  public_paid: { label: 'Pública · pago', variant: 'brand' },
  private_code: { label: 'Por código', variant: 'default' },
  hybrid: { label: 'Híbrida', variant: 'accent' },
  token_gated: { label: 'Membresía · Unlock', variant: 'brand' },
};

function priceLabel(cents: number, currency: string) {
  if (!cents) return 'Gratis';
  const amount = (cents / 100).toLocaleString('es-PE', { maximumFractionDigits: 2 });
  return `${currency} ${amount}`;
}

export default async function CoursesPage() {
  const { token } = await requireSession();
  const approvalGate = await pendingApprovalGate(token);
  if (approvalGate) return approvalGate;
  const [list, me] = await Promise.all([
    safeFetch(() => meApi.courses(token)),
    safeFetch(() => meApi.institution(token)),
  ]);
  const courses = list?.data ?? [];

  // El Lock de la institucion se propone al crear un curso con membresia, para
  // no tener que pegar la direccion cada vez.
  const defaultLock = {
    address: me?.institution.defaultLockAddress ?? null,
    chainId: me?.institution.defaultLockChainId ?? null,
  };

  const total = courses.length;
  const published = courses.filter((c) => c.status === 'published').length;
  const drafts = courses.filter((c) => c.status === 'draft').length;
  const totalEnrollments = courses.reduce((acc, c) => acc + (c.enrollments ?? 0), 0);
  const autoIssue = courses.filter((c) => c.autoIssueEnabled).length;

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Cursos"
        description="Define cursos con criterio de aprobación. Cuando un estudiante completa, el certificado se emite automáticamente."
        actions={<CreateCourseDialog defaultLock={defaultLock} />}
      />

      {/* El Lock vive junto a los cursos porque es lo que cobra la entrada:
          configurarlo en otra seccion obligaba a saltar entre pantallas. */}
      <MembershipSettings
        initialLockAddress={defaultLock.address}
        initialLockChainId={defaultLock.chainId}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total cursos" value={formatNumber(total)} icon={BookOpen} />
        <StatCard
          label="Publicados"
          value={formatNumber(published)}
          icon={Sparkles}
          hint={`${drafts} en borrador`}
        />
        <StatCard
          label="Inscripciones"
          value={formatNumber(totalEnrollments)}
          icon={GraduationCap}
          hint="Suma de todos los cursos"
        />
        <StatCard
          label="Auto-emisión"
          value={formatNumber(autoIssue)}
          icon={Zap}
          hint={`${total - autoIssue} con emisión manual`}
        />
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aún no tienes cursos"
          description="Crea tu primer curso para empezar a emitir certificados automáticamente al completar."
          action={<CreateCourseDialog cta="Crear primer curso" defaultLock={defaultLock} />}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Curso</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium hidden sm:table-cell">Visibilidad</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">Inscritos</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">Auto-emisión</th>
                  <th className="px-5 py-3 font-medium">Precio</th>
                  <th className="px-5 py-3 font-medium hidden xl:table-cell">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
                {courses.map((c) => {
                  const sb = STATUS_LABEL[c.status] ?? STATUS_LABEL.draft!;
                  const vb = VISIBILITY_LABEL[c.visibility] ?? VISIBILITY_LABEL.private_code!;
                  return (
                    <tr
                      key={c.id}
                      className="group cursor-pointer transition-colors hover:bg-white/[0.04]"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/institution/courses/${c.id}`}
                          className="block focus:outline-none"
                        >
                          <p className="font-medium text-[var(--color-fg)] group-hover:text-[var(--color-brand-200)]">
                            {c.title}
                          </p>
                          <p className="text-xs text-[var(--color-fg-subtle)]">
                            /{c.slug} · Nota mínima {c.passingScore}%
                            {c.durationHours ? ` · ${c.durationHours} h` : ''}
                          </p>
                          <p className="mt-1 flex flex-wrap gap-1 sm:hidden">
                            <Badge variant={vb.variant}>{vb.label}</Badge>
                          </p>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link href={`/institution/courses/${c.id}`} className="block">
                          <Badge variant={sb.variant}>{sb.label}</Badge>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <Link href={`/institution/courses/${c.id}`} className="block">
                          <Badge variant={vb.variant}>{vb.label}</Badge>
                          {c.accessCode && (
                            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                              {c.accessCode}
                            </p>
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <Link href={`/institution/courses/${c.id}`} className="block">
                          <span className="font-mono text-[var(--color-fg)]">
                            {formatNumber(c.enrollments)}
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <Link href={`/institution/courses/${c.id}`} className="block">
                          <Badge variant={c.autoIssueEnabled ? 'success' : 'default'}>
                            {c.autoIssueEnabled ? 'Sí' : 'No'}
                          </Badge>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[var(--color-brand-300)]">
                        <Link href={`/institution/courses/${c.id}`} className="block">
                          {priceLabel(c.priceCents, c.currency)}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 hidden xl:table-cell text-xs">
                        <Link href={`/institution/courses/${c.id}`} className="block">
                          {formatDate(c.createdAt)}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
