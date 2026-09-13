'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandMark } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { AudienceSwitcher } from '@/components/layout/audience-switcher';
import { LanguageSwitcher } from '@tessera/i18n';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT, type Dictionary } from '@tessera/i18n';
import { cn } from '@/lib/utils';
import { authApi } from '@/lib/api/endpoints/auth';

/** Rutas fijas; la etiqueta la pone el idioma activo. */
const NAV_HREFS = [
  { href: '/cursos', key: 'courses' },
  { href: '/pricing', key: 'pricing' },
  { href: '/verify', key: 'verify' },
  { href: '/instituciones#faq', key: 'faq' },
] as const satisfies readonly { href: string; key: keyof Dictionary['header']['nav'] }[];

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  institution_admin: '/institution',
  teacher: '/teacher',
  student: '/student',
};

const ROLE_PROFILE: Record<string, string> = {
  admin: '/admin',
  institution_admin: '/institution/settings',
  teacher: '/teacher/profile',
  student: '/student/profile',
};

export function SiteHeader() {
  const t = useT();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken || session.authInvalid) {
      setSessionValid(false);
      if (session?.authInvalid) void signOut({ callbackUrl: '/', redirect: false });
      return;
    }

    let cancelled = false;
    setSessionValid(false);
    authApi
      .me(session.accessToken)
      .then(() => {
        if (!cancelled) setSessionValid(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSessionValid(false);
        void signOut({ callbackUrl: '/', redirect: false });
      });

    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, session?.authInvalid, status]);

  const role = session?.user?.role ?? 'student';
  const homeHref = ROLE_HOME[role] ?? '/student';
  const profileHref = ROLE_PROFILE[role] ?? homeHref;
  const userLabel = session?.user?.name ?? session?.user?.email ?? '';
  const initials = userLabel
    .split(/[ .@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
  const isAuthenticated = status === 'authenticated' && Boolean(session?.user) && sessionValid;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 px-4 pt-4 transition-all duration-300 sm:px-6',
        scrolled ? 'backdrop-blur-xl' : '',
      )}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex h-16 items-center justify-between rounded-2xl border border-[color-mix(in_oklab,var(--color-border),white_8%)] bg-[rgba(8,12,28,0.72)] px-4 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:px-5">
          <Link href="/" className="flex items-center" aria-label={t.shell.home}>
            <BrandMark />
          </Link>

          <nav className="hidden items-center gap-3 md:flex" aria-label={t.header.ariaMain}>
            <AudienceSwitcher />
            <span className="h-5 w-px bg-white/[0.06]" aria-hidden />
            {NAV_HREFS.map((item) => {
              const cleanHref = item.href.split('#')[0];
              const active = cleanHref === pathname;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[13px] font-semibold tracking-[-0.01em] transition-colors',
                    active
                      ? 'text-[var(--color-fg)]'
                      : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
                  )}
                >
                  {t.header.nav[item.key]}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {/* El idioma se elige antes de tener cuenta, así que vive junto a
                los botones de sesión y no dentro del menú de usuario. */}
            <LanguageSwitcher />
            {isAuthenticated ? (
              <UserMenu
                t={t}
                email={session.user.email ?? userLabel}
                homeHref={homeHref}
                initials={initials}
                profileHref={profileHref}
                userLabel={userLabel}
              />
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-2 text-sm font-semibold tracking-[-0.01em] text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
                >
                  {t.header.signIn}
                </Link>
                <Button asChild size="sm">
                  <Link href="/register">{t.header.signUp}</Link>
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            aria-label={open ? t.shell.closeMenu : t.shell.openMenu}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-fg)] md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="mx-auto mt-2 max-w-7xl md:hidden"
          >
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[rgba(10,13,26,0.94)] px-4 py-4 backdrop-blur-xl">
              <div className="mb-3">
                <AudienceSwitcher className="w-full justify-between" />
              </div>
              <nav className="flex flex-col gap-1">
                {NAV_HREFS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--color-fg-muted)] hover:bg-white/[0.05] hover:text-[var(--color-fg)]"
                  >
                    {t.header.nav[item.key]}
                  </Link>
                ))}
              </nav>
              {isAuthenticated ? (
                <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{initials || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                        {userLabel}
                      </p>
                      <p className="truncate text-xs text-[var(--color-fg-subtle)]">
                        {session.user.email}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button asChild size="sm">
                      <Link href={homeHref}>{t.header.dashboard}</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void signOut({ callbackUrl: '/' })}
                    >
                      {t.shell.signOut}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/login">{t.header.signIn}</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/register">{t.header.signUp}</Link>
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function UserMenu({
  t,
  email,
  homeHref,
  initials,
  profileHref,
  userLabel,
}: {
  t: Dictionary;
  email: string;
  homeHref: string;
  initials: string;
  profileHref: string;
  userLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/[0.03] py-1 pl-1 pr-3 text-sm text-[var(--color-fg)] transition hover:bg-white/[0.06]"
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback>{initials || 'U'}</AvatarFallback>
          </Avatar>
          <span className="max-w-[150px] truncate">{userLabel}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={homeHref}>{t.header.dashboard}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={profileHref}>{t.shell.profile}</Link>
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
          {t.shell.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
