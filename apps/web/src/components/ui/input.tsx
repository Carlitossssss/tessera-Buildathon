'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex h-12 w-full rounded-xl border bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-2.5 text-[15px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors',
        'border-[var(--color-border)] focus-visible:border-[var(--color-brand-400)] focus-visible:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand-500),transparent_60%)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        invalid &&
          'border-[var(--color-danger-500)] focus-visible:border-[var(--color-danger-500)] focus-visible:ring-red-500/30',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
