'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { id: 'student', label: 'Estudiantes', href: '/', icon: GraduationCap },
  { id: 'institution', label: 'Instituciones', href: '/instituciones', icon: Building2 },
] as const;

export function AudienceSwitcher({ className }: { className?: string }) {
  const pathname = usePathname() ?? '/';
  const activeId =
    pathname.startsWith('/instituciones') || pathname.startsWith('/pricing')
      ? 'institution'
      : 'student';

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-xl border border-white/[0.06] bg-white/[0.025] p-1 backdrop-blur-sm',
        className,
      )}
      role="tablist"
      aria-label="Cambiar de público"
    >
      {ITEMS.map((item) => {
        const active = activeId === item.id;
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            href={item.href}
            role="tab"
            aria-selected={active}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold tracking-[-0.01em] transition-colors sm:px-3.5 sm:text-[13px]',
              active
                ? 'text-[var(--color-fg)]'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            {active ? (
              <motion.span
                layoutId="audience-switcher-active"
                className="absolute inset-0 rounded-lg bg-white/[0.08] shadow-[0_8px_18px_-12px_rgba(0,0,0,0.6)]"
                transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              />
            ) : null}
            <Icon className="relative h-3.5 w-3.5" />
            <span className="relative hidden sm:inline">{item.label}</span>
            <span className="relative sm:hidden">
              {item.id === 'student' ? 'Estudiantes' : 'Inst.'}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
