'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

const OFFSET: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 28 },
  down: { x: 0, y: -28 },
  left: { x: 32, y: 0 },
  right: { x: -32, y: 0 },
  none: { x: 0, y: 0 },
};

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Direccion desde la que entra el contenido. */
  from?: Direction;
  delay?: number;
  duration?: number;
  /** Margen del viewport: negativo dispara la animacion antes de llegar al borde. */
  margin?: string;
  once?: boolean;
}

/**
 * Envoltorio de entrada por scroll. Respeta prefers-reduced-motion: si el
 * usuario lo activa, el contenido aparece sin desplazamiento.
 */
export function Reveal({
  children,
  className,
  from = 'up',
  delay = 0,
  duration = 0.7,
  margin = '-12% 0px -12% 0px',
  once = true,
}: RevealProps) {
  const reduced = useReducedMotion();
  const offset = reduced ? OFFSET.none : OFFSET[from];

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, margin }}
      transition={{
        duration: reduced ? 0.2 : duration,
        delay: reduced ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Contenedor que escalona la entrada de sus hijos directos envueltos en
 * <RevealItem>. Evita tener que calcular delays a mano.
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.09,
  delay = 0,
  margin = '-10% 0px -10% 0px',
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  margin?: string;
}) {
  const reduced = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduced ? 0 : stagger,
        delayChildren: reduced ? 0 : delay,
      },
    },
  };

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  from = 'up',
}: {
  children: ReactNode;
  className?: string;
  from?: Direction;
}) {
  const reduced = useReducedMotion();
  const offset = reduced ? OFFSET.none : OFFSET[from];
  const variants: Variants = {
    hidden: { opacity: 0, x: offset.x, y: offset.y },
    show: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: reduced ? 0.2 : 0.65, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}
