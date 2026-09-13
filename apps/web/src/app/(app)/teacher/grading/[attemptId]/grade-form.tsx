'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { gradeAttemptAction } from '../../actions';

interface Props {
  attemptId: string;
  maxScore: number;
  defaultScore: number | null;
  defaultFeedback: string | null;
  alreadyGraded: boolean;
}

export function GradeForm({
  attemptId,
  maxScore,
  defaultScore,
  defaultFeedback,
  alreadyGraded,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [score, setScore] = useState<string>(defaultScore != null ? String(defaultScore) : '');
  const [feedback, setFeedback] = useState<string>(defaultFeedback ?? '');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const fd = new FormData();
    fd.set('score', score);
    fd.set('feedback', feedback);
    start(async () => {
      const r = await gradeAttemptAction(attemptId, fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOk(`Guardado · ${r.data?.score ?? score} / ${maxScore}`);
      router.refresh();
    });
  }

  const numericScore = Number(score);
  const invalid =
    score === '' || !Number.isFinite(numericScore) || numericScore < 0 || numericScore > maxScore;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          Nota (máx. {maxScore})
        </label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0}
            max={maxScore}
            step={1}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-32 text-right text-[18px] font-semibold tabular-nums"
            required
          />
          <span className="text-[13px] text-[var(--color-fg-muted)]">
            {invalid ? '—' : `${Math.round((numericScore / maxScore) * 100)}%`}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          Retroalimentación
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={6}
          placeholder="Comentarios para el estudiante (opcional)"
          className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-brand-400)] focus:outline-none"
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-300">
          {ok}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || invalid} loading={pending} size="md">
        {alreadyGraded ? 'Actualizar calificación' : 'Guardar calificación'}
      </Button>
    </form>
  );
}
