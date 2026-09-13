'use client';

import Link from 'next/link';
import { useT } from '@tessera/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/dashboard/stat-card';
import { formatDate, formatNumber } from '@/lib/format';
import { AutoRefresh } from '../../auto-refresh';
import { OperationalCard } from '../operational-card';
import { UserAccountActions } from './user-account-actions';
import { UsersFilterBar } from './users-filter-bar';
import type { adminApi } from '@/lib/api/endpoints/admin';

type UsersPayload = Awaited<ReturnType<typeof adminApi.users>>;
type RoleVariant = 'brand' | 'warning' | 'success' | 'default';
type BadgeVariant = RoleVariant | 'danger' | 'accent';
type UserStatus = 'active' | 'restricted' | 'deleted';
type ProfileStatus = 'incomplete' | 'pending' | 'approved' | 'rejected';

function getUserStatus(user: { restricted: boolean; deletedAt: string | null }): UserStatus {
  if (user.deletedAt) return 'deleted';
  if (user.restricted) return 'restricted';
  return 'active';
}

function pageHref(params: { q?: string; role?: string; status?: string }, nextPage: number) {
  const nextParams = new URLSearchParams();
  if (params.q?.trim()) nextParams.set('q', params.q.trim());
  if (params.role?.trim()) nextParams.set('role', params.role.trim());
  if (params.status?.trim()) nextParams.set('status', params.status.trim());
  if (nextPage > 1) nextParams.set('page', String(nextPage));
  const suffix = nextParams.toString();
  return suffix ? `/admin/users?${suffix}` : '/admin/users';
}

export function AdminUsersView({
  payload,
  params,
}: {
  payload: UsersPayload;
  params: { q?: string; role?: string; status?: string };
}) {
  const t = useT();
  const copy = t.admin.users;
  const roleLabels: Record<string, { label: string; variant: RoleVariant }> = {
    institution_admin: { label: copy.roles.institutionAdmin, variant: 'brand' },
    teacher: { label: copy.roles.teacher, variant: 'warning' },
    student: { label: copy.roles.student, variant: 'default' },
    admin: { label: copy.roles.admin, variant: 'success' },
    api_client: { label: copy.roles.apiClient, variant: 'default' },
  };
  const userStatusLabels: Record<UserStatus, { label: string; variant: BadgeVariant }> = {
    active: { label: copy.status.active, variant: 'success' },
    restricted: { label: copy.status.restricted, variant: 'danger' },
    deleted: { label: copy.status.deleted, variant: 'default' },
  };
  const profileStatusLabels: Record<ProfileStatus, { label: string; variant: BadgeVariant }> = {
    incomplete: { label: copy.profileStatus.incomplete, variant: 'warning' },
    pending: { label: copy.profileStatus.pending, variant: 'brand' },
    approved: { label: copy.profileStatus.approved, variant: 'success' },
    rejected: { label: copy.profileStatus.rejected, variant: 'danger' },
  };

  function getVisibleUserStatusMeta(
    user: {
      role: string;
      restricted: boolean;
      emailVerifiedAt: string | null;
      deletionScheduledAt: string | null;
      deletedAt: string | null;
      profileStatus?: ProfileStatus | null;
    },
    status: UserStatus,
  ) {
    if (
      (user.role === 'student' || user.role === 'teacher') &&
      status === 'active' &&
      user.profileStatus &&
      user.profileStatus !== 'approved'
    ) {
      if (user.profileStatus === 'pending')
        return { label: copy.profileStatus.pendingApproval, variant: 'brand' as const };
      if (user.profileStatus === 'rejected')
        return { label: copy.profileStatus.correctionNeeded, variant: 'danger' as const };
      return { label: copy.profileStatus.pendingProfile, variant: 'warning' as const };
    }
    return userStatusLabels[status];
  }

  return (
    <div className="space-y-8">
      <AutoRefresh intervalMs={5000} />

      <div className="grid gap-4 sm:grid-cols-3">
        <OperationalCard
          href="/admin/users"
          value={payload.totals.total}
          badge={copy.kpis.total.badge}
          title={copy.kpis.total.title}
          description={copy.kpis.total.description}
        />
        <OperationalCard
          href="/admin/users?role=institution_admin"
          value={payload.totals.institutionAdmins}
          badge={copy.kpis.institutionAdmins.badge}
          title={copy.kpis.institutionAdmins.title}
          description={copy.kpis.institutionAdmins.description}
        />
        <OperationalCard
          href="/admin/users?status=restricted"
          value={payload.totals.restricted}
          badge={copy.kpis.restricted.badge}
          title={copy.kpis.restricted.title}
          description={copy.kpis.restricted.description}
        />
      </div>

      <SectionHeading title={copy.heading.title} description={copy.heading.description} />

      <UsersFilterBar q={params.q} role={params.role} status={params.status} />

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
            <tr>
              <th className="px-4 py-3 font-medium">{copy.table.headers.user}</th>
              <th className="px-4 py-3 font-medium">{copy.table.headers.role}</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">
                {copy.table.headers.institution}
              </th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">
                {copy.table.headers.registered}
              </th>
              <th className="px-4 py-3 font-medium">{copy.table.headers.status}</th>
              <th className="px-4 py-3 font-medium text-center">
                {copy.table.headers.suspension}
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
            {payload.data.map((u) => {
              const rl = (roleLabels[u.role] ?? roleLabels.student) as {
                label: string;
                variant: RoleVariant;
              };
              const status = getUserStatus(u);
              const statusMeta = getVisibleUserStatusMeta(u, status);
              const hideProfileBadge =
                (u.role === 'student' || u.role === 'teacher') &&
                status === 'active' &&
                Boolean(u.profileStatus);
              const actionsManagedByInstitution = u.role === 'institution_admin';
              const actionsDisabled = actionsManagedByInstitution || Boolean(u.deletedAt);
              const studentProfileBlocksSuspension =
                u.role === 'student' && !u.restricted && u.profileStatus !== 'approved';
              return (
                <tr key={u.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p
                      className={`font-medium text-[var(--color-fg)] ${
                        u.restricted || u.deletedAt ? 'line-through opacity-70' : ''
                      }`}
                    >
                      {u.name ?? u.email}
                    </p>
                    <p className="text-xs">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={rl.variant}>{rl.label}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {u.institutions.length > 0 ? (
                      <div className="flex max-w-[260px] flex-wrap gap-1.5">
                        {u.institutions.slice(0, 2).map((institution) => (
                          <Badge
                            key={institution.id}
                            variant="default"
                            className="normal-case tracking-normal"
                          >
                            {institution.name}
                          </Badge>
                        ))}
                        {u.institutions.length > 2 ? (
                          <Badge variant="default" className="normal-case tracking-normal">
                            +{u.institutions.length - 2}
                          </Badge>
                        ) : null}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1.5">
                      <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      {u.profileStatus && !hideProfileBadge ? (
                        <Badge
                          variant={profileStatusLabels[u.profileStatus].variant}
                          className="normal-case tracking-normal"
                        >
                          {profileStatusLabels[u.profileStatus].label}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {actionsDisabled ? (
                      <span className="text-xs text-[var(--color-fg-subtle)]">
                        {actionsManagedByInstitution ? copy.table.managedByInstitution : copy.table.noActions}
                      </span>
                    ) : (
                      <UserAccountActions
                        userId={u.id}
                        name={u.name}
                        email={u.email}
                        restricted={u.restricted}
                        disabled={studentProfileBlocksSuspension}
                        disabledReason={copy.actions.suspendDisabledReason}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.role === 'student' ? (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/admin/users/${u.id}`}>{copy.table.view}</Link>
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] px-4 py-3 text-sm text-[var(--color-fg-muted)] sm:flex-row sm:items-center sm:justify-between">
        <span>
          {copy.table.resultsSummary
            .replace('{shown}', formatNumber(payload.data.length))
            .replace('{total}', formatNumber(payload.pagination.totalItems))
            .replace('{page}', formatNumber(payload.pagination.page))
            .replace('{totalPages}', formatNumber(payload.pagination.totalPages))}
        </span>
        <div className="flex items-center gap-2">
          <Button
            asChild={payload.pagination.hasPreviousPage}
            size="sm"
            variant="secondary"
            disabled={!payload.pagination.hasPreviousPage}
          >
            {payload.pagination.hasPreviousPage ? (
              <Link href={pageHref(params, payload.pagination.page - 1)}>{copy.table.previous}</Link>
            ) : (
              <span>{copy.table.previous}</span>
            )}
          </Button>
          <Button
            asChild={payload.pagination.hasNextPage}
            size="sm"
            variant="secondary"
            disabled={!payload.pagination.hasNextPage}
          >
            {payload.pagination.hasNextPage ? (
              <Link href={pageHref(params, payload.pagination.page + 1)}>{copy.table.next}</Link>
            ) : (
              <span>{copy.table.next}</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
