'use client';

import Link from 'next/link';
import { CheckCircle2, MailQuestion } from 'lucide-react';
import { useT } from '@tessera/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/dashboard/stat-card';
import { relativeTime } from '@/lib/format';
import { OperationalCard } from '../operational-card';
import { resolveSuspensionRequestAction } from '../actions';
import type { adminApi } from '@/lib/api/endpoints/admin';

type SuspensionRequestsPayload = Awaited<ReturnType<typeof adminApi.suspensionRequests>>;

export function AdminSuspensionRequestsView({ payload }: { payload: SuspensionRequestsPayload }) {
  const t = useT();
  const copy = t.admin.suspensionRequests;
  const roleLabel: Record<string, string> = {
    admin: copy.roles.admin,
    institution_admin: copy.roles.institutionAdmin,
    teacher: copy.roles.teacher,
    student: copy.roles.student,
    api_client: copy.roles.apiClient,
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <OperationalCard
          href="/admin/suspension-requests"
          value={payload.totals.open}
          badge={copy.kpis.open.badge}
          title={copy.kpis.open.title}
          description={copy.kpis.open.description}
        />
        <OperationalCard
          href="/admin/suspension-requests"
          value={payload.totals.reviewed}
          badge={copy.kpis.reviewed.badge}
          title={copy.kpis.reviewed.title}
          description={copy.kpis.reviewed.description}
        />
        <OperationalCard
          href="/admin/users?status=restricted"
          value={payload.totals.total}
          badge={copy.kpis.total.badge}
          title={copy.kpis.total.title}
          description={copy.kpis.total.description}
        />
      </div>

      <SectionHeading title={copy.heading.title} description={copy.heading.description} />

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
            <tr>
              <th className="px-4 py-3 font-medium">{copy.table.headers.account}</th>
              <th className="px-4 py-3 font-medium">{copy.table.headers.type}</th>
              <th className="px-4 py-3 font-medium">{copy.table.headers.institution}</th>
              <th className="px-4 py-3 font-medium">{copy.table.headers.supportEmail}</th>
              <th className="px-4 py-3 font-medium">{copy.table.headers.submitted}</th>
              <th className="px-4 py-3 font-medium">{copy.table.headers.status}</th>
              <th className="px-4 py-3 text-right font-medium">{copy.table.headers.action}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
            {payload.data.length > 0 ? (
              payload.data.map((request) => (
                <tr key={request.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-[var(--color-fg)]">
                      {request.requesterName ?? request.requesterEmail}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
                      {request.requesterEmail}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {roleLabel[request.requesterRole] ?? request.requesterRole}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {request.institution ? (
                      <Link
                        href={`/admin/institutions/${request.institution.id}`}
                        className="font-medium text-[var(--color-brand-200)] hover:text-[var(--color-brand-100)]"
                      >
                        {request.institution.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">{request.supportEmail ?? '—'}</td>
                  <td className="px-4 py-3 align-top">{relativeTime(request.submittedAt)}</td>
                  <td className="px-4 py-3 align-top">
                    {request.reviewed ? (
                      <Badge variant="default">{copy.table.reviewed}</Badge>
                    ) : (
                      <Badge variant="brand">{copy.table.reviewEmail}</Badge>
                    )}
                    {request.stillSuspended === false ? (
                      <p className="mt-2 text-xs text-[var(--color-fg-subtle)]">
                        {copy.table.alreadyReactivated}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    {request.reviewed ? (
                      <span className="inline-flex items-center gap-2 text-xs text-[var(--color-fg-subtle)]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {copy.table.done}
                      </span>
                    ) : (
                      <form action={resolveSuspensionRequestAction}>
                        <input type="hidden" name="requestId" value={request.id} />
                        <Button type="submit" size="sm" variant="secondary">
                          <MailQuestion className="h-3.5 w-3.5" />
                          {copy.table.markReviewed}
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-[var(--color-fg-muted)]"
                >
                  {copy.table.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-5 text-[var(--color-fg-subtle)]">{copy.footnote}</p>
    </div>
  );
}
