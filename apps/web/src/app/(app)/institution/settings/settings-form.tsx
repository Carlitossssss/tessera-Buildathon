'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { AlertCircle, Check, RotateCcw, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  hasInstitutionProfileErrors,
  sanitizeInstitutionContactName,
  sanitizeInstitutionPhone,
  validateInstitutionProfile,
  type InstitutionProfileValues,
} from '@/lib/validation/institution-profile';
import { updateInstitutionAction } from '../actions';

interface Props {
  initial: {
    name: string;
    website: string | null;
    description: string | null;
    country: string | null;
    legalName: string | null;
    taxId: string | null;
    addressLine: string | null;
    city: string | null;
    stateRegion: string | null;
    postalCode: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    accreditationId: string | null;
    profileSubmittedAt: string | null;
  };
}

const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: 'AR', name: 'Argentina' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BR', name: 'Brasil' },
  { code: 'CA', name: 'Canadá' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CU', name: 'Cuba' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'ES', name: 'España' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'FR', name: 'Francia' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'IT', name: 'Italia' },
  { code: 'MX', name: 'México' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'PA', name: 'Panamá' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Perú' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'GB', name: 'Reino Unido' },
  { code: 'DO', name: 'República Dominicana' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VE', name: 'Venezuela' },
].sort((a, b) => a.name.localeCompare(b.name, 'es'));

const DESC_MAX = 2000;

export function SettingsForm({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const initialState = useMemo(
    () => ({
      name: initial.name ?? '',
      website: initial.website ?? '',
      description: initial.description ?? '',
      country: (initial.country ?? '').toUpperCase(),
      legalName: initial.legalName ?? '',
      taxId: initial.taxId ?? '',
      addressLine: initial.addressLine ?? '',
      city: initial.city ?? '',
      stateRegion: initial.stateRegion ?? '',
      postalCode: initial.postalCode ?? '',
      contactName: initial.contactName ?? '',
      contactEmail: initial.contactEmail ?? '',
      contactPhone: initial.contactPhone ?? '',
      accreditationId: initial.accreditationId ?? '',
    }),
    [initial],
  );

  const [values, setValues] = useState(initialState);

  // Sincroniza si cambia el initial (post revalidate)
  useEffect(() => setValues(initialState), [initialState]);

  const dirty =
    values.name !== initialState.name ||
    values.website !== initialState.website ||
    values.description !== initialState.description ||
    values.country !== initialState.country ||
    values.legalName !== initialState.legalName ||
    values.taxId !== initialState.taxId ||
    values.addressLine !== initialState.addressLine ||
    values.city !== initialState.city ||
    values.stateRegion !== initialState.stateRegion ||
    values.postalCode !== initialState.postalCode ||
    values.contactName !== initialState.contactName ||
    values.contactEmail !== initialState.contactEmail ||
    values.contactPhone !== initialState.contactPhone ||
    values.accreditationId !== initialState.accreditationId;

  const profileComplete = [
    values.name,
    values.website,
    values.description,
    values.country,
    values.legalName,
    values.taxId,
    values.addressLine,
    values.city,
    values.stateRegion,
    values.contactName,
    values.contactEmail,
    values.contactPhone,
    values.accreditationId,
  ].every((value) => value.trim().length > 0);
  const profileSubmitted = Boolean(initial.profileSubmittedAt);
  const validationErrors = useMemo(
    () => validateInstitutionProfile(values as InstitutionProfileValues),
    [values],
  );
  const hasValidationErrors = hasInstitutionProfileErrors(validationErrors);
  const canSubmit = dirty && (profileSubmitted || profileComplete) && !hasValidationErrors;
  const fieldError = (field: keyof InstitutionProfileValues) =>
    submitAttempted || values[field].trim().length > 0 ? validationErrors[field] : undefined;

  function handleSubmit(form: FormData) {
    setSubmitAttempted(true);
    if (hasValidationErrors) {
      setToast({ ok: false, text: 'Revisa los campos marcados antes de enviar.' });
      setTimeout(() => setToast(null), 4000);
      return;
    }
    startTransition(async () => {
      const res = await updateInstitutionAction(form);
      if (res.ok) {
        setToast({ ok: true, text: 'Cambios guardados correctamente' });
        router.refresh();
      } else setToast({ ok: false, text: res.error });
      setTimeout(() => setToast(null), 4000);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-2xl backdrop-blur ${
            toast.ok
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
              : 'border-red-500/40 bg-red-500/15 text-red-200'
          }`}
          role="status"
        >
          {toast.ok ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.text}
        </div>
      )}

      {!profileSubmitted ? (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-500)]/10 p-4 text-sm text-[var(--color-fg-muted)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-300)]" />
          <div>
            <p className="font-semibold text-[var(--color-fg)]">
              Completa la validación institucional
            </p>
            <p className="mt-1 leading-relaxed">
              Necesitamos estos datos para enviar tu universidad a revisión. Hasta completarlos,
              permanecerás en esta sección.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre comercial *</Label>
          <Input
            id="name"
            name="name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            invalid={Boolean(fieldError('name'))}
            required
            minLength={2}
            maxLength={200}
          />
          <FieldError message={fieldError('name')} />
          <p className="text-xs text-[var(--color-fg-subtle)]">
            Aparece en certificados y en la página de verificación pública.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">País *</Label>
          <Select
            id="country"
            name="country"
            value={values.country}
            onChange={(e) => setValues((v) => ({ ...v, country: e.target.value }))}
            required
          >
            <option value="">— Selecciona país —</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </Select>
          <FieldError message={fieldError('country')} />
          <p className="text-xs text-[var(--color-fg-subtle)]">
            Usado para requisitos de facturación.
          </p>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="website">Sitio web *</Label>
          <Input
            id="website"
            name="website"
            type="url"
            value={values.website}
            onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))}
            placeholder="https://tu-institucion.edu"
            invalid={Boolean(fieldError('website'))}
            required
          />
          <FieldError message={fieldError('website')} />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="description">Descripción *</Label>
            <span
              className={`text-xs tabular-nums ${
                values.description.length > DESC_MAX
                  ? 'text-red-400'
                  : 'text-[var(--color-fg-subtle)]'
              }`}
            >
              {values.description.length} / {DESC_MAX}
            </span>
          </div>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            maxLength={DESC_MAX}
            minLength={20}
            required
            className={`w-full rounded-xl border bg-white/[0.02] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-brand-500)] focus:outline-none ${
              fieldError('description')
                ? 'border-[var(--color-danger-500)]'
                : 'border-[var(--color-border)]'
            }`}
            placeholder="Descripción pública de tu institución que verán quienes verifiquen un certificado."
          />
          <FieldError message={fieldError('description')} />
        </div>
      </div>

      <div className="grid gap-6 border-t border-[var(--color-border)] pt-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="legalName">Razón social *</Label>
          <Input
            id="legalName"
            name="legalName"
            value={values.legalName}
            onChange={(e) => setValues((v) => ({ ...v, legalName: e.target.value }))}
            invalid={Boolean(fieldError('legalName'))}
            required
            minLength={2}
            maxLength={240}
          />
          <FieldError message={fieldError('legalName')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxId">Identificación fiscal *</Label>
          <Input
            id="taxId"
            name="taxId"
            value={values.taxId}
            onChange={(e) => setValues((v) => ({ ...v, taxId: e.target.value }))}
            invalid={Boolean(fieldError('taxId'))}
            required
            minLength={2}
            maxLength={80}
          />
          <FieldError message={fieldError('taxId')} />
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="addressLine">Dirección institucional *</Label>
          <Input
            id="addressLine"
            name="addressLine"
            value={values.addressLine}
            onChange={(e) => setValues((v) => ({ ...v, addressLine: e.target.value }))}
            invalid={Boolean(fieldError('addressLine'))}
            required
            minLength={2}
            maxLength={240}
          />
          <FieldError message={fieldError('addressLine')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Ciudad *</Label>
          <Input
            id="city"
            name="city"
            value={values.city}
            onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
            invalid={Boolean(fieldError('city'))}
            required
            minLength={2}
            maxLength={120}
          />
          <FieldError message={fieldError('city')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stateRegion">Provincia / Región *</Label>
          <Input
            id="stateRegion"
            name="stateRegion"
            value={values.stateRegion}
            onChange={(e) => setValues((v) => ({ ...v, stateRegion: e.target.value }))}
            invalid={Boolean(fieldError('stateRegion'))}
            required
            minLength={2}
            maxLength={120}
          />
          <FieldError message={fieldError('stateRegion')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Código postal</Label>
          <Input
            id="postalCode"
            name="postalCode"
            value={values.postalCode}
            onChange={(e) => setValues((v) => ({ ...v, postalCode: e.target.value }))}
            invalid={Boolean(fieldError('postalCode'))}
            maxLength={40}
          />
          <FieldError message={fieldError('postalCode')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accreditationId">Registro / acreditación *</Label>
          <Input
            id="accreditationId"
            name="accreditationId"
            value={values.accreditationId}
            onChange={(e) => setValues((v) => ({ ...v, accreditationId: e.target.value }))}
            invalid={Boolean(fieldError('accreditationId'))}
            required
            minLength={2}
            maxLength={120}
          />
          <FieldError message={fieldError('accreditationId')} />
        </div>
      </div>

      <div className="grid gap-6 border-t border-[var(--color-border)] pt-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contactName">Responsable institucional *</Label>
          <Input
            id="contactName"
            name="contactName"
            value={values.contactName}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                contactName: sanitizeInstitutionContactName(e.target.value),
              }))
            }
            invalid={Boolean(fieldError('contactName'))}
            required
            minLength={2}
            maxLength={200}
          />
          <FieldError message={fieldError('contactName')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Email de contacto *</Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            value={values.contactEmail}
            onChange={(e) => setValues((v) => ({ ...v, contactEmail: e.target.value }))}
            invalid={Boolean(fieldError('contactEmail'))}
            required
            maxLength={255}
          />
          <FieldError message={fieldError('contactEmail')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPhone">Teléfono de contacto *</Label>
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            value={values.contactPhone}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                contactPhone: sanitizeInstitutionPhone(e.target.value),
              }))
            }
            placeholder="+51 987 654 321 - 123"
            invalid={Boolean(fieldError('contactPhone'))}
            required
            minLength={6}
            maxLength={60}
          />
          <FieldError message={fieldError('contactPhone')} />
          <p className="text-xs leading-5 text-[var(--color-fg-subtle)]">
            Incluye código de país y, si aplica, extensión/interno numérico al final. Sólo números y
            signos + ( ) . -
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-4">
        <p className="text-xs text-[var(--color-fg-subtle)]">
          {profileSubmitted
            ? dirty
              ? 'Tienes cambios sin guardar.'
              : 'Perfil enviado a revisión.'
            : profileComplete
              ? 'Listo para enviar a revisión.'
              : 'Completa los campos obligatorios para enviar a revisión.'}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!dirty || pending}
            onClick={() => setValues(initialState)}
            className="inline-flex items-center gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
            Descartar
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit || pending}
            loading={pending}
            className="inline-flex items-center gap-1.5"
          >
            <Save className="h-4 w-4" />
            {profileSubmitted ? 'Guardar cambios' : 'Completar y enviar'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs leading-5 text-[var(--color-danger-500)]">{message}</p>;
}
