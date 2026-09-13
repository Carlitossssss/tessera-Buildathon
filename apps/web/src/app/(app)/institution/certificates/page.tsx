import Link from 'next/link';
import { ArrowUpRight, ExternalLink, FileSignature, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { formatNumber, relativeTime, requireSession, safeFetch } from '@/lib/dashboard';
import { pendingApprovalGate } from '../approval-gate';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }
> = {
  issued: { label: 'Emitido', variant: 'success' },
  queued: { label: 'En cola', variant: 'warning' },
  processing: { label: 'Procesando', variant: 'warning' },
  failed: { label: 'Falló', variant: 'danger' },
  revoked: { label: 'Revocado', variant: 'default' },
};

interface PageProps {
  searchParams: Promise<{ page?: string; status?: string }>;
}

const PAGE_SIZE = 20;
const VALID_STATUSES = ['queued', 'processing', 'issued', 'failed', 'revoked'] as const;

export default async function CertificatesPage({ searchParams }: PageProps) {
  const { token } = await requireSession();
  const approvalGate = await pendingApprovalGate(token);
  if (approvalGate) return approvalGate;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = (VALID_STATUSES as readonly string[]).includes(sp.status ?? '')
    ? (sp.status as (typeof VALID_STATUSES)[number])
    : undefined;

  const [list, stats] = await Promise.all([
    safeFetch(() => meApi.certificates(token, { page, limit: PAGE_SIZE, status })),
    safeFetch(() => meApi.stats(token)),
  ]);

  const total = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Certificados emitidos"
        description="Histórico completo de SBT emitidos por tu institución."
        actions={
          <Button asChild>
            <Link href="/institution/certificates/new" className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Emitir certificado
            </Link>
          </Button>
        }
      />

      {/* KPIs por estado */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Emitidos (total)"
          value={formatNumber(stats?.certificates.issuedTotal ?? 0)}
          hint={`${formatNumber(stats?.certificates.issuedThisMonth ?? 0)} este mes`}
        />
        <StatCard
          label="En cola"
          value={formatNumber(stats?.certificates.queued ?? 0)}
          hint="Pendientes de mint"
        />
        <StatCard
          label="Fallidos"
          value={formatNumber(stats?.certificates.failed ?? 0)}
          hint="Requieren revisión"
        />
        <StatCard
          label="Revocados"
          value={formatNumber(stats?.certificates.revoked ?? 0)}
          hint="No transferibles"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <FilterPill href="/institution/certificates" label="Todos" active={!status} />
        {VALID_STATUSES.map((s) => (
          <FilterPill
            key={s}
            href={`/institution/certificates?status=${s}`}
            label={STATUS_LABEL[s]?.label ?? s}
            active={status === s}
          />
        ))}
      </div>

      {/* Tabla */}
      {list && list.data.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Token</th>
                  <th className="px-4 py-3 font-medium">Estudiante</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Certificado</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Nota</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Hace</th>
                  <th className="px-4 py-3 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
                {list.data.map((c) => {
                  const sb = (STATUS_LABEL[c.status] ?? STATUS_LABEL.queued)!;
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-brand-300)]">
                        {c.tokenId ? `#${c.tokenId}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-fg)]">{c.studentName}</p>
                        <p className="text-xs text-[var(--color-fg-subtle)]">{c.studentEmail}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">{c.achievementName}</td>
                      <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs">
                        {c.grade != null ? `${c.grade}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sb.variant}>{sb.label}</Badge>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">
                        {relativeTime(c.issuedAt ?? c.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {c.transactionUrl && (
                            <Button asChild size="sm" variant="ghost">
                              <a
                                href={c.transactionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Ver en Polygonscan"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/institution/certificates/${c.id}`}>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between text-xs text-[var(--color-fg-subtle)]">
            <span>
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de{' '}
              {formatNumber(total)}
            </span>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="ghost" disabled={page <= 1}>
                <Link
                  href={{
                    pathname: '/institution/certificates',
                    query: { ...(status ? { status } : {}), page: String(page - 1) },
                  }}
                >
                  Anterior
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost" disabled={page >= totalPages}>
                <Link
                  href={{
                    pathname: '/institution/certificates',
                    query: { ...(status ? { status } : {}), page: String(page + 1) },
                  }}
                >
                  Siguiente
                </Link>
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={FileSignature}
          title={
            status
              ? `No hay certificados con estado "${STATUS_LABEL[status]?.label}"`
              : 'Sin certificados aún'
          }
          description={
            status
              ? 'Cambia el filtro o emite un nuevo certificado.'
              : 'Conecta tu LMS por API o emite manualmente.'
          }
          action={
            <Button asChild>
              <Link href="/institution/certificates/new">Emitir certificado</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border px-3 py-1.5 transition-colors ${
        active
          ? 'border-[var(--color-brand-500)]/50 bg-[var(--color-brand-700)]/20 text-[var(--color-brand-200)]'
          : 'border-[var(--color-border)] bg-white/[0.02] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]'
      }`}
    >
      {label}
    </Link>
  );
}
