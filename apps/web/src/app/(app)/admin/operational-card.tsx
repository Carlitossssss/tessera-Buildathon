import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';

export function OperationalCard({
  href,
  value,
  badge,
  title,
  description,
  delta,
  deltaLabel,
  neutralZero = false,
  className,
}: {
  href?: string;
  value: number | string;
  badge: string;
  title: string;
  description: string;
  delta?: number | string;
  deltaLabel?: string;
  neutralZero?: boolean;
  className?: string;
}) {
  const numericDelta = typeof delta === 'number' ? delta : null;
  const showNeutral = neutralZero && numericDelta === 0;
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <p className="text-[28px] font-semibold leading-[1.1] tracking-tight text-[var(--color-fg)] tabular-nums">
          {typeof value === 'number' ? formatNumber(value) : value}
        </p>
        <span className="rounded-xl bg-[var(--color-accent-500)]/15 px-3 py-1 text-xs font-semibold text-[var(--color-accent-400)]">
          {badge}
        </span>
      </div>
      <div className="mt-5">
        <h3 className="text-[15px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]">
          {title}
        </h3>
        <p className="mt-2 text-[13.5px] leading-6 text-[var(--color-fg-muted)]">{description}</p>
      </div>
      {delta !== undefined || deltaLabel ? (
        <div className="mt-auto flex items-center gap-3 pt-4 text-[12px] text-[var(--color-fg-muted)]">
          {delta !== undefined ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-center font-mono text-[10px] font-semibold uppercase tracking-wider tabular-nums',
                showNeutral
                  ? 'bg-white/[0.05] text-[var(--color-fg)]'
                  : 'bg-[var(--color-accent-500)]/15 text-[var(--color-accent-400)]',
              )}
            >
              {numericDelta !== null
                ? numericDelta > 0
                  ? `+${formatNumber(numericDelta)}`
                  : formatNumber(numericDelta)
                : delta}
            </span>
          ) : null}
          {deltaLabel ? <span>{deltaLabel}</span> : null}
        </div>
      ) : null}
    </>
  );
  const cardClass = cn(
    'group flex h-full flex-col rounded-2xl border border-[var(--color-border)] bg-[radial-gradient(circle_at_50%_0%,rgba(53,85,213,0.1),transparent_46%),rgba(255,255,255,0.015)] p-5 shadow-[0_18px_60px_-48px_rgba(0,0,0,0.95)] transition hover:border-[var(--color-border-strong)] hover:bg-white/[0.03]',
    className,
  );

  return href ? (
    <Link href={href} className={cardClass}>
      {content}
    </Link>
  ) : (
    <div className={cardClass}>{content}</div>
  );
}
