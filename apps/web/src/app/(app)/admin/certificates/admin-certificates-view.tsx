'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from '@/components/dashboard/stat-card';
import { formatDate, formatNumber } from '@/lib/format';
import { OperationalCard } from '../operational-card';
import type { adminApi } from '@/lib/api/endpoints/admin';

type CertificatesPayload = Awaited<ReturnType<typeof adminApi.certificates>>;
type CertVariant = 'success' | 'danger' | 'warning' | 'default';

const POLYGONSCAN_TX = 'https://polygonscan.com/tx/';

function pageHref(nextPage: number) {
  return nextPage > 1 ? `/admin/certificates?page=${nextPage}` : '/admin/certificates';
}

export function AdminCertificatesView({ payload }: { payload: CertificatesPayload }) {
  const t = useT();
  const copy = t.admin.certificates;
  const statusBadge: Record<string, { label: string; variant: CertVariant }> = {
    issued: { label: copy.status.issued, variant: 'success' },
    revoked: { label: copy.status.revoked, variant: 'danger' },
    queued: { label: copy.status.queued, variant: 'default' },
    processing: { label: copy.status.processing, variant: 'warning' },
    failed: { label: copy.status.failed, variant: 'danger' },
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <OperationalCard
          href="/admin/certificates"
          value={payload.totals.total}
          badge={copy.cards.total.badge}
          title={copy.cards.total.title}
          description={copy.cards.total.description}
        />
        <OperationalCard
          href="/admin/certificates"
          value={payload.totals.revoked}
          badge={copy.cards.revoked.badge}
          title={copy.cards.revoked.title}
          description={copy.cards.revoked.description}
        />
        <OperationalCard
          href="/admin/certificates"
          value={payload.totals.issuedToday}
          badge={copy.cards.today.badge}
          title={copy.cards.today.title}
          description={copy.cards.today.description}
        />
      </div>

      <section>
        <SectionHeading title={copy.activity.title} description={copy.activity.description} />
        <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
          <StatusChart rows={payload.summary.byStatus} statusBadge={statusBadge} byStatusLabel={copy.byStatus} />
          <InstitutionChart
            rows={payload.summary.byInstitution}
            byInstitutionLabel={copy.byInstitution}
            emptyLabel={copy.list.empty}
          />
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading
            title={copy.list.title}
            description={copy.list.description
              .replace('{shown}', formatNumber(payload.data.length))
              .replace('{total}', formatNumber(payload.pagination.totalItems))}
          />
          <p className="text-xs text-[var(--color-fg-subtle)]">
            {copy.list.page
              .replace('{page}', formatNumber(payload.pagination.page))
              .replace('{totalPages}', formatNumber(payload.pagination.totalPages))}
          </p>
        </div>
        <div className="grid gap-3">
          {payload.data.map((c) => {
            const sb = (statusBadge[c.status] ?? statusBadge.queued) as {
              label: string;
              variant: CertVariant;
            };
            return (
              <article
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-fg)]">{c.achievementName}</p>
                  <p className="text-xs text-[var(--color-fg-muted)]">
                    {c.studentName} · {c.institutionName ?? copy.list.noInstitution} ·{' '}
                    {formatDate(c.issuedAt ?? c.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={sb.variant}>{sb.label}</Badge>
                  {c.txHash && (
                    <Button size="sm" variant="ghost" asChild>
                      <a
                        href={`${POLYGONSCAN_TX}${c.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={copy.list.viewTx}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
          {payload.data.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] px-5 py-6 text-sm text-[var(--color-fg-subtle)]">
              {copy.list.empty}
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-fg-muted)]">
          <span>
            {copy.list.recordsPerPage
              .replace('{total}', formatNumber(payload.pagination.totalItems))
              .replace('{limit}', formatNumber(payload.pagination.limit))}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!payload.pagination.hasPreviousPage}
              asChild={payload.pagination.hasPreviousPage}
            >
              {payload.pagination.hasPreviousPage ? (
                <Link href={pageHref(payload.pagination.page - 1)}>{copy.list.previous}</Link>
              ) : (
                <span>{copy.list.previous}</span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!payload.pagination.hasNextPage}
              asChild={payload.pagination.hasNextPage}
            >
              {payload.pagination.hasNextPage ? (
                <Link href={pageHref(payload.pagination.page + 1)}>{copy.list.next}</Link>
              ) : (
                <span>{copy.list.next}</span>
              )}
            </Button>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-[var(--color-danger-500)]/20 bg-[var(--color-danger-500)]/5 px-5 py-4 text-sm text-[var(--color-fg-muted)]">
        {copy.revocationNotice}
      </div>
    </div>
  );
}

function StatusChart({
  rows,
  statusBadge,
  byStatusLabel,
}: {
  rows: CertificatesPayload['summary']['byStatus'];
  statusBadge: Record<string, { label: string; variant: CertVariant }>;
  byStatusLabel: string;
}) {
  const total = Math.max(
    1,
    rows.reduce((sum, row) => sum + row.count, 0),
  );
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row.count;
    return acc;
  }, {});
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-fg)]">{byStatusLabel}</h3>
      <div className="mt-4 space-y-3">
        {Object.entries(statusBadge).map(([status, meta]) => {
          const value = counts[status] ?? 0;
          return (
            <div key={status}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--color-fg-muted)]">{meta.label}</span>
                <span className="font-mono text-[var(--color-fg)]">{value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-[var(--color-brand-500)]"
                  style={{ width: `${Math.round((value / total) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InstitutionChart({
  rows,
  byInstitutionLabel,
  emptyLabel,
}: {
  rows: CertificatesPayload['summary']['byInstitution'];
  byInstitutionLabel: string;
  emptyLabel: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-fg)]">{byInstitutionLabel}</h3>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-subtle)]">{emptyLabel}</p>
        ) : (
          rows.map((row) => (
            <div key={row.institutionId}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-[var(--color-fg-muted)]">{row.institutionName}</span>
                <span className="font-mono text-[var(--color-fg)]">{row.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent-500)]"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
