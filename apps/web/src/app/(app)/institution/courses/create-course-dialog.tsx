'use client';

import { useState, useTransition } from 'react';
import {
  Building2,
  CreditCard,
  Globe2,
  KeyRound,
  Plus,
  Sparkles,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createCourseAction } from '../actions';
import {
  isValidLockAddress,
  LOCK_CHAINS,
  LockFields,
  type CourseAccessMode,
} from './lock-fields';

type Visibility = 'public_free' | 'public_paid' | 'private_code' | 'hybrid' | 'token_gated';
type Status = 'draft' | 'published';

const VISIBILITY_OPTIONS: Array<{
  id: Visibility;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: 'public_free',
    label: 'Pública gratuita',
    description: 'Aparece en el catálogo abierto y cualquiera puede inscribirse sin pagar.',
    icon: Globe2,
  },
  {
    id: 'public_paid',
    label: 'Pública de pago',
    description: 'Aparece en el catálogo abierto y se cobra al inscribirse.',
    icon: CreditCard,
  },
  {
    id: 'private_code',
    label: 'Privada por código',
    description: 'No aparece en el catálogo. Sólo se accede canjeando el código generado.',
    icon: KeyRound,
  },
  {
    id: 'hybrid',
    label: 'Híbrida',
    description:
      'Visible y de pago para externos. Tus estudiantes registrados acceden gratis con el código.',
    icon: Building2,
  },
  {
    id: 'token_gated',
    label: 'Con membresía (Unlock)',
    description:
      'Visible en el catálogo. La matrícula la concede una llave de Unlock: cobra en cripto sin intermediarios.',
    icon: Wallet,
  },
];

const STATUS_OPTIONS: Array<{ id: Status; label: string; hint: string }> = [
  { id: 'draft', label: 'Borrador', hint: 'Sólo el equipo asignado lo ve.' },
  { id: 'published', label: 'Publicado', hint: 'Disponible según la visibilidad.' },
];

interface CreateCourseDialogProps {
  cta?: string;
  /**
   * Lock configurado por la institución. Se propone al elegir "Con membresía"
   * para no tener que pegar la dirección en cada curso; sigue siendo editable
   * por si este curso necesita un Lock propio.
   */
  defaultLock?: { address: string | null; chainId: number | null };
}

export function CreateCourseDialog({ cta = 'Nuevo curso', defaultLock }: CreateCourseDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [visibility, setVisibility] = useState<Visibility>('private_code');
  const [status, setStatus] = useState<Status>('draft');
  const [autoIssue, setAutoIssue] = useState(true);
  const [lockAddress, setLockAddress] = useState(defaultLock?.address ?? '');
  const [lockChainId, setLockChainId] = useState<number>(
    defaultLock?.chainId ?? LOCK_CHAINS[0].id,
  );
  const [previewModules, setPreviewModules] = useState(1);
  // Pago único por defecto: es lo que ya hacían todos los cursos, así que no
  // cambia el comportamiento de quien no toque este campo.
  const [accessMode, setAccessMode] = useState<CourseAccessMode>('perpetual');

  const isPaid = visibility === 'public_paid' || visibility === 'hybrid';
  const usesCode = visibility === 'private_code' || visibility === 'hybrid';
  const usesLock = visibility === 'token_gated';

  function reset() {
    setError(null);
    setVisibility('private_code');
    setStatus('draft');
    setAutoIssue(true);
    setLockAddress(defaultLock?.address ?? '');
    setLockChainId(defaultLock?.chainId ?? LOCK_CHAINS[0].id);
    setPreviewModules(1);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function submit(form: FormData) {
    form.set('visibility', visibility);
    form.set('status', status);
    if (autoIssue) form.set('autoIssueEnabled', 'on');
    else form.delete('autoIssueEnabled');

    if (usesLock) {
      // Se valida antes de enviar para dar el error junto al campo. El
      // backend y la base lo vuelven a exigir: un curso con membresía sin
      // Lock quedaría en el catálogo sin que nadie pudiera matricularse.
      const trimmed = lockAddress.trim();
      if (!isValidLockAddress(trimmed)) {
        setError('Pegá la dirección del Lock (0x…, 42 caracteres).');
        return;
      }
      form.set('lockAddress', trimmed);
      form.set('lockChainId', String(lockChainId));
      form.set('previewModuleCount', String(previewModules));
      form.set('accessMode', accessMode);
    } else {
      form.delete('lockAddress');
      form.delete('lockChainId');
      form.delete('previewModuleCount');
      // Sin Lock no hay llave que revalidar: el modo vuelve a pago único, que
      // es lo que el backend guardaría de todos modos.
      form.delete('accessMode');
    }

    setError(null);
    startTransition(async () => {
      const res = await createCourseAction(form);
      if (res.ok) close();
      else setError(res.error);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
        <Plus className="h-4 w-4" />
        {cta}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form
            action={submit}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.7)] sm:rounded-3xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-[var(--color-fg)]">Nuevo curso</h3>
                <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                  Define cómo se accede y cuándo se emite el certificado. Podrás ajustar todo
                  después.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={close}
                className="rounded-full p-1.5 text-[var(--color-fg-muted)] transition hover:bg-white/5 hover:text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              <section className="grid gap-3 sm:grid-cols-[1fr_minmax(0,220px)]">
                <div className="grid gap-2">
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" name="title" required placeholder="Solidity Avanzado" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="slug">Slug (opcional)</Label>
                  <Input id="slug" name="slug" placeholder="solidity-avanzado" />
                </div>
              </section>

              <section className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  placeholder="Promesa pedagógica, audiencia objetivo, qué se llevan al final."
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.65)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-brand-400)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-brand-500),transparent_60%)]"
                />
              </section>

              <section className="grid gap-3">
                <div>
                  <Label>Modo de acceso</Label>
                  <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                    Quién puede ver el curso e inscribirse.
                  </p>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const active = visibility === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => setVisibility(opt.id)}
                        className={cn(
                          'group flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]',
                          active
                            ? 'border-[var(--color-brand-500)] bg-[color-mix(in_oklab,var(--color-brand-500),transparent_88%)]'
                            : 'border-[var(--color-border)] bg-[rgba(14,18,36,0.55)] hover:border-[var(--color-border-strong)] hover:bg-[rgba(20,25,48,0.85)]',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition',
                            active
                              ? 'border-[var(--color-brand-400)]/60 bg-[color-mix(in_oklab,var(--color-brand-500),transparent_70%)] text-[var(--color-brand-200)]'
                              : 'border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] text-[var(--color-fg-muted)]',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 space-y-1">
                          <span className="block text-sm font-medium text-[var(--color-fg)]">
                            {opt.label}
                          </span>
                          <span className="block text-xs leading-5 text-[var(--color-fg-muted)]">
                            {opt.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {usesCode && (
                  <p className="rounded-xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.7)] px-3.5 py-2.5 text-[11px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                    Generaremos un código de canje al crear el curso.
                  </p>
                )}

                {usesLock && (
                  <LockFields
                    idPrefix="new-course-lock"
                    lockAddress={lockAddress}
                    onLockAddressChange={setLockAddress}
                    lockChainId={lockChainId}
                    onLockChainIdChange={setLockChainId}
                    previewModuleCount={previewModules}
                    onPreviewModuleCountChange={setPreviewModules}
                    accessMode={accessMode}
                    onAccessModeChange={setAccessMode}
                  />
                )}
              </section>

              <section className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="priceUsd">Precio (USD)</Label>
                  <Input
                    id="priceUsd"
                    name="priceUsd"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={0}
                    disabled={!isPaid}
                    className={cn(!isPaid && 'opacity-50')}
                  />
                  <p className="text-[11px] text-[var(--color-fg-subtle)]">
                    {isPaid ? 'Sólo aplica para externos.' : 'No aplica en este modo.'}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="passingScore">Nota mínima (%)</Label>
                  <Input
                    id="passingScore"
                    name="passingScore"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={70}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="durationHours">Duración (h)</Label>
                  <Input
                    id="durationHours"
                    name="durationHours"
                    type="number"
                    min={0}
                    step="0.5"
                    defaultValue={0}
                  />
                </div>
              </section>

              <section className="grid gap-3">
                <Label>Estado inicial</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STATUS_OPTIONS.map((opt) => {
                    const active = status === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setStatus(opt.id)}
                        className={cn(
                          'rounded-2xl border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]',
                          active
                            ? 'border-[var(--color-brand-500)] bg-[color-mix(in_oklab,var(--color-brand-500),transparent_88%)]'
                            : 'border-[var(--color-border)] bg-[rgba(14,18,36,0.55)] hover:border-[var(--color-border-strong)]',
                        )}
                      >
                        <p className="text-sm font-medium text-[var(--color-fg)]">{opt.label}</p>
                        <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">{opt.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <button
                  type="button"
                  onClick={() => setAutoIssue((v) => !v)}
                  className={cn(
                    'flex w-full items-center justify-between gap-4 rounded-2xl border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]',
                    autoIssue
                      ? 'border-[var(--color-brand-500)]/60 bg-[color-mix(in_oklab,var(--color-brand-500),transparent_92%)]'
                      : 'border-[var(--color-border)] bg-[rgba(14,18,36,0.55)] hover:border-[var(--color-border-strong)]',
                  )}
                >
                  <span className="flex min-w-0 items-start gap-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-300)]" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--color-fg)]">
                        Auto-emisión al completar
                      </span>
                      <span className="block text-xs text-[var(--color-fg-muted)]">
                        Cuando el alumno cumple los requisitos, se emite el certificado
                        automáticamente.
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition',
                      autoIssue ? 'bg-[var(--color-brand-500)]' : 'bg-[var(--color-border)]',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
                        autoIssue ? 'translate-x-4' : 'translate-x-1',
                      )}
                    />
                  </span>
                </button>
              </section>

              {error && (
                <p className="rounded-lg border border-[color-mix(in_oklab,var(--color-danger-500),transparent_60%)] bg-[color-mix(in_oklab,var(--color-danger-500),transparent_88%)] px-3 py-2 text-xs text-[var(--color-danger-300)]">
                  {error}
                </p>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[rgba(10,13,26,0.6)] px-5 py-4 sm:px-6">
              <Button type="button" variant="ghost" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creando…' : 'Crear curso'}
              </Button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
