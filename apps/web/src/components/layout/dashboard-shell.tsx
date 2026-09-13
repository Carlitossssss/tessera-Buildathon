'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, Menu, ShieldAlert, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandMark } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LanguageSwitcher, useT } from '@tessera/i18n';
import { navByRole, type NavSection } from './dashboard-nav-config';
import type { Role } from '@/server/auth';
import { meApi } from '@/lib/api/endpoints/me';
import { cn } from '@/lib/utils';

interface DashboardShellProps {
  role: Role;
  user: { name?: string | null; email: string };
  /** Acepta nodo, no solo texto: el titulo puede venir de un componente que
   *  lee el idioma activo, y el layout que lo monta es de servidor. */
  title: React.ReactNode;
  description?: React.ReactNode;
  institutionStatus?: string | null;
  institutionSuspensionReason?: string | null;
  institutionAccessToken?: string | null;
  institutionProfileSubmittedAt?: string | null;
  userProfileStatus?: string | null;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardShell({
  role,
  user,
  title,
  description,
  institutionStatus,
  institutionSuspensionReason,
  institutionAccessToken,
  institutionProfileSubmittedAt,
  userProfileStatus,
  actions,
  children,
}: DashboardShellProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [liveInstitutionStatus, setLiveInstitutionStatus] = useState(institutionStatus ?? null);
  const effectiveInstitutionStatus = liveInstitutionStatus ?? institutionStatus ?? null;
  const institutionAdminBlocked =
    role === 'institution_admin' &&
    effectiveInstitutionStatus &&
    effectiveInstitutionStatus !== 'approved';
  const institutionProfileRequired =
    role === 'institution_admin' &&
    effectiveInstitutionStatus === 'pending' &&
    !institutionProfileSubmittedAt;
  const teacherInstitutionSuspended =
    role === 'teacher' &&
    (effectiveInstitutionStatus === 'suspended' || effectiveInstitutionStatus === 'revoked');
  const teacherProfileRequired =
    role === 'teacher' && (userProfileStatus ?? 'incomplete') !== 'approved';
  const studentProfileStatus = userProfileStatus ?? 'incomplete';
  const studentProfileRequired = role === 'student' && studentProfileStatus === 'incomplete';
  const studentAwaitingApproval =
    role === 'student' &&
    (studentProfileStatus === 'pending' || studentProfileStatus === 'rejected');
  // Cada motivo explica qué hacer a continuación, no sólo que algo está
  // cerrado. Viven en el diccionario porque los lee una persona.
  const pendingReason = t.shell.blocked.pending;
  const rejectedReason = t.shell.blocked.rejected;
  const profileRequiredReason = t.shell.blocked.profileRequired;
  const suspendedReason = t.shell.blocked.suspended;
  const teacherProfileReason = t.shell.blocked.teacherProfile;
  const studentProfileReason = t.shell.blocked.studentProfile;
  const studentApprovalReason =
    studentProfileStatus === 'rejected'
      ? t.shell.blocked.studentRejected
      : t.shell.blocked.studentPending;

  useEffect(() => {
    setLiveInstitutionStatus(institutionStatus ?? null);
  }, [institutionStatus]);

  useEffect(() => {
    if (role !== 'institution_admin') return;
    if (!liveInstitutionStatus || liveInstitutionStatus === 'approved') return;
    const accessToken: string = session?.accessToken ?? institutionAccessToken ?? '';
    if (!accessToken) return;

    let cancelled = false;
    let lastStatus = liveInstitutionStatus;

    async function refreshInstitutionStatus() {
      try {
        const res = await meApi.institution(accessToken);
        if (cancelled) return;
        const nextStatus = res.institution.status;
        setLiveInstitutionStatus(nextStatus);
        if (lastStatus !== 'approved' && nextStatus === 'approved') {
          router.refresh();
        }
        lastStatus = nextStatus;
      } catch {
        // Si el API no responde, mantenemos el estado actual y reintentamos luego.
      }
    }

    void refreshInstitutionStatus();
    const interval = window.setInterval(() => {
      if (!document.hidden) void refreshInstitutionStatus();
    }, 5000);
    window.addEventListener('focus', refreshInstitutionStatus);
    document.addEventListener('visibilitychange', refreshInstitutionStatus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshInstitutionStatus);
      document.removeEventListener('visibilitychange', refreshInstitutionStatus);
    };
  }, [institutionAccessToken, liveInstitutionStatus, role, router, session?.accessToken]);

  useEffect(() => {
    if (!institutionProfileRequired) return;
    if (pathname === '/institution/settings') return;
    router.replace('/institution/settings');
  }, [institutionProfileRequired, pathname, router]);

  const sections: NavSection[] = (navByRole(t)[role] ?? []).map((section) => ({
    ...section,
    items: section.items.map((item) =>
      institutionProfileRequired && item.href !== '/institution/settings'
        ? { ...item, disabledReason: profileRequiredReason }
        : studentProfileRequired && item.href !== '/student/profile'
          ? { ...item, disabledReason: studentProfileReason }
          : studentAwaitingApproval &&
              (item.href === '/student' || item.href === '/student/courses')
            ? { ...item, disabledReason: studentApprovalReason }
            : teacherProfileRequired && item.href !== '/teacher/profile'
              ? { ...item, disabledReason: teacherProfileReason }
              : institutionAdminBlocked &&
                  (item.href === '/institution/certificates' ||
                    item.href === '/institution/courses' ||
                    item.href === '/institution/badges')
                ? {
                    ...item,
                    disabledReason:
                      effectiveInstitutionStatus === 'revoked'
                        ? rejectedReason
                        : effectiveInstitutionStatus === 'suspended'
                          ? suspendedReason
                          : pendingReason,
                  }
                : teacherInstitutionSuspended &&
                    (item.href === '/teacher/courses' ||
                      item.href === '/teacher/students' ||
                      item.href === '/teacher/grading')
                  ? { ...item, disabledReason: suspendedReason }
                  : item,
    ),
  }));
  const [mobileOpen, setMobileOpen] = useState(false);

  // Rutas que necesitan workspace inmersivo (sin sidebar global ni header).
  const fullscreenRoutes = ['/institution/templates/editor'];
  const isFullscreen = fullscreenRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));

  if (isFullscreen) {
    return <div className="min-h-screen bg-[var(--color-bg)]">{children}</div>;
  }

  const initials = (user.name ?? user.email)
    .split(/[ .@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]/60 lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-[var(--color-border)] px-5">
          <Link href="/" className="inline-flex" aria-label={t.shell.home}>
            <BrandMark />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5 scrollbar-thin">
          {sections.map((sec) => (
            <div key={sec.label} className="mb-6">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)]">
                {sec.label}
              </p>
              <ul className="space-y-0.5">
                {sec.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== '/' && pathname.startsWith(item.href + '/'));
                  const disabled = Boolean(item.disabledReason);
                  return (
                    <li key={item.href}>
                      {disabled ? (
                        <span
                          title={item.disabledReason}
                          aria-disabled="true"
                          className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--color-fg-subtle)] opacity-60"
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </span>
                      ) : (
                        <Link
                          href={item.href}
                          target={item.openInNewTab ? '_blank' : undefined}
                          rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                            active
                              ? 'bg-white/5 text-[var(--color-fg)]'
                              : 'text-[var(--color-fg-muted)] hover:bg-white/[0.03] hover:text-[var(--color-fg)]',
                          )}
                        >
                          <item.icon
                            className={cn('h-4 w-4', active && 'text-[var(--color-brand-300)]')}
                          />
                          {item.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-[var(--color-border)] p-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-3 text-xs text-[var(--color-fg-muted)]">
            <p className="font-semibold text-[var(--color-fg)]">{t.shell.help.title}</p>
            <p className="mt-1 leading-relaxed">{t.shell.help.body}</p>
            <Button asChild size="sm" variant="ghost" className="mt-2 w-full justify-start px-2">
              <a href="mailto:support@tessera.io">support@tessera.io</a>
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[rgba(10,13,26,0.78)] px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={t.shell.openMenu}
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-fg)] lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]">
                {title}
              </h1>
              {description ? (
                <p className="hidden truncate text-[12px] leading-snug text-[var(--color-fg-subtle)] sm:block">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {actions}
            {/* El idioma se cambia desde cualquier pantalla del panel, sin
                entrar a ajustes: por eso vive en la cabecera y no dentro del
                menú de usuario. */}
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/[0.03] py-1 pl-1 pr-3 text-sm text-[var(--color-fg)] hover:bg-white/[0.06]"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{initials || 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[140px] truncate sm:inline">
                    {user.name ?? user.email}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href={
                      role === 'student'
                        ? '/student/profile'
                        : role === 'teacher'
                          ? '/teacher/profile'
                          : '/institution/settings'
                    }
                  >
                    {t.shell.profile}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/legal/privacy">{t.shell.privacy}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[var(--color-danger-500)] focus:text-[var(--color-danger-500)]"
                  onSelect={(e) => {
                    e.preventDefault();
                    void signOut({ callbackUrl: '/' });
                  }}
                >
                  <LogOut className="h-4 w-4" /> {t.shell.signOut}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
          {teacherInstitutionSuspended ? (
            <div className="mb-8 rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-5 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-brand-300)]" />
                <div>
                  <p className="font-semibold text-[var(--color-fg)]">
                    {t.shell.suspendedNotice.title}
                  </p>
                  <p className="mt-1">
                    {institutionSuspensionReason ?? t.shell.suspendedNotice.body}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {children}
        </main>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.22 }}
              className="absolute inset-y-0 left-0 w-72 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <BrandMark />
                <LanguageSwitcher />
                <button
                  type="button"
                  aria-label={t.shell.closeMenu}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-fg)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav>
                {sections.map((sec) => (
                  <div key={sec.label} className="mb-5">
                    <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)]">
                      {sec.label}
                    </p>
                    {sec.items.map((item) => {
                      const active =
                        pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(item.href + '/'));
                      const disabled = Boolean(item.disabledReason);
                      if (disabled) {
                        return (
                          <span
                            key={item.href}
                            title={item.disabledReason}
                            aria-disabled="true"
                            className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--color-fg-subtle)] opacity-60"
                          >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                          </span>
                        );
                      }
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          target={item.openInNewTab ? '_blank' : undefined}
                          rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm',
                            active
                              ? 'bg-white/5 text-[var(--color-fg)]'
                              : 'text-[var(--color-fg-muted)] hover:bg-white/[0.03]',
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
