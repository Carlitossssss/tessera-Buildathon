'use client';

import { ArrowLeft, Building2, CheckCircle, FileSignature, Globe2, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@tessera/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { formatDate, formatNumber } from '@/lib/format';
import { getPlan } from '@/lib/plans';
import { approveInstitutionAction } from '../../actions';
import { AccreditationSection } from './accreditation-section';
import { InstitutionReviewAction } from '../institution-review-action';
import { InstitutionSuspensionAction } from '../institution-suspension-action';
import type { adminApi } from '@/lib/api/endpoints/admin';

type Institution = Awaited<ReturnType<typeof adminApi.institution>>;

function countryName(country: string | null) {
  if (!country) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(country.toUpperCase()) ?? country;
  } catch {
    return country;
  }
}

export function AdminInstitutionDetailView({
  institution,
  error,
  synced,
}: {
  institution: NonNullable<Institution>;
  error?: string;
  synced?: string;
}) {
  const t = useT();
  const copy = t.admin.institutions.detail;
  const statusTotal = Object.values(institution.certificatesByStatus).reduce((a, b) => a + b, 0);
  const activePlanLabel = institution.activePlanCode
    ? getPlan(institution.activePlanCode).name
    : t.admin.institutions.noSubscription;

  return (
    <div className="space-y-8">
      <Button variant="ghost" asChild>
        <Link href="/admin/institutions">
          <ArrowLeft className="h-4 w-4" />
          {copy.backToList}
        </Link>
      </Button>

      <SectionHeading
        title={institution.name}
        description={`${countryName(institution.country) ?? t.admin.institutions.noCountry} · ${activePlanLabel} · ${copy.createdOn.replace('{date}', formatDate(institution.createdAt))}`}
        actions={
          institution.status === 'pending' ? (
            <div className="flex gap-2">
              <form action={approveInstitutionAction}>
                <input type="hidden" name="institutionId" value={institution.id} />
                <Button
                  size="sm"
                  type="submit"
                  disabled={!institution.profileSubmittedAt}
                  title={institution.profileSubmittedAt ? undefined : copy.needsProfile}
                >
                  <CheckCircle className="h-4 w-4" />
                  {copy.approve}
                </Button>
              </form>
              <InstitutionReviewAction
                institutionId={institution.id}
                institutionName={institution.name}
                status={institution.status}
              />
            </div>
          ) : institution.status === 'approved' ? (
            <div className="flex gap-2">
              <form action={approveInstitutionAction}>
                <input type="hidden" name="institutionId" value={institution.id} />
                <Button size="sm" type="submit" variant="secondary">
                  <CheckCircle className="h-4 w-4" />
                  {copy.syncRegistry}
                </Button>
              </form>
              <InstitutionSuspensionAction
                institutionId={institution.id}
                institutionName={institution.name}
                status={institution.status}
                mode="button"
              />
            </div>
          ) : institution.status === 'revoked' ? (
            <InstitutionReviewAction
              institutionId={institution.id}
              institutionName={institution.name}
              status={institution.status}
            />
          ) : null
        }
      />

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {synced === '1' ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {copy.registrySynced}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label={copy.stats.certificates} value={formatNumber(institution.certificates)} icon={FileSignature} />
        <StatCard label={copy.stats.members} value={formatNumber(institution.members.length)} icon={Users} />
        <StatCard label={copy.stats.subscription} value={activePlanLabel} icon={Building2} />
        <StatCard label={copy.stats.status} value={institution.status} icon={Globe2} />
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">{copy.dataTitle}</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-fg-subtle)]">{copy.slug}</dt>
              <dd className="font-mono text-[var(--color-fg)]">{institution.slug}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-fg-subtle)]">{copy.country}</dt>
              <dd className="text-[var(--color-fg)]">
                {countryName(institution.country) ?? t.admin.institutions.noCountry}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-fg-subtle)]">{copy.website}</dt>
              <dd className="max-w-[260px] text-right font-mono text-xs text-[var(--color-brand-300)]">
                {institution.website ? (
                  <a
                    href={institution.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate whitespace-nowrap text-inherit hover:underline"
                    title={institution.website}
                  >
                    {institution.website}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-fg-subtle)]">{copy.detailedProfile}</dt>
              <dd>
                <Badge variant={institution.profileSubmittedAt ? 'success' : 'warning'}>
                  {institution.profileSubmittedAt ? copy.submitted : copy.pending}
                </Badge>
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-[var(--color-fg-subtle)]">{copy.rejectionComment}</dt>
              <dd className="max-w-[260px] text-right text-[var(--color-fg)]">
                {institution.rejectionReason || '—'}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-[var(--color-fg-subtle)]">
                <Wallet className="h-3.5 w-3.5" />
                {copy.wallet}
              </dt>
              <dd className="max-w-[260px] break-all text-right font-mono text-xs text-[var(--color-brand-300)]">
                {institution.walletAddress}
              </dd>
            </div>
          </dl>
        </div>

        {/* On-chain accreditation: the admin sees whether the contracts recognise the
            institution, and on which networks. It is what an auditor would check on
            their own, so it belongs here rather than in a complaint. */}
        <div className="lg:col-span-2">
          <AccreditationSection
            institutionId={institution.id}
            slug={institution.slug}
            approved={institution.status === 'approved'}
          />
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">
            {copy.certificatesByStatusTitle}
          </h3>
          <div className="mt-4 space-y-3">
            {['issued', 'queued', 'processing', 'failed', 'revoked'].map((status) => {
              const value = institution.certificatesByStatus[status] ?? 0;
              const pct = statusTotal > 0 ? Math.round((value / statusTotal) * 100) : 0;
              return (
                <div key={status}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="capitalize text-[var(--color-fg-muted)]">{status}</span>
                    <span className="font-mono text-[var(--color-fg)]">{value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-[var(--color-brand-500)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">{copy.reviewTitle}</h3>
          <Badge variant={institution.profileSubmittedAt ? 'success' : 'warning'}>
            {institution.profileSubmittedAt
              ? copy.sentOn.replace('{date}', formatDate(institution.profileSubmittedAt))
              : copy.notSent}
          </Badge>
        </div>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <ReviewField label={copy.fields.legalName} value={institution.legalName} />
          <ReviewField label={copy.fields.taxId} value={institution.taxId} />
          <ReviewField label={copy.fields.accreditation} value={institution.accreditationId} />
          <ReviewField label={copy.fields.contactName} value={institution.contactName} />
          <ReviewField label={copy.fields.contactEmail} value={institution.contactEmail} />
          <ReviewField label={copy.fields.contactPhone} value={institution.contactPhone} />
          <ReviewField label={copy.fields.address} value={institution.addressLine} />
          <ReviewField
            label={copy.fields.cityRegion}
            value={[institution.city, institution.stateRegion].filter(Boolean).join(', ')}
          />
          <ReviewField label={copy.fields.postalCode} value={institution.postalCode} />
        </dl>
      </section>

      <section>
        <SectionHeading title={copy.teamTitle} />
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
              <tr>
                <th className="px-4 py-3 font-medium">{copy.teamHeaders.user}</th>
                <th className="px-4 py-3 font-medium">{copy.teamHeaders.role}</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">{copy.teamHeaders.since}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
              {institution.members.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-fg)]">
                      {member.name ?? member.email}
                    </p>
                    <p className="text-xs">{member.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={member.memberRole === 'admin' ? 'brand' : 'default'}>
                      {member.memberRole}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">{formatDate(member.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-[var(--color-fg)]">{value?.trim() || '—'}</dd>
    </div>
  );
}
