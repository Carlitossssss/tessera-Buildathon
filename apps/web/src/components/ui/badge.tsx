import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'border-[var(--color-border)] bg-white/5 text-[var(--color-fg-muted)]',
        brand:
          'border-[var(--color-brand-700)]/40 bg-[var(--color-brand-500)]/15 text-[var(--color-brand-200)]',
        accent:
          'border-[var(--color-accent-600)]/40 bg-[var(--color-accent-500)]/15 text-[var(--color-accent-400)]',
        success: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
        warning: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
        danger: 'border-red-500/40 bg-red-500/15 text-red-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
