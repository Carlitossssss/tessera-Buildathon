'use client';

import Link from 'next/link';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from '@/components/dashboard/stat-card';
import { formatNumber, relativeTime } from '@/lib/format';
import { OperationalCard } from './operational-card';
import type { adminApi } from '@/lib/api/endpoints/admin';

type DashboardPayload = Awaited<ReturnType<typeof adminApi.dashboard>>;
type InstitutionsPayload = Awaited<ReturnType<typeof adminApi.institutions>> | null;
type UsersPayload = Awaited<ReturnType<typeof adminApi.users>> | null;

interface AdminDashboardViewProps {
  dashboard: DashboardPayload;
  institutionsPayload: InstitutionsPayload;
  usersPayload: UsersPayload;
}

export function AdminDashboardView({
  dashboard,
  institutionsPayload,
  usersPayload,
}: AdminDashboardViewProps) {
  const t = useT();
  const copy = t.admin.dashboard;
  const kpis = dashboard.kpis;
  const institutionRows = institutionsPayload?.data ?? [];
  const institutionsToReview =
    institutionsPayload?.totals.pending ??
    kpis.institutionsToReview ??
    dashboard.pendingInstitutions.length;
  const rejectedInstitutions =
    institutionsPayload?.totals.rejected ??
    kpis.rejectedInstitutions ??
    institutionRows.filter((inst) => inst.status === 'revoked').length;
  const suspendedUsers = usersPayload?.totals.restricted ?? kpis.suspendedUsers ?? 0;
  const suspendedInstitutions =
    institutionsPayload?.totals.suspended ??
    kpis.suspendedInstitutions ??
    institutionRows.filter((inst) => inst.status === 'suspended').length;
  const suspendedAccounts = suspendedUsers + suspendedInstitutions;
  const failedCertificates = kpis.failedCertificates ?? 0;
  const failedWebhooks = kpis.failedWebhooks ?? 0;
  const emissionProblems = failedCertificates + failedWebhooks;
  const suspensionReviewRequests = kpis.suspensionReviewRequests ?? 0;
  const suspensionReviewRows = dashboard.suspensionReviewRequests ?? [];
  const suspendedThisMonth =
    (kpis.suspendedUsersThisMonth ?? 0) + (kpis.suspendedInstitutionsThisMonth ?? 0);
  const institutionsToReviewThisMonth =
    kpis.institutionsToReviewThisMonth ??
    institutionRows.filter(
      (inst) =>
        inst.status === 'pending' &&
        inst.profileSubmittedAt &&
        new Date(inst.profileSubmittedAt).getUTCMonth() === new Date().getUTCMonth() &&
        new Date(inst.profileSubmittedAt).getUTCFullYear() === new Date().getUTCFullYear(),
    ).length;
  const totalAttention =
    institutionsToReview +
    rejectedInstitutions +
    suspendedAccounts +
    emissionProblems +
    suspensionReviewRequests;

  return (
    <div className="space-y-8">
      <section>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OperationalCard
            href="/admin/institutions"
            value={institutionsToReview}
            badge={copy.pendingInstitutions.badge}
            title={copy.pendingInstitutions.title}
            description={copy.pendingInstitutions.description}
            delta={institutionsToReviewThisMonth}
            deltaLabel={copy.pendingInstitutions.deltaLabel}
          />
          <OperationalCard
            href="/admin/institutions"
            value={rejectedInstitutions}
            badge={copy.awaitingCorrections.badge}
            title={copy.awaitingCorrections.title}
            description={copy.awaitingCorrections.description}
            delta={kpis.rejectedInstitutionsThisWeek ?? 0}
            deltaLabel={copy.awaitingCorrections.deltaLabel}
          />
          <OperationalCard
            href={suspensionReviewRequests > 0 ? '/admin/suspension-requests' : '/admin/users?status=restricted'}
            value={suspendedAccounts}
            badge={copy.suspendedAccounts.badge}
            title={copy.suspendedAccounts.title}
            description={copy.suspendedAccounts.usersInstitutions
              .replace('{users}', formatNumber(suspendedUsers))
              .replace('{institutions}', formatNumber(suspendedInstitutions))}
            delta={suspensionReviewRequests}
            deltaLabel={
              suspensionReviewRequests > 0
                ? copy.suspendedAccounts.deltaRequests
                : suspendedThisMonth === 0
                  ? copy.suspendedAccounts.deltaNoChange
                  : copy.suspendedAccounts.deltaThisMonth
            }
            neutralZero
          />
          <OperationalCard
            href="/admin/alerts"
            value={emissionProblems}
            badge={copy.emissionIssues.badge}
            title={copy.emissionIssues.title}
            description={copy.emissionIssues.certificatesWebhooks
              .replace('{certificates}', formatNumber(failedCertificates))
              .replace('{webhooks}', formatNumber(failedWebhooks))}
            delta={(kpis.failedCertificates24h ?? 0) + (kpis.failedWebhooks24h ?? 0)}
            deltaLabel={copy.emissionIssues.deltaLabel}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 text-sm text-[var(--color-fg-muted)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent-400)] shadow-[0_0_18px_rgba(34,240,180,0.55)]" />
            <span>{copy.issuesRequireReview.replace('{count}', formatNumber(totalAttention))}</span>
          </div>
          <span>{copy.autoUpdated}</span>
        </div>
      </section>

      {suspensionReviewRows.length > 0 ? (
        <section>
          <SectionHeading
            title={copy.suspensionRequests.title}
            description={copy.suspensionRequests.description}
            actions={
              <Button asChild size="sm" variant="secondary">
                <Link href="/admin/suspension-requests">{copy.suspensionRequests.viewAll}</Link>
              </Button>
            }
          />
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
                <tr>
                  <th className="px-4 py-3 font-medium">{copy.suspensionRequests.account}</th>
                  <th className="px-4 py-3 font-medium">{copy.suspensionRequests.type}</th>
                  <th className="px-4 py-3 font-medium">{copy.suspensionRequests.submitted}</th>
                  <th className="px-4 py-3 font-medium">{copy.suspensionRequests.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
                {suspensionReviewRows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-fg)]">
                        {row.requesterName ?? row.requesterEmail}
                      </p>
                      <p className="text-xs text-[var(--color-fg-subtle)]">
                        {row.requesterEmail}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {row.institution ? row.institution.name : row.requesterRole}
                    </td>
                    <td className="px-4 py-3">{relativeTime(row.submittedAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="brand">{copy.suspensionRequests.reviewSupportEmail}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading
          title={copy.pendingInstitutionsTable.title}
          description={copy.pendingInstitutionsTable.description}
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin/institutions">{copy.pendingInstitutionsTable.viewAll}</Link>
            </Button>
          }
        />
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
              <tr>
                <th className="px-4 py-3 font-medium">{copy.pendingInstitutionsTable.institution}</th>
                <th className="px-4 py-3 font-medium">{copy.pendingInstitutionsTable.country}</th>
                <th className="px-4 py-3 font-medium">{copy.pendingInstitutionsTable.requested}</th>
                <th className="px-4 py-3 font-medium">{copy.pendingInstitutionsTable.status}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
              {dashboard.pendingInstitutions.length > 0 ? (
                dashboard.pendingInstitutions.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-[var(--color-fg)]">{row.name}</td>
                    <td className="px-4 py-3">{row.country ?? '—'}</td>
                    <td className="px-4 py-3">{relativeTime(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="warning">{copy.pendingInstitutionsTable.pending}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/admin/institutions/${row.id}`}>
                          {copy.pendingInstitutionsTable.review}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-[var(--color-fg-muted)]"
                  >
                    {copy.pendingInstitutionsTable.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
