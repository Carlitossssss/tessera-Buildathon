'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TextRevealProps {
  text: string;
  className?: string;
}

function Word({
  children,
  progress,
  range,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return (
    <motion.span style={{ opacity }} className="inline-block">
      {children}
    </motion.span>
  );
}

export function TextReveal({ text, className }: TextRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 80%', 'end 50%'],
  });
  const words = text.split(' ');

  return (
    <div ref={ref} className={cn('relative leading-tight', className)}>
      <p className="flex flex-wrap gap-x-2 gap-y-1">
        {words.map((w, i) => {
          const start = i / words.length;
          const end = (i + 1) / words.length;
          return (
            <Word key={`${w}-${i}`} progress={scrollYProgress} range={[start, end]}>
              {w}
            </Word>
          );
        })}
      </p>
    </div>
  );
}
