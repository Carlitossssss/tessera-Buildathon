'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, MailCheck, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShimmerButton } from '@/components/fx/shimmer-button';
import { RoleTabs, type AuthRole } from '@/components/auth/role-tabs';
import { SocialButtons } from '@/components/auth/social-buttons';
import { useT, type Dictionary } from '@tessera/i18n';
import { authApi, ApiError } from '@/lib/api/endpoints/auth';

/** Los mensajes de validacion los lee una persona: viajan con el idioma. */
function baseSchemaFor(t: Dictionary) {
  return {
    email: z.string().trim().email(t.auth.validation.invalidEmail),
    password: z
      .string()
      .min(8, t.auth.validation.minChars)
      .regex(/[A-Z]/, t.auth.validation.needsUppercase)
      .regex(/[0-9]/, t.auth.validation.needsNumber),
    accept: z.literal(true, {
      errorMap: () => ({ message: t.auth.validation.acceptTerms }),
    }),
  };
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.com.ar',
  'yahoo.com.mx',
  'yahoo.es',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'zoho.com',
  'fastmail.com',
  'hey.com',
  'tutanota.com',
  'tuta.io',
  'yandex.com',
  'yandex.ru',
  'outlook.es',
  'hotmail.es',
  'hotmail.com.ar',
  'live.com.ar',
]);

function isInstitutionalEmail(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  return Boolean(domain && domain.includes('.') && !PERSONAL_EMAIL_DOMAINS.has(domain));
}

function institutionSchemaFor(t: Dictionary) {
  return z
    .object({
      ...baseSchemaFor(t),
      fullName: z.string().min(2, t.auth.validation.minTwoChars),
      institutionName: z.string().min(2, t.auth.validation.minTwoChars),
    })
    .refine((value) => isInstitutionalEmail(value.email), {
      path: ['email'],
      message: t.auth.validation.institutionalEmailRequired,
    });
}

function studentSchemaFor(t: Dictionary) {
  return z.object({
    ...baseSchemaFor(t),
    fullName: z.string().min(2, t.auth.validation.minTwoChars),
  });
}

type InstitutionValues = z.infer<ReturnType<typeof institutionSchemaFor>>;
type StudentValues = z.infer<ReturnType<typeof studentSchemaFor>>;
type TeacherInviteValues = Pick<StudentValues, 'fullName' | 'password' | 'accept'>;

interface PendingVerification {
  email: string;
  password: string;
  role: 'institution' | 'student';
  expiresAt: string;
}

function roleHome(role: 'institution' | 'student') {
  return role === 'student' ? '/student/profile' : '/institution/settings';
}

function passwordStrength(value: string): 0 | 1 | 2 | 3 | 4 {
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (value.length >= 8) score = (score + 1) as 1;
  if (/[A-Z]/.test(value)) score = (score + 1) as 2;
  if (/[0-9]/.test(value)) score = (score + 1) as 3;
  if (/[^A-Za-z0-9]/.test(value) && value.length >= 12) score = (score + 1) as 4;
  return score;
}

function PasswordMeter({ score }: { score: 0 | 1 | 2 | 3 | 4 }) {
  const t = useT();
  const labels = [
    t.auth.register.strength.weak,
    t.auth.register.strength.fair,
    t.auth.register.strength.good,
    t.auth.register.strength.strong,
    t.auth.register.strength.excellent,
  ];
  const colors = [
    'bg-[var(--color-danger-500)]',
    'bg-[var(--color-warning-500)]',
    'bg-[var(--color-warning-500)]',
    'bg-[var(--color-accent-500)]',
    'bg-[var(--color-accent-400)]',
  ];
  return (
    <div className="mt-1.5 flex items-center gap-2 sm:mt-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              score > i ? colors[score - 1] : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <span className="w-14 text-right text-[9px] uppercase tracking-widest text-[var(--color-fg-subtle)] sm:w-16 sm:text-[10px]">
        {labels[Math.max(0, score - 1)]}
      </span>
    </div>
  );
}

function VerificationStep({
  verification,
  code,
  setCode,
  verifying,
  onVerify,
  onEdit,
}: {
  verification: PendingVerification;
  code: string;
  setCode: (value: string) => void;
  verifying: boolean;
  onVerify: () => void;
  onEdit: () => void;
}) {
  const t = useT();
  return (
    <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.035] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--color-brand-500)]/35 bg-[var(--color-brand-500)]/12 text-[var(--color-brand-200)]">
          <MailCheck className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--color-fg)]">
            {t.auth.register.verify.title}
          </p>
          <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
            {t.auth.register.verify.body}{' '}
            <span className="font-semibold text-[var(--color-fg)]">{verification.email}</span>
            {t.auth.register.verify.bodyEnd}
          </p>
        </div>
      </div>

      <Field label={t.auth.register.verify.codeLabel} htmlFor="verificationCode">
        <Input
          id="verificationCode"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          value={code}
          maxLength={6}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          className="text-center text-base tracking-[0.45em]"
        />
      </Field>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <ShimmerButton type="button" disabled={verifying || code.length !== 6} onClick={onVerify}>
          {verifying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.auth.register.verify.verifying}
            </>
          ) : (
            t.auth.register.verify.submit
          )}
        </ShimmerButton>
        <button
          type="button"
          disabled={verifying}
          onClick={onEdit}
          className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-fg-muted)] transition hover:border-[var(--color-brand-400)]/55 hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t.auth.register.verify.edit}
        </button>
      </div>
    </div>
  );
}

function InstitutionForm({ plan }: { plan?: string }) {
  const t = useT();
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<PendingVerification | null>(null);
  const [code, setCode] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdValue, setPwdValue] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InstitutionValues>({
    resolver: zodResolver(institutionSchemaFor(t)),
    mode: 'onBlur',
  });

  const pwdReg = register('password');
  const strength = passwordStrength(pwdValue);

  const onSubmit = async (values: InstitutionValues) => {
    setSubmitting(true);
    try {
      const response = await authApi.register({
        fullName: values.fullName,
        institutionName: values.institutionName,
        email: values.email.trim(),
        password: values.password,
        plan,
      });
      setVerification({
        email: response.email,
        password: values.password,
        role: 'institution',
        expiresAt: response.expiresAt,
      });
      setCode('');
      toast.success(t.auth.register.toasts.codeSent);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.auth.register.toasts.createFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async () => {
    if (!verification || code.length !== 6) return;
    setVerifying(true);
    try {
      await authApi.verifyEmail(verification.email, code);
      const signed = await signIn('credentials', {
        email: verification.email,
        password: verification.password,
        redirect: false,
      });
      if (!signed || signed.error) {
        toast.success(t.auth.register.toasts.verifiedSignIn);
        window.location.assign('/login?role=institution');
        return;
      }
      toast.success(t.auth.register.toasts.workspaceCreated);
      window.location.assign(roleHome('institution'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.auth.register.toasts.verifyFailed);
    } finally {
      setVerifying(false);
    }
  };

  if (verification) {
    return (
      <VerificationStep
        verification={verification}
        code={code}
        setCode={setCode}
        verifying={verifying}
        onVerify={onVerify}
        onEdit={() => {
          setVerification(null);
          setCode('');
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.auth.fields.fullName} htmlFor="fullName" error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="Andrea Méndez"
            invalid={!!errors.fullName}
            className="tracking-[0.025em]"
            {...register('fullName')}
          />
        </Field>
        <Field
          label={t.auth.fields.institution}
          htmlFor="institutionName"
          error={errors.institutionName?.message}
        >
          <Input
            id="institutionName"
            autoComplete="organization"
            placeholder="Bootcamp Devstart"
            invalid={!!errors.institutionName}
            {...register('institutionName')}
          />
        </Field>
      </div>
      <Field label={t.auth.fields.institutionalEmail} htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="andrea@devstart.io"
          invalid={!!errors.email}
          {...register('email')}
        />
      </Field>
      <PasswordField
        showPwd={showPwd}
        setShowPwd={setShowPwd}
        register={pwdReg}
        onChangeValue={setPwdValue}
        error={errors.password?.message}
      />
      <PasswordMeter score={strength} />
      <Accept register={register('accept')} error={errors.accept?.message} />
      <ShimmerButton type="submit" disabled={submitting} className="w-full">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.auth.register.creatingWorkspace}
          </>
        ) : plan ? (
          t.auth.register.startPlan.replace('{plan}', plan)
        ) : (
          t.auth.register.createWorkspace
        )}
      </ShimmerButton>
    </form>
  );
}

function StudentForm() {
  const t = useT();
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<PendingVerification | null>(null);
  const [code, setCode] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdValue, setPwdValue] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StudentValues>({ resolver: zodResolver(studentSchemaFor(t)), mode: 'onBlur' });

  const pwdReg = register('password');
  const strength = passwordStrength(pwdValue);

  const onSubmit = async (values: StudentValues) => {
    setSubmitting(true);
    try {
      const response = await authApi.register({
        fullName: values.fullName,
        email: values.email.trim(),
        password: values.password,
      });
      setVerification({
        email: response.email,
        password: values.password,
        role: 'student',
        expiresAt: response.expiresAt,
      });
      setCode('');
      toast.success(t.auth.register.toasts.codeSent);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No pudimos crear tu cuenta');
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async () => {
    if (!verification || code.length !== 6) return;
    setVerifying(true);
    try {
      await authApi.verifyEmail(verification.email, code);
      const signed = await signIn('credentials', {
        email: verification.email,
        password: verification.password,
        redirect: false,
      });
      if (!signed || signed.error) {
        toast.success(t.auth.register.toasts.verifiedSignIn);
        window.location.assign('/login?role=student');
        return;
      }
      toast.success(t.auth.register.toasts.portfolioReady);
      window.location.assign(roleHome('student'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.auth.register.toasts.verifyFailed);
    } finally {
      setVerifying(false);
    }
  };

  if (verification) {
    return (
      <VerificationStep
        verification={verification}
        code={code}
        setCode={setCode}
        verifying={verifying}
        onVerify={onVerify}
        onEdit={() => {
          setVerification(null);
          setCode('');
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <Field label="Tu nombre" htmlFor="fullName" error={errors.fullName?.message}>
        <Input
          id="fullName"
          autoComplete="name"
          placeholder="Sofía Pérez"
          invalid={!!errors.fullName}
          className="tracking-[0.025em]"
          {...register('fullName')}
        />
      </Field>
      <Field label={t.auth.fields.email} htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="sofia@correo.com"
          invalid={!!errors.email}
          {...register('email')}
        />
      </Field>
      <PasswordField
        showPwd={showPwd}
        setShowPwd={setShowPwd}
        register={pwdReg}
        onChangeValue={setPwdValue}
        error={errors.password?.message}
      />
      <PasswordMeter score={strength} />
      <Accept register={register('accept')} error={errors.accept?.message} />
      <ShimmerButton type="submit" disabled={submitting} className="w-full">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.auth.register.creatingPortfolio}
          </>
        ) : (
          t.auth.register.createStudent
        )}
      </ShimmerButton>
    </form>
  );
}

function TeacherInviteForm({ inviteToken }: { inviteToken: string | null }) {
  const t = useT();
  const [loading, setLoading] = useState(Boolean(inviteToken));
  const [invitation, setInvitation] = useState<Awaited<
    ReturnType<typeof authApi.teacherInvitation>
  > | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [pwdValue, setPwdValue] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TeacherInviteValues>({
    resolver: zodResolver(
      z.object({
        fullName: z.string().min(2, t.auth.validation.minTwoChars),
        password: baseSchemaFor(t).password,
        accept: baseSchemaFor(t).accept,
      }),
    ),
    mode: 'onBlur',
  });

  useEffect(() => {
    if (!inviteToken) {
      setLoading(false);
      setLoadError(t.auth.register.invite.needLink);
      return;
    }
    let active = true;
    authApi
      .teacherInvitation(inviteToken)
      .then((data) => {
        if (!active) return;
        setInvitation(data);
        if (!data.roleAllowed) {
          setLoadError(t.auth.register.invite.wrongRole);
        }
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof ApiError ? err.message : t.auth.register.invite.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [inviteToken, t]);

  const pwdReg = register('password');
  const strength = passwordStrength(pwdValue);

  const onSubmit = async (values: TeacherInviteValues) => {
    if (!inviteToken || !invitation || invitation.existingUser) return;
    setSubmitting(true);
    try {
      await authApi.registerTeacherFromInvite(inviteToken, {
        fullName: values.fullName,
        password: values.password,
      });
      const signed = await signIn('credentials', {
        email: invitation.email,
        password: values.password,
        redirect: false,
      });
      if (!signed || signed.error) {
        toast.success(t.auth.register.toasts.teacherCreated);
        window.location.assign('/login?role=teacher');
        return;
      }
      toast.success(t.auth.register.toasts.teacherCreatedProfile);
      window.location.assign('/teacher/profile');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.auth.register.toasts.teacherFailed);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-5 text-sm text-[var(--color-fg-muted)]">
        {t.auth.register.invite.validating}
      </div>
    );
  }

  if (loadError || !invitation) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-5 text-sm text-[var(--color-fg-muted)]">
        <p className="text-[var(--color-fg)]">{loadError}</p>
      </div>
    );
  }

  if (invitation.existingUser) {
    return (
      <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-5 text-sm text-[var(--color-fg-muted)]">
        <p className="text-[var(--color-fg)]">
          {t.auth.register.invite.existingPrefix} {invitation.email}
          {t.auth.register.invite.existingSuffix}
        </p>
        {invitation.course ? (
          <p>
            {t.auth.register.invite.invitedCourse}{' '}
            <span className="font-medium text-[var(--color-fg)]">{invitation.course.title}</span>
          </p>
        ) : null}
        <ShimmerButton asChild className="w-full">
          <Link href={`/login?role=teacher&invite=${encodeURIComponent(inviteToken ?? '')}`}>
            {t.auth.register.invite.signInAndAccept}
          </Link>
        </ShimmerButton>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-4 text-xs text-[var(--color-fg-muted)]">
        <p>
          {t.auth.register.invite.invitationFor}{' '}
          <span className="font-semibold text-[var(--color-fg)]">{invitation.email}</span>
        </p>
        <p className="mt-1">
          {t.auth.register.invite.institution}{' '}
          <span className="font-semibold text-[var(--color-fg)]">
            {invitation.institution?.name ?? 'Tessera'}
          </span>
        </p>
        {invitation.course ? (
          <p className="mt-1">
            {t.auth.register.invite.course}{' '}
            <span className="font-semibold text-[var(--color-fg)]">{invitation.course.title}</span>
          </p>
        ) : null}
      </div>
      <Field label="Tu nombre" htmlFor="fullName" error={errors.fullName?.message}>
        <Input
          id="fullName"
          autoComplete="name"
          placeholder={invitation.name ?? 'María García'}
          invalid={!!errors.fullName}
          className="tracking-[0.025em]"
          {...register('fullName')}
        />
      </Field>
      <PasswordField
        showPwd={showPwd}
        setShowPwd={setShowPwd}
        register={pwdReg}
        onChangeValue={setPwdValue}
        error={errors.password?.message}
      />
      <PasswordMeter score={strength} />
      <Accept register={register('accept')} error={errors.accept?.message} />
      <ShimmerButton type="submit" disabled={submitting} className="w-full">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.auth.register.creatingAccount}
          </>
        ) : (
          t.auth.register.createTeacher
        )}
      </ShimmerButton>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-[12px]">
        {label}
      </Label>
      {children}
      {error ? <p className="text-[11px] text-[var(--color-danger-500)]">{error}</p> : null}
    </div>
  );
}

function PasswordField({
  showPwd,
  setShowPwd,
  register,
  onChangeValue,
  error,
}: {
  showPwd: boolean;
  setShowPwd: (v: boolean | ((p: boolean) => boolean)) => void;
  register: ReturnType<ReturnType<typeof useForm>['register']>;
  onChangeValue: (v: string) => void;
  error?: string;
}) {
  const t = useT();
  return (
    <div className="space-y-1">
      <Label htmlFor="password" className="text-[12px]">
        {t.auth.fields.password}
      </Label>
      <div className="relative">
        <Input
          id="password"
          type={showPwd ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder={t.auth.fields.passwordPlaceholder}
          invalid={!!error}
          {...register}
          onChange={(e) => {
            register.onChange(e);
            onChangeValue(e.target.value);
          }}
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
      {error ? (
        <p className="text-[11px] text-[var(--color-danger-500)]">{error}</p>
      ) : (
        <p className="text-[10.5px] text-[var(--color-fg-subtle)]">
          {t.auth.fields.passwordHint}
        </p>
      )}
    </div>
  );
}

function Accept({
  register,
  error,
}: {
  register: ReturnType<ReturnType<typeof useForm>['register']>;
  error?: string;
}) {
  const t = useT();
  return (
    <div className="space-y-1">
      <label className="flex items-start gap-2.5 text-[11px] text-[var(--color-fg-muted)]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] bg-white/5 accent-[var(--color-brand-500)]"
          {...register}
        />
        <span className="leading-relaxed">
          {t.auth.register.accept.prefix}{' '}
          <Link
            href="/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand-300)] hover:text-[var(--color-brand-200)]"
          >
            {t.auth.register.accept.terms}
          </Link>{' '}
          {t.auth.register.accept.and}{' '}
          <Link
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand-300)] hover:text-[var(--color-brand-200)]"
          >
            {t.auth.register.accept.privacy}
          </Link>
          .
        </span>
      </label>
      {error ? (
        <p className="text-[11px] sm:text-xs text-[var(--color-danger-500)]">{error}</p>
      ) : null}
    </div>
  );
}

function TeacherInviteWall() {
  const t = useT();
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-5 text-sm text-[var(--color-fg-muted)]">
      <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-200)]">
        <ShieldAlert className="h-3 w-3" />
        {t.auth.register.teacherWall.badge}
      </div>
      <p className="text-[var(--color-fg)]">{t.auth.register.teacherWall.title}</p>
      <p className="mt-2 leading-relaxed">
        {t.auth.register.teacherWall.body}{' '}
        <span className="font-semibold text-[var(--color-fg)]">
          {t.auth.register.teacherWall.panel}
        </span>
        .
      </p>
      <Link
        href="/register?role=institution"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-brand-300)] hover:text-[var(--color-brand-200)]"
      >
        {t.auth.register.teacherWall.cta}
      </Link>
    </div>
  );
}

function titlesFor(role: AuthRole, t: Dictionary) {
  return t.auth.register.titles[role];
}

function RegisterScreen() {
  const t = useT();
  const params = useSearchParams();
  const plan = params.get('plan') ?? undefined;
  const invite = params.get('invite');
  const role: AuthRole = useMemo(() => {
    const r = params.get('role');
    if (r === 'student') return 'student';
    if (r === 'teacher') return 'teacher';
    return 'institution';
  }, [params]);

  const copy = titlesFor(role, t);

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

      {role === 'teacher' ? (
        invite ? (
          <TeacherInviteForm inviteToken={invite} />
        ) : (
          <TeacherInviteWall />
        )
      ) : (
        <>
          <SocialButtons audience={role} />
          {role === 'institution' ? <InstitutionForm plan={plan} /> : <StudentForm />}
        </>
      )}

      <div className="flex flex-col items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3.5 text-[11.5px] text-[var(--color-fg-muted)] sm:flex-row">
        <span>{t.auth.register.haveAccount}</span>
        <Link
          href={`/login?role=${role}`}
          className="font-semibold text-[var(--color-brand-300)] transition hover:text-[var(--color-brand-200)]"
        >
          {t.auth.register.signIn}
        </Link>
      </div>
    </motion.div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterScreen />
    </Suspense>
  );
}
