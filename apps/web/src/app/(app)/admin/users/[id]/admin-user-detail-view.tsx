'use client';

import { ArrowLeft, CheckCircle, ShieldAlert, User } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@tessera/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { formatDate } from '@/lib/format';
import { UserProfileReviewActions } from '../user-profile-review-actions';
import type { adminApi } from '@/lib/api/endpoints/admin';

type UserDetail = Awaited<ReturnType<typeof adminApi.user>>;

export function AdminUserDetailView({ user }: { user: NonNullable<UserDetail> }) {
  const t = useT();
  const copy = t.admin.users.detail;
  const profileStatusLabels = t.admin.users.profileStatus;
  const variantByStatus = {
    incomplete: 'warning',
    pending: 'brand',
    approved: 'success',
    rejected: 'danger',
  } as const;
  const profileStatus = (user.profile?.status ?? user.profileStatus ?? 'incomplete') as
    | 'incomplete'
    | 'pending'
    | 'approved'
    | 'rejected';
  const profileMeta = {
    label: profileStatusLabels[profileStatus],
    variant: variantByStatus[profileStatus] ?? 'warning',
  };
  const visibleAccountStatus = user.deletedAt
    ? t.admin.users.status.deleted
    : user.restricted
      ? t.admin.users.status.restricted
      : user.role === 'student' && profileStatus !== 'approved'
        ? profileStatus === 'pending'
          ? profileStatusLabels.pendingApproval
          : profileStatus === 'rejected'
            ? profileStatusLabels.correctionNeeded
            : profileStatusLabels.pendingProfile
        : t.admin.users.status.active;
  const fullName =
    [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(' ') ||
    user.name ||
    user.email;

  return (
    <div className="space-y-8">
      <Button variant="ghost" asChild>
        <Link href="/admin/users">
          <ArrowLeft className="h-4 w-4" />
          {copy.backToList}
        </Link>
      </Button>

      <SectionHeading
        title={fullName}
        description={`${user.email} · ${copy.createdOn.replace('{date}', formatDate(user.createdAt))}`}
        actions={
          user.role === 'student' && profileStatus === 'pending' ? (
            <UserProfileReviewActions userId={user.id} name={user.name} email={user.email} />
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={copy.stats.role} value={copy.stats.student} icon={User} />
        <StatCard label={copy.stats.profile} value={profileMeta.label} icon={CheckCircle} />
        <StatCard label={copy.stats.status} value={visibleAccountStatus} icon={ShieldAlert} />
      </div>

      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">{copy.profileTitle}</h3>
          <Badge variant={profileMeta.variant}>{profileMeta.label}</Badge>
        </div>
        {user.profile?.rejectionReason ? (
          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-white/[0.03] px-4 py-3 text-sm text-[var(--color-fg-muted)]">
            <p className="font-medium text-[var(--color-fg)]">{copy.rejectionComment}</p>
            <p className="mt-1">{user.profile.rejectionReason}</p>
          </div>
        ) : null}
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <ReviewField label={copy.fields.firstName} value={user.profile?.firstName} />
          <ReviewField label={copy.fields.lastName} value={user.profile?.lastName} />
          <ReviewField label={copy.fields.documentType} value={user.profile?.documentType} />
          <ReviewField label={copy.fields.documentNumber} value={user.profile?.documentNumber} />
          <ReviewField label={copy.fields.birthDate} value={user.profile?.birthDate} />
          <ReviewField label={copy.fields.phone} value={user.profile?.phone} />
          <ReviewField label={copy.fields.country} value={user.profile?.country} />
          <ReviewField label={copy.fields.city} value={user.profile?.city} />
          <ReviewField label={copy.fields.address} value={user.profile?.addressLine} />
          <ReviewField label={copy.fields.wallet} value={user.walletAddress} mono />
        </dl>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">{copy.institutionsTitle}</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {user.institutions.length > 0 ? (
            user.institutions.map((institution) => (
              <Badge key={institution.id} variant="default" className="normal-case tracking-normal">
                {institution.name}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-[var(--color-fg-muted)]">{copy.noInstitutions}</p>
          )}
        </div>
      </section>
    </div>
  );
}

function ReviewField({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd className={`mt-1 break-words text-[var(--color-fg)] ${mono ? 'font-mono text-xs' : ''}`}>
        {value?.trim() || '—'}
      </dd>
    </div>
  );
}
