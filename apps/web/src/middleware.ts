import { auth } from '@/server/auth';
import { NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/institution', '/teacher', '/student', '/admin'] as const;
const AUTH_PAGES = ['/login', '/register', '/forgot'];
const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  institution_admin: '/institution',
  teacher: '/teacher',
  student: '/student',
};

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Usuario autenticado no puede acceder a páginas de auth
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isReauth = req.nextUrl.searchParams.get('reauth') === '1';
  const hasInvite = Boolean(req.nextUrl.searchParams.get('invite'));
  if (isAuthPage && session && !isReauth && hasInvite) {
    const url = new URL('/accept-invite', req.nextUrl);
    const invite = req.nextUrl.searchParams.get('invite');
    const role = req.nextUrl.searchParams.get('role');
    if (invite) url.searchParams.set('invite', invite);
    if (role) url.searchParams.set('role', role);
    return NextResponse.redirect(url);
  }
  if (isAuthPage && session && !isReauth && !hasInvite) {
    const role = session.user?.role ?? 'student';
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/student', req.nextUrl));
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!isProtected) return NextResponse.next();

  if (!session) {
    const url = new URL('/login', req.nextUrl);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const role = session.user?.role ?? 'student';
  const home = ROLE_HOME[role] ?? '/student';
  const allowed =
    role === 'admin' ||
    (role === 'institution_admin' && pathname.startsWith('/institution')) ||
    (role === 'teacher' && pathname.startsWith('/teacher')) ||
    (role === 'student' && pathname.startsWith('/student'));

  if (!allowed) return NextResponse.redirect(new URL(home, req.nextUrl));
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api/auth|api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
