'use client';

import { cn } from '@/lib/utils';

/**
 * Grid retro estilo "GridSmallBackground" (Aceternity).
 * Útil como fondo de secciones técnicas.
 */
export function GridBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_75%)]',
        className,
      )}
    />
  );
}
