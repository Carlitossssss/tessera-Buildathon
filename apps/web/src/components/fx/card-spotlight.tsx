'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface CardSpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  color?: string;
  children: React.ReactNode;
}

/**
 * Card que ilumina un halo bajo el cursor. Inspirado en Aceternity Spotlight Card.
 */
export function CardSpotlight({
  className,
  children,
  size = 360,
  color = 'rgba(120, 160, 255, 0.16)',
  ...props
}: CardSpotlightProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  return (
    <div
      ref={ref}
      onMouseEnter={() => setPos((p) => ({ ...p, visible: true }))}
      onMouseLeave={() => setPos((p) => ({ ...p, visible: false }))}
      onMouseMove={(e) => {
        const rect = ref.current!.getBoundingClientRect();
        setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true });
      }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02] transition-colors hover:border-[var(--color-border-strong)]',
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: pos.visible ? 1 : 0,
          background: `radial-gradient(${size}px circle at ${pos.x}px ${pos.y}px, ${color}, transparent 60%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
