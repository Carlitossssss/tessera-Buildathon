'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { Award, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBadgeCollectionAction } from '../actions';

export function CreateBadgeDialog({ cta = 'Nueva colección' }: { cta?: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open, pending]);

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
    setImageUrl('');
  }

  function submit(form: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createBadgeCollectionAction(form);
      if (res.ok) {
        setOpen(false);
        setImageUrl('');
      } else {
        setError(res.error);
      }
    });
  }

  const isValidUrl = (() => {
    if (!imageUrl) return false;
    try {
      new URL(imageUrl);
      return true;
    } catch {
      return false;
    }
  })();

  return (
    <>
      <Button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
        <Plus className="h-4 w-4" />
        {cta}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="badge-dialog-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-3 backdrop-blur-md sm:p-4"
          onClick={close}
        >
          <form
            action={submit}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[linear-gradient(180deg,var(--color-bg-elevated),var(--color-bg))] shadow-[0_28px_90px_-48px_rgba(0,0,0,0.92)] sm:max-h-[min(720px,calc(100dvh-32px))] sm:rounded-[22px]"
          >
            <button
              type="button"
              onClick={close}
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-md text-[var(--color-fg-muted)] hover:bg-white/[0.06] hover:text-[var(--color-fg)]"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>

            <header className="shrink-0 border-b border-[var(--color-border)] px-4 pb-4 pt-5 pr-12 sm:px-6 sm:pb-5 sm:pt-6">
              <h3 id="badge-dialog-title" className="text-lg font-semibold text-[var(--color-fg)]">
                Nueva colección de badges
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-fg-muted)]">
                Crea una colección ERC-1155. Cada estudiante recibirá un badge único de esta
                colección cuando lo emitas desde la API o al completar un curso vinculado.
              </p>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Nombre <span className="text-[var(--color-danger-500)]">*</span>
                </Label>
                <Input
                  ref={nameRef}
                  id="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={200}
                  placeholder="Hackathon Web3 2026"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  maxLength={500}
                  placeholder="Premia a quienes completaron el reto principal del hackathon."
                  className="max-h-28 min-h-20 w-full resize-y rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-brand-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-500)]/40"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_132px]">
                <div className="grid gap-2">
                  <Label htmlFor="imageUrl">URL de imagen</Label>
                  <Input
                    id="imageUrl"
                    name="imageUrl"
                    type="url"
                    placeholder="https://arweave.net/..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                  <p className="text-[10px] text-[var(--color-fg-subtle)]">
                    PNG cuadrado 512×512 recomendado.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxSupply">Suministro máx.</Label>
                  <Input id="maxSupply" name="maxSupply" type="number" min={1} placeholder="∞" />
                  <p className="text-[10px] text-[var(--color-fg-subtle)]">Vacío = ilimitado.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white/[0.015] p-3 max-[420px]:items-start">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-[var(--color-brand-700)]/40 to-[var(--color-accent-500)]/30 sm:h-14 sm:w-14">
                  {isValidUrl ? (
                    <Image
                      src={imageUrl}
                      alt="Preview"
                      width={56}
                      height={56}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Award className="h-5 w-5 text-[var(--color-brand-300)]/70 sm:h-6 sm:w-6" />
                  )}
                </div>
                <div className="text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
                  Vista previa de la insignia. Aparecerá en OpenSea, en el perfil público del
                  estudiante y en LinkedIn.
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/10 px-3 py-2 text-xs text-[var(--color-danger-500)]"
                >
                  {error}
                </p>
              )}
            </div>

            <footer className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 sm:px-6">
              <div className="flex flex-col-reverse gap-2 min-[420px]:flex-row min-[420px]:justify-end">
              <Button type="button" variant="ghost" onClick={close} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creando…' : 'Crear colección'}
              </Button>
              </div>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
