'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createTemplateAction } from '../actions';

export function CreateTemplateDialog({ cta = 'Nueva plantilla' }: { cta?: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(form: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createTemplateAction(form);
      if (res.ok) setOpen(false);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            action={submit}
            className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6"
          >
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-fg)]">Nueva plantilla</h3>
              <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                Crea un diseño reutilizable. Podrás afinar el layout más adelante.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required placeholder="Diploma corporativo" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="backgroundUrl">URL de fondo (opcional)</Label>
              <Input id="backgroundUrl" name="backgroundUrl" type="url" placeholder="https://..." />
            </div>

            {error && <p className="text-xs text-[var(--color-danger-500)]">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creando…' : 'Crear plantilla'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
