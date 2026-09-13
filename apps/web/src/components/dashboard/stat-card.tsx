import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatProps {
  label: string;
  value: string;
  hint?: string;
  trend?: { delta: string; positive?: boolean };
  icon?: LucideIcon;
  className?: string;
}

export function StatCard({ label, value, hint, trend, icon: Icon, className }: StatProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5 transition-colors hover:border-[var(--color-border-strong)]',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          {label}
        </p>
        {Icon ? (
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-200)]">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      <p className="mt-4 text-[28px] font-semibold leading-[1.1] tracking-tight text-[var(--color-fg)] tabular-nums">
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--color-fg-subtle)]">
        {trend ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
              trend.positive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300',
            )}
          >
            {trend.delta}
          </span>
        ) : null}
        {hint ? <span className="leading-snug">{hint}</span> : null}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white/[0.015] px-6 py-16 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-[17px] font-semibold tracking-tight text-[var(--color-fg)]">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-[var(--color-fg-muted)]">
        {description}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

interface SectionHeadingProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function SectionHeading({ title, description, actions }: SectionHeadingProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h2 className="text-[20px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-fg-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
