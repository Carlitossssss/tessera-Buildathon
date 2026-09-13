'use client';

import Link from 'next/link';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from '@/components/dashboard/stat-card';
import { formatDate, formatNumber, relativeTime } from '@/lib/format';
import { getPlan } from '@/lib/plans';
import { OperationalCard } from '../operational-card';
import { InstitutionReviewAction } from './institution-review-action';
import { InstitutionSuspensionAction } from './institution-suspension-action';
import type { adminApi } from '@/lib/api/endpoints/admin';

type InstitutionsPayload = Awaited<ReturnType<typeof adminApi.institutions>>;
type InstVariant = 'success' | 'warning' | 'danger';

function countryName(country: string | null) {
  if (!country) return '—';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(country.toUpperCase()) ?? country;
  } catch {
    return country;
  }
}

export function AdminInstitutionsView({ payload }: { payload: InstitutionsPayload }) {
  const t = useT();
  const copy = t.admin.institutions;
  const statusBadge: Record<string, { label: string; variant: InstVariant }> = {
    approved: { label: copy.status.approved, variant: 'success' },
    pending: { label: copy.status.pending, variant: 'warning' },
    suspended: { label: copy.status.suspended, variant: 'danger' },
    revoked: { label: copy.status.revoked, variant: 'danger' },
  };
  const pending = payload.data.filter((i) => i.status === 'pending');

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <OperationalCard
          href="/admin/institutions"
          value={payload.totals.approved}
          badge={copy.kpis.active.badge}
          title={copy.kpis.active.title}
          description={copy.kpis.active.description}
        />
        <OperationalCard
          href="/admin/institutions"
          value={payload.totals.pending}
          badge={copy.kpis.pending.badge}
          title={copy.kpis.pending.title}
          description={copy.kpis.pending.description}
        />
        <OperationalCard
          href="/admin/certificates"
          value={payload.totals.certificates}
          badge={copy.kpis.certificates.badge}
          title={copy.kpis.certificates.title}
          description={copy.kpis.certificates.description}
        />
      </div>

      {pending.length > 0 && (
        <section>
          <SectionHeading
            title={copy.approvalQueue.title}
            description={copy.approvalQueue.description}
          />
          <div className="space-y-3">
            {pending.map((inst) => (
              <div
                key={inst.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">{inst.name}</p>
                  <p className="text-xs text-[var(--color-fg-muted)]">
                    {countryName(inst.country)} · {relativeTime(inst.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/admin/institutions/${inst.id}`}>{copy.review}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading title={copy.allInstitutions.title} />
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
              <tr>
                <th className="px-4 py-3 font-medium">{copy.allInstitutions.headers.institution}</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">
                  {copy.allInstitutions.headers.country}
                </th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">
                  {copy.allInstitutions.headers.plan}
                </th>
                <th className="px-4 py-3 font-medium text-right hidden lg:table-cell">
                  {copy.allInstitutions.headers.certificates}
                </th>
                <th className="px-4 py-3 font-medium">{copy.allInstitutions.headers.status}</th>
                <th className="px-4 py-3 font-medium text-center">
                  {copy.allInstitutions.headers.suspension}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
              {payload.data.map((inst) => {
                const sb = (statusBadge[inst.status] ?? statusBadge.approved) as {
                  label: string;
                  variant: InstVariant;
                };
                const planLabel = inst.activePlanCode ? getPlan(inst.activePlanCode).name : null;
                return (
                  <tr key={inst.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-[var(--color-fg)]">
                      <span
                        className={inst.status === 'suspended' ? 'line-through opacity-70' : ''}
                      >
                        {inst.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">{countryName(inst.country)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant={planLabel ? 'brand' : 'default'}>
                        {planLabel ?? copy.noSubscription}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      {formatNumber(inst.certificates)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InstitutionSuspensionAction
                        institutionId={inst.id}
                        institutionName={inst.name}
                        status={inst.status}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {inst.status === 'revoked' && (
                          <InstitutionReviewAction
                            institutionId={inst.id}
                            institutionName={inst.name}
                            status={inst.status}
                          />
                        )}
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            href={`/admin/institutions/${inst.id}`}
                            title={formatDate(inst.createdAt)}
                          >
                            {copy.allInstitutions.view}
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
      </section>
    </div>
  );
}
