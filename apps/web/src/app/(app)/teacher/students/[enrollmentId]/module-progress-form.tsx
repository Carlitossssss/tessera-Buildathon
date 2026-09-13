'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { setModuleProgressAction } from '../../actions';

interface Props {
  enrollmentId: string;
  moduleId: string;
  defaultStatus: 'not_started' | 'in_progress' | 'completed';
  defaultScore: number | null;
  defaultNote: string | null;
}

const STATUS: Array<{ id: Props['defaultStatus']; label: string }> = [
  { id: 'not_started', label: 'No iniciado' },
  { id: 'in_progress', label: 'En curso' },
  { id: 'completed', label: 'Completado' },
];

export function ModuleProgressForm({
  enrollmentId,
  moduleId,
  defaultStatus,
  defaultScore,
  defaultNote,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Props['defaultStatus']>(defaultStatus);
  const [score, setScore] = useState<string>(defaultScore != null ? String(defaultScore) : '');
  const [note, setNote] = useState<string>(defaultNote ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    fd.set('status', status);
    fd.set('score', score);
    fd.set('note', note);
    start(async () => {
      const r = await setModuleProgressAction(enrollmentId, moduleId, fd);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: 'Avance guardado' });
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 sm:grid-cols-[auto_120px_1fr_auto] sm:items-end"
    >
      <div className="space-y-1">
        <label className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          Estado
        </label>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as Props['defaultStatus'])}
          className="h-10 px-3 py-2 text-[13px]"
        >
          {STATUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          Nota (0-100)
        </label>
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="text-right tabular-nums"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          Nota interna
        </label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observaciones" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Button type="submit" size="sm" disabled={pending} loading={pending}>
          Guardar
        </Button>
        {msg ? (
          <span className={'text-[11px] ' + (msg.ok ? 'text-emerald-300' : 'text-red-300')}>
            {msg.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
