'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, GraduationCap } from 'lucide-react';
import { useT } from '@tessera/i18n';
import { cn } from '@/lib/utils';

export type AuthRole = 'institution' | 'student' | 'teacher';

/** Los identificadores no cambian con el idioma; la etiqueta sí. */
const TABS = [
  { id: 'institution' as const, key: 'institution' as const, icon: Building2 },
  { id: 'student' as const, key: 'student' as const, icon: GraduationCap },
];

export function RoleTabs({ active }: { active: AuthRole }) {
  const t = useT();
  const pathname = usePathname();
  const params = useSearchParams();

  // Si el rol activo es teacher (acceso por invitación), no mostramos los tabs:
  // mostramos un chip dedicado para no romper el flujo de invitación.
  if (active === 'teacher') {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-200)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-300)]" />
        {t.auth.roles.teacherChip}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={t.auth.roles.ariaLabel}
      className="relative inline-flex items-center gap-1 rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-1 backdrop-blur"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const next = new URLSearchParams(params.toString());
        next.set('role', tab.id);
        const href = `${pathname}?${next.toString()}`;
        return (
          <Link
            key={tab.id}
            href={href}
            role="tab"
            aria-selected={isActive}
            scroll={false}
            className={cn(
              'relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold tracking-[-0.01em] transition-colors',
              isActive
                ? 'text-[var(--color-fg)]'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="role-tab-active"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="absolute inset-0 -z-10 rounded-xl bg-[linear-gradient(180deg,rgba(132,161,255,0.18),rgba(132,161,255,0.06))] ring-1 ring-inset ring-white/10"
              />
            ) : null}
            <tab.icon className="h-4 w-4" />
            {t.auth.roles[tab.key]}
          </Link>
        );
      })}
    </div>
  );
}
