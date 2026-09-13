'use client';

import { cn } from '@/lib/utils';

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderRadius?: number;
}

/**
 * Anillo de luz que recorre el borde del contenedor (estilo Magic UI BorderBeam).
 * Requiere padre con `position: relative` y `overflow: hidden`.
 */
export function BorderBeam({
  className,
  size = 220,
  duration = 8,
  delay = 0,
  colorFrom = '#6e8cff',
  colorTo = '#22c98a',
  borderRadius = 24,
}: BorderBeamProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ borderRadius }}
    >
      <div
        className="absolute inset-0"
        style={{
          padding: 1,
          borderRadius,
          background: `conic-gradient(from var(--bb-angle, 0deg), transparent 0%, ${colorFrom} ${size / 8}%, ${colorTo} ${size / 4}%, transparent ${size / 2}%)`,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          animation: `border-beam-spin ${duration}s linear infinite`,
          animationDelay: `${delay}s`,
        }}
      />
      <style jsx>{`
        @property --bb-angle {
          syntax: '<angle>';
          inherits: false;
          initial-value: 0deg;
        }
        @keyframes border-beam-spin {
          to {
            --bb-angle: 360deg;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          div {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
