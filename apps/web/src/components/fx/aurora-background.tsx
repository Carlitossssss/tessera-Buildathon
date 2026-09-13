'use client';

import { cn } from '@/lib/utils';

interface AuroraProps {
  className?: string;
  intensity?: 'soft' | 'medium' | 'strong';
}

/**
 * Aurora gradient background — capas radiales animadas con CSS puro,
 * inspirado en Aceternity Aurora pero sin dependencias extra.
 */
export function AuroraBackground({ className, intensity = 'medium' }: AuroraProps) {
  const opacity = intensity === 'soft' ? 0.35 : intensity === 'strong' ? 0.85 : 0.6;

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ opacity }}
    >
      <div className="aurora-blob aurora-blob--a" />
      <div className="aurora-blob aurora-blob--b" />
      <div className="aurora-blob aurora-blob--c" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--color-bg)_75%)]" />

      <style jsx>{`
        .aurora-blob {
          position: absolute;
          border-radius: 9999px;
          filter: blur(90px);
          mix-blend-mode: screen;
          will-change: transform;
        }
        .aurora-blob--a {
          width: 720px;
          height: 720px;
          left: -10%;
          top: -25%;
          background: radial-gradient(closest-side, rgba(58, 96, 255, 0.55), transparent 70%);
          animation: aurora-drift-a 22s ease-in-out infinite alternate;
        }
        .aurora-blob--b {
          width: 620px;
          height: 620px;
          right: -10%;
          top: 10%;
          background: radial-gradient(closest-side, rgba(122, 242, 199, 0.4), transparent 70%);
          animation: aurora-drift-b 26s ease-in-out infinite alternate;
        }
        .aurora-blob--c {
          width: 800px;
          height: 800px;
          left: 20%;
          bottom: -40%;
          background: radial-gradient(closest-side, rgba(160, 96, 255, 0.45), transparent 70%);
          animation: aurora-drift-c 30s ease-in-out infinite alternate;
        }
        @keyframes aurora-drift-a {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform: translate3d(120px, 80px, 0) scale(1.15);
          }
        }
        @keyframes aurora-drift-b {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform: translate3d(-140px, 100px, 0) scale(1.1);
          }
        }
        @keyframes aurora-drift-c {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform: translate3d(80px, -120px, 0) scale(1.2);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .aurora-blob {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
