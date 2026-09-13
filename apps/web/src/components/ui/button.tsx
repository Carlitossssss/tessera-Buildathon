'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold tracking-[-0.01em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand-500),transparent_30%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985]',
  {
    variants: {
      variant: {
        primary:
          'border border-[color-mix(in_oklab,#6b8cff,transparent_45%)] bg-[linear-gradient(180deg,#6b8cff_0%,#4f6df5_52%,#3f46f2_100%)] text-white shadow-[0_14px_34px_-18px_rgba(79,109,245,0.78)] hover:brightness-110',
        secondary:
          'border border-[var(--color-border)] bg-white/[0.04] text-[var(--color-fg)] hover:bg-white/[0.07] hover:border-[var(--color-border-strong)]',
        outline:
          'border border-[var(--color-border-strong)] bg-transparent text-[var(--color-fg)] hover:bg-white/[0.04]',
        ghost:
          'bg-transparent text-[var(--color-fg-muted)] hover:bg-white/[0.04] hover:text-[var(--color-fg)]',
        accent:
          'bg-gradient-to-br from-[var(--color-accent-400)] to-[var(--color-accent-600)] text-[#06231a] shadow-[0_10px_30px_-10px_rgba(34,201,138,0.55)] hover:opacity-95',
        danger: 'bg-[var(--color-danger-500)] text-white hover:bg-red-500',
        link: 'text-[var(--color-brand-300)] underline-offset-4 hover:underline px-0 py-0',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-[15px]',
        xl: 'h-14 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="4"
              />
              <path
                d="M22 12a10 10 0 0 1-10 10"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
            {children}
          </span>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
