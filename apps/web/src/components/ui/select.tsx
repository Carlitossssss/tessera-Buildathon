'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-12 w-full appearance-none rounded-xl border bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-2.5 pr-11 text-[15px] text-[var(--color-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors',
          'border-[var(--color-border)] focus-visible:border-[var(--color-brand-400)] focus-visible:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand-500),transparent_60%)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          '[&>option]:bg-[#10162f] [&>option]:text-[var(--color-fg)]',
          invalid &&
            'border-[var(--color-danger-500)] focus-visible:border-[var(--color-danger-500)] focus-visible:ring-red-500/30',
          className,
        )}
        style={{ colorScheme: 'dark' }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-subtle)]"
      />
    </div>
  ),
);
Select.displayName = 'Select';
