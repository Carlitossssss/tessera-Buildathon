'use client';

import { cn } from '@/lib/utils';

interface MarqueeProps {
  children: React.ReactNode;
  pauseOnHover?: boolean;
  reverse?: boolean;
  duration?: number;
  className?: string;
  fade?: boolean;
  vertical?: boolean;
}

/**
 * Marquee infinito sin saltos. Duplica children dos veces y desplaza.
 */
export function Marquee({
  children,
  pauseOnHover = true,
  reverse = false,
  duration = 32,
  className,
  fade = true,
  vertical = false,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        'group relative flex w-full overflow-hidden',
        vertical ? 'flex-col h-full' : 'flex-row',
        className,
      )}
      style={
        fade
          ? {
              maskImage: vertical
                ? 'linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)'
                : 'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
              WebkitMaskImage: vertical
                ? 'linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)'
                : 'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
            }
          : undefined
      }
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden={i === 1 ? true : undefined}
          className={cn(
            'flex shrink-0 items-center gap-6 px-3',
            vertical ? 'flex-col' : 'flex-row',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
          )}
          style={{
            animation: `${vertical ? 'marquee-y' : 'marquee-x'} ${duration}s linear infinite`,
            animationDirection: reverse ? 'reverse' : 'normal',
          }}
        >
          {children}
        </div>
      ))}
      <style jsx>{`
        @keyframes marquee-x {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-100%);
          }
        }
        @keyframes marquee-y {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(-100%);
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
