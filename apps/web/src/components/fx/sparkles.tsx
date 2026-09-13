'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface SparklesProps {
  className?: string;
  density?: number;
  color?: string;
  minSize?: number;
  maxSize?: number;
}

/**
 * Polvo brillante en el fondo. Live re-roll cada N segundos.
 */
export function Sparkles({
  className,
  density = 50,
  color = '#a8c3ff',
  minSize = 1,
  maxSize = 2.4,
}: SparklesProps) {
  const [seed, setSeed] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setSeed((s) => s + 1), 6000);
    return () => clearInterval(id);
  }, []);

  const dots = useMemo(
    () =>
      mounted
        ? Array.from({ length: density }).map((_, i) => ({
            id: `${seed}-${i}`,
            top: Math.random() * 100,
            left: Math.random() * 100,
            size: minSize + Math.random() * (maxSize - minSize),
            delay: Math.random() * 4,
            duration: 2 + Math.random() * 3,
          }))
        : [],
    [density, minSize, maxSize, seed, mounted],
  );

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {dots.map((d) => (
        <span
          key={d.id}
          className="sparkle"
          style={{
            top: `${d.top}%`,
            left: `${d.left}%`,
            width: `${d.size}px`,
            height: `${d.size}px`,
            background: color,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
          }}
        />
      ))}
      <style jsx>{`
        .sparkle {
          position: absolute;
          border-radius: 9999px;
          opacity: 0;
          animation: sparkle-fade ease-in-out infinite;
          box-shadow: 0 0 6px currentColor;
        }
        @keyframes sparkle-fade {
          0%,
          100% {
            opacity: 0;
            transform: scale(0.6);
          }
          50% {
            opacity: 0.9;
            transform: scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .sparkle {
            animation: none;
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
