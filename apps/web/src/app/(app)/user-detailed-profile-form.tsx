'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { TesseraDateInput } from '@/components/ui/tessera-date-input';
import type { UserProfile } from '@/lib/api/endpoints/auth';
import { updateDetailedUserProfileAction } from './student/actions';
import { useI18n, type Dictionary } from '@tessera/i18n';

/**
 * Codigos de pais con su nombre en el idioma activo.
 *
 * El orden alfabetico tambien sigue el idioma: un pais ordenado como si
 * estuviera en espanol, mostrado en ingles, se leeria desordenado.
 */
function countriesFor(t: Dictionary, locale: string) {
  const c = t.account.detailedProfile.countries;
  return (Object.keys(c) as Array<keyof typeof c>)
    .map((code) => ({ code, name: c[code] }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

function documentTypesFor(t: Dictionary, locale: string) {
  const d = t.account.detailedProfile.documentTypes;
  return [d.idCard, d.dni, d.passport, d.cedula, d.other].sort((a, b) =>
    a.localeCompare(b, locale),
  );
}

function onlyPhone(value: string) {
  return value.replace(/[^\d+\s().-]/g, '');
}

function noDigits(value: string) {
  return value.replace(/\d/g, '');
}

export function UserDetailedProfileForm({
  initialFullName,
  profile,
  role,
}: {
  initialFullName?: string | null;
  profile?: UserProfile | null;
  role: 'student' | 'teacher';
}) {
  const { t, locale } = useI18n();
  const dp = t.account.detailedProfile;
  const COUNTRIES = useMemo(() => countriesFor(t, locale), [t, locale]);
  const DOCUMENT_TYPES = useMemo(() => documentTypesFor(t, locale), [t, locale]);
  const router = useRouter();
  const fallbackName = splitFullName(initialFullName);
  const [values, setValues] = useState({
    firstName: profile?.firstName?.trim() ? profile.firstName : fallbackName.firstName,
    lastName: profile?.lastName?.trim() ? profile.lastName : fallbackName.lastName,
    documentType: profile?.documentType ?? DOCUMENT_TYPES[0]!,
    documentNumber: profile?.documentNumber ?? '',
    birthDate: profile?.birthDate ?? '',
    phone: profile?.phone ?? '',
    country: profile?.country ?? '',
    city: profile?.city ?? '',
    addressLine: profile?.addressLine ?? '',
  });
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [profileCompleted, setProfileCompleted] = useState(
    Boolean(
      profile?.profileCompletedAt ||
        profile?.profileSubmittedAt ||
        (profile?.status && profile.status !== 'incomplete'),
    ),
  );
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const complete = Object.values(values).every((value) => value.trim().length > 0);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    if (!complete) {
      setFeedback({ kind: 'err', msg: dp.requiredFields });
      return;
    }
    startTransition(async () => {
      const wasProfileCompleted = profileCompleted;
      const res = await updateDetailedUserProfileAction(values);
      if (!res.ok) {
        setFeedback({ kind: 'err', msg: res.error });
        return;
      }
      setProfileCompleted(true);
      router.refresh();
      setFeedback({
        kind: 'ok',
        msg: wasProfileCompleted
          ? dp.changesSaved
          : role === 'student'
            ? dp.studentSubmitted
            : dp.teacherCompleted,
      });
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5 lg:max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dp.fields.firstName} htmlFor="firstName">
          <Input
            id="firstName"
            value={values.firstName}
            onChange={(e) => setValues((v) => ({ ...v, firstName: noDigits(e.target.value) }))}
            required
          />
        </Field>
        <Field label={dp.fields.lastName} htmlFor="lastName">
          <Input
            id="lastName"
            value={values.lastName}
            onChange={(e) => setValues((v) => ({ ...v, lastName: noDigits(e.target.value) }))}
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dp.fields.documentType} htmlFor="documentType">
          <Select
            id="documentType"
            value={values.documentType}
            onChange={(e) => setValues((v) => ({ ...v, documentType: e.target.value }))}
          >
            {DOCUMENT_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={dp.fields.documentNumber} htmlFor="documentNumber">
          <Input
            id="documentNumber"
            value={values.documentNumber}
            onChange={(e) => setValues((v) => ({ ...v, documentNumber: e.target.value.trim() }))}
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dp.fields.birthDate} htmlFor="birthDate">
          <TesseraDateInput
            id="birthDate"
            value={values.birthDate}
            maxDate={today}
            yearNavigation
            onChange={(value) => setValues((v) => ({ ...v, birthDate: value }))}
            className="h-10"
          />
        </Field>
        <Field label={dp.fields.phone} htmlFor="phone">
          <Input
            id="phone"
            inputMode="tel"
            value={values.phone}
            onChange={(e) => setValues((v) => ({ ...v, phone: onlyPhone(e.target.value) }))}
            required
            placeholder="+591 70000000"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dp.fields.country} htmlFor="country">
          <Select
            id="country"
            value={values.country}
            onChange={(e) => setValues((v) => ({ ...v, country: e.target.value }))}
            required
          >
            <option value="">{dp.fields.selectCountry}</option>
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={dp.fields.city} htmlFor="city">
          <Input
            id="city"
            value={values.city}
            onChange={(e) => setValues((v) => ({ ...v, city: noDigits(e.target.value) }))}
            required
          />
        </Field>
      </div>

      <Field label={dp.fields.addressLine} htmlFor="addressLine">
        <Input
          id="addressLine"
          value={values.addressLine}
          onChange={(e) => setValues((v) => ({ ...v, addressLine: e.target.value }))}
          required
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!complete || pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {dp.saving}
            </>
          ) : role === 'student' ? (
            profileCompleted ? (
              dp.saveChanges
            ) : (
              dp.submitForReview
            )
          ) : profileCompleted ? (
            dp.saveChanges
          ) : (
            dp.completeProfile
          )}
        </Button>
        {feedback ? (
          <span
            className={
              feedback.kind === 'ok'
                ? 'text-[12.5px] text-emerald-300'
                : 'text-[12.5px] text-red-300'
            }
          >
            {feedback.msg}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function splitFullName(fullName?: string | null) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
