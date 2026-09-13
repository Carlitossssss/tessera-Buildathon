'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface MeteorsProps {
  count?: number;
  className?: string;
}

/**
 * Lluvia de meteoros para fondos. Inspirado en Aceternity Meteors.
 */
export function Meteors({ count = 18, className }: MeteorsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const meteors = useMemo(
    () =>
      mounted
        ? Array.from({ length: count }).map((_, i) => ({
            id: i,
            top: `${Math.random() * -40}%`,
            left: `${Math.random() * 100}%`,
            delay: `${(Math.random() * 4).toFixed(2)}s`,
            duration: `${(Math.random() * 4 + 4).toFixed(2)}s`,
          }))
        : [],
    [count, mounted],
  );

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {meteors.map((m) => (
        <span
          key={m.id}
          className="meteor"
          style={{
            top: m.top,
            left: m.left,
            animationDelay: m.delay,
            animationDuration: m.duration,
          }}
        />
      ))}
      <style jsx>{`
        .meteor {
          position: absolute;
          width: 2px;
          height: 2px;
          border-radius: 9999px;
          background: #fff;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
          transform: rotate(215deg);
          animation-name: meteor-fall;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
        }
        .meteor::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 60px;
          height: 1px;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.85), transparent);
          transform: translateY(-50%);
        }
        @keyframes meteor-fall {
          0% {
            transform: rotate(215deg) translateX(0);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: rotate(215deg) translateX(700px);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .meteor {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
