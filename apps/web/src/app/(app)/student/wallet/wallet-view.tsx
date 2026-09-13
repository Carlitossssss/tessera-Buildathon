'use client';

import Link from 'next/link';
import { Award, ExternalLink, Shield, Wallet as WalletIcon } from 'lucide-react';
import { useI18n } from '@tessera/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { EmptyState, SectionHeading } from '@/components/dashboard/stat-card';
import { shortAddr } from '@/lib/format';
import { addressUrl, txUrl } from '@/lib/explorer';
import type { StudentWalletData } from '@/lib/api/endpoints/student';

const PANEL =
  'rounded-[26px] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.88),rgba(10,13,26,0.96))] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]';

export function WalletView({ data }: { data: StudentWalletData | null }) {
  const { t, locale } = useI18n();
  const address = data?.walletAddress ?? null;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale);

  return (
    <div className="space-y-10">
      <header className={`${PANEL} relative overflow-hidden p-8 lg:p-10`}>
        <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(50%_45%_at_15%_20%,rgba(94,109,255,0.2),transparent_70%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <Badge variant="brand" className="uppercase tracking-[0.18em]">
              <WalletIcon className="h-3 w-3" /> {t.student.wallet.eyebrow}
            </Badge>
            <h1 className="mt-5 text-[32px] font-semibold leading-[1.05] tracking-tight text-[var(--color-fg)] lg:text-[40px]">
              {t.student.wallet.title}
            </h1>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-[var(--color-fg-muted)]">
              {t.student.wallet.body}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              {t.student.wallet.yourAddress}
            </p>
            <p className="mt-2 break-all font-mono text-[14px] text-[var(--color-fg)]">
              {address ?? t.student.wallet.notAssigned}
            </p>
            {address ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <CopyButton value={address} label={t.student.wallet.copy} />
                <Button asChild variant="ghost" size="sm">
                  <Link href={addressUrl(address)} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Polygonscan
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1fr]">
        <Stat label={t.student.wallet.stats.network} value="Polygon" hint="ChainID 137" />
        <Stat
          label={t.student.wallet.stats.credentials}
          value={String(data?.counts.certificates ?? 0)}
          hint="ERC-5192"
        />
        <Stat
          label={t.student.wallet.stats.badges}
          value={String(data?.counts.badges ?? 0)}
          hint="ERC-1155"
        />
      </div>

      <section>
        <SectionHeading
          title={t.student.wallet.assetsTitle}
          description={t.student.wallet.assetsBody}
        />
        {data && data.certificates.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
            <table className="w-full text-[13px]">
              <thead className="bg-white/[0.02] text-left text-[11px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                <tr>
                  <th className="px-4 py-3 font-medium">{t.student.wallet.table.credential}</th>
                  <th className="px-4 py-3 font-medium">{t.student.wallet.table.token}</th>
                  <th className="px-4 py-3 font-medium">{t.student.wallet.table.issued}</th>
                  <th className="px-4 py-3 font-medium">{t.student.wallet.table.tx}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.certificates.map((c) => (
                  <tr key={c.id} className="text-[var(--color-fg)]">
                    <td className="px-4 py-3.5">{c.achievementName}</td>
                    <td className="px-4 py-3.5 font-mono text-[12.5px] text-[var(--color-brand-200)]">
                      #{c.tokenId ?? '\u2014'}
                    </td>
                    <td className="px-4 py-3.5 text-[12.5px] text-[var(--color-fg-muted)]">
                      {c.issuedAt ? fmt(c.issuedAt) : '\u2014'}
                    </td>
                    <td className="px-4 py-3.5">
                      {c.txHash ? (
                        <Link
                          href={txUrl(c.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[12.5px] text-[var(--color-brand-200)] hover:underline"
                        >
                          {shortAddr(c.txHash)} <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Award}
            title={t.student.wallet.empty.title}
            description={t.student.wallet.empty.body}
          />
        )}
      </section>

      <section className={`${PANEL} grid gap-4 p-6 lg:grid-cols-[auto_1fr] lg:items-start lg:gap-6`}>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-[16px] font-semibold tracking-tight text-[var(--color-fg)]">
            {t.student.wallet.why.title}
          </h3>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
            {t.student.wallet.why.body}
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={`${PANEL} p-6`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        {label}
      </p>
      <p className="mt-3 text-[28px] font-semibold tabular-nums text-[var(--color-fg)]">{value}</p>
      <p className="mt-1 text-[12px] text-[var(--color-fg-muted)]">{hint}</p>
    </div>
  );
}
