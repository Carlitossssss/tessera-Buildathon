'use client';

import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SpotlightProps {
  className?: string;
  size?: number;
  color?: string;
}

/**
 * Spotlight que sigue al mouse dentro del contenedor padre.
 * El padre debe tener `position: relative` y `overflow: hidden`.
 */
export function Spotlight({
  className,
  size = 520,
  color = 'rgba(120, 160, 255, 0.18)',
}: SpotlightProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true });
    };
    const onLeave = () => setPos((p) => ({ ...p, visible: false }));
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 transition-opacity duration-300',
        className,
      )}
      style={{
        opacity: pos.visible ? 1 : 0,
        background: `radial-gradient(${size}px circle at ${pos.x}px ${pos.y}px, ${color}, transparent 65%)`,
      }}
    />
  );
}
