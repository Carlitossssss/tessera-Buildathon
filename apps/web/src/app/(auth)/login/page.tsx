'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSession, signIn, useSession } from 'next-auth/react';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShimmerButton } from '@/components/fx/shimmer-button';
import { RoleTabs, type AuthRole } from '@/components/auth/role-tabs';
import { SocialButtons } from '@/components/auth/social-buttons';
import { useT, type Dictionary } from '@tessera/i18n';
import { authApi, ApiError } from '@/lib/api/endpoints/auth';
import { meApi } from '@/lib/api/endpoints/me';

/** Los mensajes de validacion los lee una persona: viajan con el idioma. */
function loginSchemaFor(t: Dictionary) {
  return z.object({
    email: z.string().trim().email(t.auth.validation.invalidEmail),
    password: z.string().min(8, t.auth.validation.minChars),
  });
}
type LoginValues = z.infer<ReturnType<typeof loginSchemaFor>>;

function roleHome(role: AuthRole | 'admin' | 'institution_admin') {
  if (role === 'student') return '/student';
  if (role === 'teacher') return '/teacher';
  if (role === 'admin') return '/admin';
  return '/institution';
}

function invitationDestination(
  signedRole: AuthRole | 'admin' | 'institution_admin',
  courseId?: string | null,
) {
  if (courseId) {
    return signedRole === 'teacher'
      ? `/teacher/courses/${courseId}`
      : `/institution/courses/${courseId}`;
  }
  return signedRole === 'teacher' ? '/teacher/profile' : '/institution';
}

function sanitizeNext(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  if (
    raw === '/' ||
    raw.startsWith('/login') ||
    raw.startsWith('/register') ||
    raw.startsWith('/forgot')
  ) {
    return null;
  }
  return raw;
}

function resolveRole(raw: string | null, hasInvite: boolean): AuthRole {
  if (raw === 'teacher' && hasInvite) return 'teacher';
  if (raw === 'teacher') return 'teacher';
  if (raw === 'student') return 'student';
  return 'institution';
}

function titlesFor(role: AuthRole, t: Dictionary) {
  return t.auth.login.titles[role];
}

function LoginForm({
  role,
  next,
  invite,
}: {
  role: AuthRole;
  next: string | null;
  invite: string | null;
}) {
  const t = useT();
  const [submitting, setSubmitting] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const acceptedInviteRef = useRef<string | null>(null);
  const { data: activeSession, status: sessionStatus } = useSession();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchemaFor(t)), mode: 'onBlur' });

  useEffect(() => {
    const signedRole = activeSession?.user?.role;
    const accessToken = activeSession?.accessToken;
    if (
      !invite ||
      !accessToken ||
      sessionStatus !== 'authenticated' ||
      acceptedInviteRef.current === invite ||
      (signedRole !== 'teacher' && signedRole !== 'institution_admin')
    ) {
      return;
    }

    let cancelled = false;
    acceptedInviteRef.current = invite;
    setAcceptingInvite(true);
    authApi
      .acceptTeacherInvitation(invite, accessToken)
      .then((accepted) => {
        if (cancelled) return;
        toast.success(t.auth.login.toasts.inviteAccepted);
        window.location.assign(invitationDestination(signedRole, accepted.courseId));
      })
      .catch((err) => {
        if (cancelled) return;
        acceptedInviteRef.current = null;
        setAcceptingInvite(false);
        toast.error(err instanceof ApiError ? err.message : t.auth.login.toasts.inviteFailed);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSession?.accessToken, activeSession?.user?.role, invite, sessionStatus, t]);

  const onSubmit = async (values: LoginValues) => {
    if (acceptingInvite) return;
    setSubmitting(true);
    const email = values.email.trim();
    let accessToken: string;
    let accessTokenExpiresAt: string;
    try {
      const login = await authApi.login(email, values.password);
      accessToken = login.token;
      accessTokenExpiresAt = login.tokenExpiresAt;
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError) {
        if (err.status === 401) {
          toast.error(t.auth.login.toasts.invalidCredentials);
        } else if (err.status === 429) {
          toast.error(err.message);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error(t.auth.login.toasts.noApi);
      }
      return;
    }

    const res = await signIn('credentials', {
      email,
      password: values.password,
      accessToken,
      accessTokenExpiresAt,
      redirect: false,
    });
    setSubmitting(false);

    if (!res || res.error) {
      toast.error(t.auth.login.toasts.noSession);
      return;
    }

    const session = await getSession();
    const signedRole = session?.user?.role ?? role;
    let destination = sanitizeNext(next) ?? roleHome(signedRole);
    if (invite && (signedRole === 'teacher' || signedRole === 'institution_admin')) {
      try {
        const accepted = await authApi.acceptTeacherInvitation(invite, accessToken);
        destination = invitationDestination(signedRole, accepted.courseId);
        toast.success(t.auth.login.toasts.inviteAccepted);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t.auth.login.toasts.inviteFailed);
        return;
      }
    }
    if (signedRole === 'institution_admin') {
      const institution = await meApi.institution(accessToken).catch(() => null);
      if (
        institution?.institution.status === 'pending' &&
        !institution.institution.profileSubmittedAt
      ) {
        destination = '/institution/settings';
      }
    }
    if (signedRole === 'student' || signedRole === 'teacher') {
      const current = await authApi.me(accessToken).catch(() => null);
      if (current?.user.profile?.status !== 'approved') {
        destination = signedRole === 'student' ? '/student/profile' : '/teacher/profile';
      }
    }

    toast.success(t.auth.login.toasts.signedIn);
    window.location.assign(destination);
  };

  const placeholder = t.auth.login.placeholders[role];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[12px] sm:text-[13px]">
          {role === 'student' ? t.auth.fields.email : t.auth.fields.institutionalEmail}
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={placeholder}
          className="[letter-spacing:0.035em]"
          invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email ? (
          <p className="text-[11px] sm:text-xs text-[var(--color-danger-500)]">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-[12px] sm:text-[13px]">
            {t.auth.fields.password}
          </Label>
          <Link
            href="/forgot"
            className="text-xs text-[var(--color-brand-300)] transition hover:text-[var(--color-brand-200)]"
          >
            {t.auth.fields.forgot}
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPwd ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            className="[letter-spacing:0.08em]"
            invalid={!!errors.password}
            {...register('password')}
          />
          <button
            type="button"
            aria-label={showPwd ? t.auth.fields.hidePassword : t.auth.fields.showPassword}
            onClick={() => setShowPwd((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)] transition hover:text-[var(--color-fg)]"
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password ? (
          <p className="text-[11px] sm:text-xs text-[var(--color-danger-500)]">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <ShimmerButton type="submit" disabled={submitting || acceptingInvite} className="w-full">
        {submitting || acceptingInvite ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {acceptingInvite ? t.auth.login.acceptingInvite : t.auth.login.validating}
          </>
        ) : (
          t.auth.login.submit
        )}
      </ShimmerButton>
    </form>
  );
}

function TeacherInviteWall() {
  const t = useT();
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-5 text-sm text-[var(--color-fg-muted)]">
      <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-200)]">
        <ShieldAlert className="h-3 w-3" />
        {t.auth.login.teacherWall.badge}
      </div>
      <p className="text-[var(--color-fg)]">{t.auth.login.teacherWall.title}</p>
      <p className="mt-2 leading-relaxed">{t.auth.login.teacherWall.body}</p>
    </div>
  );
}

function LoginScreen() {
  const t = useT();
  const params = useSearchParams();
  const next = sanitizeNext(params.get('next'));
  const invite = params.get('invite');
  const role = useMemo(() => resolveRole(params.get('role'), Boolean(invite)), [params, invite]);
  const copy = titlesFor(role, t);
  const socialCallbackUrl = next ?? roleHome(role);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4 sm:space-y-5"
    >
      <RoleTabs active={role} />

      <header className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-200)]">
          {copy.eyebrow}
        </p>
        <h1 className="text-[1.5rem] font-semibold leading-[1.05] tracking-[-0.035em] text-[var(--color-fg)] sm:text-[1.65rem]">
          {copy.title}
        </h1>
        <p className="text-[12.5px] leading-snug text-[var(--color-fg-muted)]">{copy.sub}</p>
      </header>

      {role === 'teacher' ? <TeacherInviteWall /> : null}

      <>
        <SocialButtons next={socialCallbackUrl} audience={role} />
        <Suspense fallback={null}>
          <LoginForm role={role} next={next} invite={invite} />
        </Suspense>
      </>

      <div className="flex flex-col items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3.5 text-[11.5px] text-[var(--color-fg-muted)] sm:flex-row">
        <span>{t.auth.login.noAccount}</span>
        <Link
          href={`/register?role=${role === 'teacher' ? 'institution' : role}`}
          className="font-semibold text-[var(--color-brand-300)] transition hover:text-[var(--color-brand-200)]"
        >
          {role === 'student' ? t.auth.login.createStudent : t.auth.login.createInstitution}
        </Link>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
