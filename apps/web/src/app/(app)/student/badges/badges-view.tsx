'use client';

import Link from 'next/link';
import { Award, ExternalLink, Sparkles } from 'lucide-react';
import { useI18n } from '@tessera/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/dashboard/stat-card';
import { shortAddr } from '@/lib/format';
import type { StudentBadgeRow } from '@/lib/api/endpoints/student';

const PANEL =
  'rounded-[26px] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.88),rgba(10,13,26,0.96))] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]';

/**
 * Badges, en el idioma activo.
 *
 * Las fechas se formatean con el locale activo y no con uno fijo: una pagina
 * en ingles con la fecha en formato espanol delata que la traduccion es
 * superficial.
 */
export function BadgesView({ items }: { items: StudentBadgeRow[] }) {
  const { t, locale } = useI18n();
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale);

  return (
    <div className="space-y-10">
      <header className={`${PANEL} relative overflow-hidden p-8 lg:p-10`}>
        <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(50%_45%_at_85%_15%,rgba(94,109,255,0.18),transparent_70%)]" />
        <div className="relative">
          <Badge variant="brand" className="uppercase tracking-[0.18em]">
            <Award className="h-3 w-3" /> ERC-1155
          </Badge>
          <h1 className="mt-5 text-[32px] font-semibold leading-[1.05] tracking-tight text-[var(--color-fg)] lg:text-[40px]">
            {t.student.badges.title}
          </h1>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-[var(--color-fg-muted)]">
            {t.student.badges.body}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t.student.badges.empty.title}
          description={t.student.badges.empty.body}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((b) => (
            <article key={b.id} className={`${PANEL} flex flex-col p-5`}>
              <div className="relative aspect-square overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.04]">
                {b.imageUrl ? (
                  <img
                    src={b.imageUrl}
                    alt={b.collectionName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--color-fg-subtle)]">
                    <Award className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="mt-4 flex-1">
                <p className="truncate text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                  {b.institutionName ?? t.student.courses.institutionFallback}
                </p>
                <h3 className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-tight text-[var(--color-fg)]">
                  {b.collectionName}
                </h3>
                {b.collectionDescription ? (
                  <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
                    {b.collectionDescription}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 space-y-1.5 text-[11px] text-[var(--color-fg-subtle)]">
                <div className="flex justify-between">
                  <span>{t.student.badges.amount}</span>
                  <span className="font-mono text-[var(--color-fg)]">\u00d7{b.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.student.badges.received}</span>
                  <span>{fmt(b.issuedAt)}</span>
                </div>
                {b.studentWallet ? (
                  <div className="flex justify-between">
                    <span>{t.student.badges.wallet}</span>
                    <span className="font-mono text-[var(--color-fg)]">
                      {shortAddr(b.studentWallet)}
                    </span>
                  </div>
                ) : null}
              </div>
              {b.txHash ? (
                <Button asChild variant="ghost" size="sm" className="mt-3 self-start">
                  <Link
                    href={`https://polygonscan.com/tx/${b.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {t.student.badges.viewTx}
                  </Link>
                </Button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
