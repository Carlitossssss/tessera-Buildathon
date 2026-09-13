'use client';

import Link from 'next/link';
import { ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import { useI18n, type Dictionary } from '@tessera/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { EmptyState, SectionHeading } from '@/components/dashboard/stat-card';
import { shortAddr } from '@/lib/format';
import type { StudentCertificateRow } from '@/lib/api/endpoints/student';

const PANEL =
  'rounded-[26px] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.88),rgba(10,13,26,0.96))] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]';

function statusVariant(s: StudentCertificateRow['status']) {
  if (s === 'issued') return 'success' as const;
  if (s === 'failed' || s === 'revoked') return 'danger' as const;
  return 'warning' as const;
}

/** El estado tambien lo lee una persona: viaja con el idioma. */
function statusLabel(s: StudentCertificateRow['status'], t: Dictionary) {
  return t.student.credentials.status[s];
}

export function CredentialsView({ items }: { items: StudentCertificateRow[] }) {
  const { t, locale } = useI18n();

  const issued = items.filter((c) => c.status === 'issued');
  const inFlight = items.filter((c) => c.status === 'queued' || c.status === 'processing');
  const failed = items.filter((c) => c.status === 'failed' || c.status === 'revoked');

  return (
    <div className="space-y-10">
      <header className={`${PANEL} relative overflow-hidden p-8 lg:p-10`}>
        <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(50%_45%_at_10%_20%,rgba(94,109,255,0.18),transparent_70%)]" />
        <div className="relative">
          <Badge variant="brand" className="uppercase tracking-[0.18em]">
            <ShieldCheck className="h-3 w-3" /> {t.student.credentials.eyebrow}
          </Badge>
          <h1 className="mt-5 text-[32px] font-semibold leading-[1.05] tracking-tight text-[var(--color-fg)] lg:text-[40px]">
            {t.student.credentials.title}
          </h1>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-[var(--color-fg-muted)]">
            {t.student.credentials.body}
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <Mini label={t.student.credentials.stats.issued} value={issued.length} />
            <Mini label={t.student.credentials.stats.inProgress} value={inFlight.length} />
            <Mini label={t.student.credentials.stats.total} value={items.length} />
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t.student.credentials.empty.title}
          description={t.student.credentials.empty.body}
        />
      ) : (
        <>
          <Group title={t.student.credentials.groups.issued} items={issued} locale={locale} t={t} />
          <Group
            title={t.student.credentials.groups.inProgress}
            items={inFlight}
            locale={locale}
            t={t}
          />
          <Group title={t.student.credentials.groups.failed} items={failed} locale={locale} t={t} />
        </>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.03] px-4 py-3.5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        {label}
      </p>
      <p className="mt-1.5 text-[24px] font-semibold tabular-nums text-[var(--color-fg)]">
        {value}
      </p>
    </div>
  );
}

function Group({
  title,
  items,
  locale,
  t,
}: {
  title: string;
  items: StudentCertificateRow[];
  locale: string;
  t: Dictionary;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeading title={`${title} \u00b7 ${items.length}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((c) => (
          <CertificateCard key={c.id} cert={c} locale={locale} t={t} />
        ))}
      </div>
    </section>
  );
}

function CertificateCard({
  cert: c,
  locale,
  t,
}: {
  cert: StudentCertificateRow;
  locale: string;
  t: Dictionary;
}) {
  return (
    <article className={`${PANEL} flex flex-col gap-5 p-6`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            {c.institutionName ?? t.student.courses.institutionFallback}
          </p>
          <h3 className="mt-2 line-clamp-2 text-[20px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]">
            {c.achievementName}
          </h3>
          {c.courseTitle ? (
            <p className="mt-1 truncate text-[12.5px] text-[var(--color-fg-muted)]">
              {c.courseTitle}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={statusVariant(c.status)}>{statusLabel(c.status, t)}</Badge>
          {c.grade != null ? (
            <span className="font-mono text-[13px] text-[var(--color-fg)]">
              {t.student.credentials.grade.replace('{n}', String(c.grade))}
            </span>
          ) : null}
        </div>
      </div>

      {c.achievementDescription ? (
        <p className="line-clamp-3 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
          {c.achievementDescription}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
        {c.issuedAt ? (
          <Field label={t.student.credentials.fields.issued}>
            {new Date(c.issuedAt).toLocaleDateString(locale)}
          </Field>
        ) : null}
        {c.studentWallet ? (
          <Field label={t.student.credentials.fields.yourWallet} mono copy={c.studentWallet}>
            {shortAddr(c.studentWallet)}
          </Field>
        ) : null}
        {c.txHash ? (
          <Field label={t.student.credentials.fields.txHash} mono copy={c.txHash}>
            {shortAddr(c.txHash)}
          </Field>
        ) : null}
      </dl>

      {c.networks && c.networks.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
            {t.student.credentials.networks}
          </p>
          {c.networks.map((net) => (
            <div
              key={net.chainId}
              className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[12.5px] font-medium text-[var(--color-fg)]">{net.name}</span>
                {net.tokenId ? (
                  <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                    #{net.tokenId}
                  </span>
                ) : null}
                <span
                  className={
                    net.status === 'confirmed'
                      ? 'ml-auto font-mono text-[10.5px] text-emerald-400'
                      : net.status === 'failed'
                        ? 'ml-auto font-mono text-[10.5px] text-red-300'
                        : 'ml-auto font-mono text-[10.5px] text-[var(--color-fg-muted)]'
                  }
                >
                  {net.status === 'confirmed' ? t.student.credentials.confirmed : net.status}
                </span>
              </div>
              {net.nftUrl || net.txUrl ? (
                <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1">
                  {net.nftUrl ? (
                    <Link
                      href={net.nftUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--color-brand-300)] hover:underline"
                    >
                      {t.student.credentials.viewSbt} <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : null}
                  {net.txUrl ? (
                    <Link
                      href={net.txUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                    >
                      {t.student.credentials.viewTx} <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {c.failureReason ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-200">
          {c.failureReason}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {c.verifyUrl ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={c.verifyUrl} target="_blank" rel="noreferrer">
              <ShieldCheck className="h-3.5 w-3.5" /> {t.student.credentials.publicVerification}
            </Link>
          </Button>
        ) : null}
        {c.verifyUrl ? (
          <CopyButton value={c.verifyUrl} label={t.student.credentials.copyLink} />
        ) : null}
        {c.tokenUri ? <CopyButton value={c.tokenUri} label="tokenURI" variant="ghost" /> : null}
      </div>
    </article>
  );
}

function Field({
  label,
  children,
  mono,
  copy,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  copy?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd
        className={
          mono
            ? 'mt-0.5 flex items-center gap-1 font-mono text-[12.5px] text-[var(--color-fg)]'
            : 'mt-0.5 text-[12.5px] text-[var(--color-fg)]'
        }
      >
        {children}
        {copy ? <CopyButton value={copy} label="Copy" size="sm" variant="ghost" /> : null}
      </dd>
    </div>
  );
}
