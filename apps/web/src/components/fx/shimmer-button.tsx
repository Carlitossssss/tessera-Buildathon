'use client';

import * as React from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

/**
 * Botón con shimmer barriendo el borde y un fondo metálico (estilo Magic UI ShimmerButton).
 * Acepta asChild para envolver un <Link>; usa Slottable para inyectar children sin perder los layers visuales.
 */
export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  ({ className, asChild, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        className={cn(
          'group relative isolate inline-flex h-12 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-[color-mix(in_oklab,var(--color-brand-300),transparent_48%)] bg-[linear-gradient(180deg,#6b8cff_0%,#4f6df5_52%,#3f46f2_100%)] px-7 text-sm font-semibold tracking-[-0.01em] text-white shadow-[0_18px_36px_-18px_rgba(79,109,245,0.82)] transition-transform active:scale-[0.985]',
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className="shimmer-ring pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
          style={{
            background:
              'conic-gradient(from var(--shimmer-angle, 0deg), transparent 0%, rgba(255,255,255,0.85) 6%, transparent 14%)',
          }}
        />

        <span
          aria-hidden
          className="pointer-events-none absolute inset-[1.5px] -z-10 rounded-[inherit] bg-[linear-gradient(180deg,#6b8cff_0%,#4f6df5_52%,#3f46f2_100%)]"
        />

        <Slottable>{children}</Slottable>
      </Comp>
    );
  },
);

ShimmerButton.displayName = 'ShimmerButton';
