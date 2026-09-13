'use client';

import { cn } from '@/lib/utils';

interface DotPatternProps {
  className?: string;
  size?: number;
  radius?: number;
  color?: string;
}

/**
 * Patrón de puntos sutil para fondos (estilo Magic UI DotPattern).
 */
export function DotPattern({
  className,
  size = 22,
  radius = 1,
  color = 'rgba(255,255,255,0.08)',
}: DotPatternProps) {
  return (
    <svg
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      width="100%"
      height="100%"
    >
      <defs>
        <pattern
          id="dot-pattern"
          x="0"
          y="0"
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={size / 2} cy={size / 2} r={radius} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-pattern)" />
    </svg>
  );
}
