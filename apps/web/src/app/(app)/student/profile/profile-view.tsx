'use client';

import { Award, BookOpen, GraduationCap, User as UserIcon } from 'lucide-react';
import { useI18n } from '@tessera/i18n';
import { Badge } from '@/components/ui/badge';
import type { StudentProfileData } from '@/lib/api/endpoints/student';
import type { UserProfile } from '@/lib/api/endpoints/auth';
import { ProfileForm } from './profile-form';
import { UserDetailedProfileForm } from '../../user-detailed-profile-form';

const PANEL =
  'rounded-[26px] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.88),rgba(10,13,26,0.96))] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]';

export function ProfileView({
  data,
  profile,
}: {
  data: StudentProfileData | null;
  profile: UserProfile | null;
}) {
  const { t, locale } = useI18n();

  if (!data) {
    return (
      <div className={`${PANEL} p-10 text-center`}>
        <p className="text-[14px] text-[var(--color-fg-muted)]">{t.student.profile.loadFailed}</p>
      </div>
    );
  }

  const initials = (data.name ?? data.email)
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-10">
      <header className={`${PANEL} relative overflow-hidden p-8 lg:p-10`}>
        <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(50%_45%_at_85%_15%,rgba(94,109,255,0.18),transparent_70%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.03]">
            {data.avatarUrl ? (
              <img src={data.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[28px] font-semibold tracking-tight text-[var(--color-brand-200)]">
                {initials || <UserIcon className="h-8 w-8" />}
              </span>
            )}
          </div>
          <div>
            <Badge variant="brand" className="uppercase tracking-[0.18em]">
              {t.student.profile.role}
            </Badge>
            <h1 className="mt-4 text-[30px] font-semibold leading-[1.05] tracking-tight text-[var(--color-fg)] lg:text-[36px]">
              {data.name ?? t.student.profile.noName}
            </h1>
            <p className="mt-1 text-[14px] text-[var(--color-fg-muted)]">{data.email}</p>
            <p className="mt-2 text-[12px] text-[var(--color-fg-subtle)]">
              {t.student.profile.createdOn.replace(
                '{date}',
                new Date(data.createdAt).toLocaleDateString(locale),
              )}
              {data.emailVerifiedAt
                ? t.student.profile.emailVerified
                : t.student.profile.emailUnverified}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={t.student.profile.stats.enrolments}
          value={data.stats.enrollments}
          icon={BookOpen}
        />
        <Stat
          label={t.student.profile.stats.completed}
          value={data.stats.completed}
          icon={GraduationCap}
        />
        <Stat
          label={t.student.profile.stats.credentials}
          value={data.stats.certificates}
          icon={Award}
        />
      </div>

      <section className={`${PANEL} p-8`}>
        {profile?.status === 'rejected' && profile.rejectionReason ? (
          <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-brand-500)]/10 p-4 text-sm text-[var(--color-fg-muted)]">
            <p className="font-semibold text-[var(--color-fg)]">
              {t.student.profile.rejected.title}
            </p>
            <p className="mt-1">{profile.rejectionReason}</p>
          </div>
        ) : profile?.status === 'pending' ? (
          <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-4 text-sm text-[var(--color-fg-muted)]">
            {t.student.profile.pending}
          </div>
        ) : null}
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
          {t.student.profile.personalTitle}
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
          {t.student.profile.personalBody}
        </p>
        <div className="mt-7">
          <UserDetailedProfileForm initialFullName={data.name} profile={profile} role="student" />
        </div>
      </section>

      <section className={`${PANEL} p-8`}>
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
          {t.student.profile.publicTitle}
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
          {t.student.profile.publicBody}
        </p>
        <div className="mt-7">
          <ProfileForm
            initial={{
              name: data.name ?? '',
              locale: (data.locale as 'es' | 'en' | 'pt' | null) ?? 'es',
              avatarUrl: data.avatarUrl ?? '',
            }}
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`${PANEL} flex items-center gap-4 p-5`}>
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          {label}
        </p>
        <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--color-fg)]">
          {value}
        </p>
      </div>
    </div>
  );
}
