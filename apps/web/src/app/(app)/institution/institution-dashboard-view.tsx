'use client';

import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle,
  Clock,
  Coins,
  FileSignature,
  Plus,
  Users,
  Wallet,
} from 'lucide-react';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard, SectionHeading, EmptyState } from '@/components/dashboard/stat-card';
import { formatNumber, relativeTime } from '@/lib/format';
import { InstitutionRejectionNotice } from './institution-rejection-notice';
import type { meApi } from '@/lib/api/endpoints/me';

type Stats = Awaited<ReturnType<typeof meApi.stats>> | null;
type Credits = Awaited<ReturnType<typeof meApi.credits>> | null;
type Certs = Awaited<ReturnType<typeof meApi.certificates>> | null;
type Me = Awaited<ReturnType<typeof meApi.institution>> | null;

export function InstitutionDashboardView({
  stats,
  credits,
  certs,
  me,
  planLabel,
  quota,
  usedThisMonth,
  quotaPct,
  hasActiveSubscription,
}: {
  stats: Stats;
  credits: Credits;
  certs: Certs;
  me: Me;
  planLabel: string;
  quota: number | null;
  usedThisMonth: number;
  quotaPct: number;
  hasActiveSubscription: boolean;
}) {
  const t = useT();
  const copy = t.institution.dashboard;
  const statusLabel: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
    issued: { label: copy.status.issued, variant: 'success' },
    queued: { label: copy.status.queued, variant: 'warning' },
    processing: { label: copy.status.processing, variant: 'warning' },
    failed: { label: copy.status.failed, variant: 'danger' },
    revoked: { label: copy.status.revoked, variant: 'default' },
  };

  const creditBalance = credits?.balance ?? 0;
  const noCredits = Boolean(credits) && creditBalance <= 0;
  const lowCredits = credits?.lowBalance ?? false;
  const daysRemaining = credits?.daysRemaining ?? null;

  return (
    <div className="space-y-8">
      {me?.institution.status === 'revoked' && (
        <InstitutionRejectionNotice reason={me.institution.rejectionReason} />
      )}

      {(noCredits || lowCredits) && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="flex-1 text-[var(--color-fg-muted)]">
            <strong className="text-[var(--color-fg)]">
              {noCredits ? copy.noCredits : copy.lowCredits}
            </strong>{' '}
            {noCredits
              ? copy.noCreditsBody
              : copy.lowCreditsBody.replace('{balance}', formatNumber(creditBalance))}
          </div>
          <Button size="sm" asChild>
            <Link href="/institution/credits">{copy.buyTsc}</Link>
          </Button>
        </div>
      )}

      <section>
        <SectionHeading title={copy.quickActions.title} />
        <div className="grid gap-3 sm:grid-cols-3">
          <ActionTile
            href="/institution/certificates/new"
            icon={Plus}
            title={copy.quickActions.issue.title}
            hint={copy.quickActions.issue.hint}
          />
          <ActionTile
            href="/institution/students"
            icon={Users}
            title={copy.quickActions.invite.title}
            hint={copy.quickActions.invite.hint}
          />
          <ActionTile
            href="/institution/wallet"
            icon={Wallet}
            title={copy.quickActions.wallet.title}
            hint={copy.quickActions.wallet.hint}
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title={copy.summary.title}
          description={stats ? copy.summary.live : copy.summary.unavailable}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={copy.stats.issuedThisMonth}
            value={formatNumber(usedThisMonth)}
            icon={FileSignature}
            hint={copy.stats.issuedTotalHint.replace('{total}', formatNumber(stats?.certificates.issuedTotal ?? 0))}
          />
          <StatCard
            label={copy.stats.students}
            value={formatNumber(stats?.students ?? 0)}
            icon={Users}
            hint={copy.stats.studentsHint.replace('{count}', formatNumber(stats?.teamMembers ?? 0))}
          />
          <StatCard
            label={copy.stats.tscAvailable}
            value={formatNumber(creditBalance)}
            icon={Coins}
            hint={
              creditBalance === 0
                ? copy.stats.rechargeToIssue
                : daysRemaining !== null
                  ? copy.stats.approxDaysHint.replace(
                      '{value}',
                      daysRemaining > 365 ? copy.stats.moreThanYear : copy.stats.daysUnit.replace('{days}', String(daysRemaining)),
                    )
                  : creditBalance === 1
                    ? copy.stats.emissionsRemainingOne
                    : copy.stats.emissionsRemainingMany.replace('{count}', formatNumber(creditBalance))
            }
            trend={lowCredits ? { delta: copy.stats.lowBadge, positive: false } : undefined}
          />
          <StatCard
            label={copy.stats.queuedFailed}
            value={`${formatNumber(stats?.certificates.queued ?? 0)} / ${formatNumber(
              stats?.certificates.failed ?? 0,
            )}`}
            icon={Activity}
            hint={copy.stats.queuedFailedHint.replace('{count}', formatNumber(stats?.certificates.revoked ?? 0))}
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title={copy.recentActivity.title}
          description={copy.recentActivity.description}
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link href="/institution/certificates" className="inline-flex items-center gap-1.5">
                {copy.recentActivity.viewAll} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        />
        {certs && certs.data.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
                <tr>
                  <th className="px-4 py-3 font-medium">{copy.recentActivity.headers.student}</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">
                    {copy.recentActivity.headers.certificate}
                  </th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">
                    {copy.recentActivity.headers.token}
                  </th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">
                    {copy.recentActivity.headers.ago}
                  </th>
                  <th className="px-4 py-3 font-medium">{copy.recentActivity.headers.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
                {certs.data.map((c) => {
                  const sb = (statusLabel[c.status] ?? statusLabel.queued)!;
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-fg)]">{c.studentName}</p>
                        <p className="text-xs text-[var(--color-fg-subtle)]">{c.studentEmail}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">{c.achievementName}</td>
                      <td className="px-4 py-3 hidden md:table-cell font-mono text-[var(--color-brand-300)]">
                        {c.tokenId ? `#${c.tokenId}` : '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs">
                        {relativeTime(c.issuedAt ?? c.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sb.variant}>{sb.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={FileSignature}
            title={copy.recentActivity.empty.title}
            description={copy.recentActivity.empty.description}
            action={
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/institution/certificates/new">
                    <Plus className="h-4 w-4" /> {copy.recentActivity.empty.issueManual}
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/institution/api-keys">{copy.recentActivity.empty.createApiKey}</Link>
                </Button>
              </div>
            }
          />
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6">
          <h3 className="text-base font-semibold text-[var(--color-fg)]">{copy.setup.title}</h3>
          <ul className="mt-4 space-y-3 text-sm text-[var(--color-fg-muted)]">
            <SetupItem
              done={(stats?.certificates.issuedTotal ?? 0) > 0}
              text={copy.setup.issueFirst}
              href="/institution/certificates/new"
            />
            <SetupItem done={creditBalance > 0} text={copy.setup.buyTscItem} href="/institution/credits" />
            <SetupItem done={false} text={copy.setup.createApiKeyItem} href="/institution/api-keys" />
            <SetupItem done={false} text={copy.setup.configureWebhooksItem} href="/institution/webhooks" />
          </ul>
        </div>
        <div className="rounded-2xl border border-[var(--color-brand-500)]/30 bg-gradient-to-br from-[var(--color-brand-700)]/15 to-transparent p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[var(--color-fg)]">{copy.planUsage.title}</h3>
            <Badge variant="brand">{planLabel}</Badge>
          </div>
          {hasActiveSubscription && quota !== null ? (
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-[var(--color-fg-muted)]">{copy.planUsage.subscriptionQuota}</span>
                <span className="font-mono text-[var(--color-fg)]">
                  {formatNumber(usedThisMonth)} / {formatNumber(quota)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-[var(--color-brand-500)] transition-all"
                  style={{ width: `${quotaPct}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-white/[0.02] px-4 py-3 text-sm text-[var(--color-fg-muted)]">
              {copy.planUsage.noSubscription}
            </div>
          )}
          <div className="mt-5 flex gap-2">
            <Button asChild size="sm">
              <Link href="/institution/plan">{copy.planUsage.viewPlan}</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/institution/plan">{copy.planUsage.getPlan}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActionTile({
  href,
  icon: Icon,
  title,
  hint,
}: {
  href: string;
  icon: typeof Plus;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4 transition-colors hover:border-[var(--color-border-strong)] hover:bg-white/[0.04]"
    >
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--color-fg)]">{title}</p>
        <p className="text-xs text-[var(--color-fg-subtle)]">{hint}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-[var(--color-fg-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}

function SetupItem({ done, text, href }: { done: boolean; text: string; href: string }) {
  return (
    <li className="flex items-start gap-3">
      {done ? (
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent-400)]" />
      ) : (
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-fg-subtle)]" />
      )}
      <Link
        href={href}
        className={`flex-1 hover:text-[var(--color-fg)] ${
          done ? 'line-through text-[var(--color-fg-subtle)]' : ''
        }`}
      >
        {text}
      </Link>
      {!done && <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />}
    </li>
  );
}
