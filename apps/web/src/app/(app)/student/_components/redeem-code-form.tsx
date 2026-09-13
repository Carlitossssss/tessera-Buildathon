'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@tessera/i18n';
import { redeemCodeAction } from '../actions';

export function RedeemCodeForm() {
  const t = useT();
  const [code, setCode] = useState('');
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await redeemCodeAction(code);
      if (!res.ok) {
        setFeedback({ kind: 'err', msg: res.error });
        return;
      }
      setFeedback({
        kind: 'ok',
        msg: res.data!.alreadyEnrolled
          ? t.student.redeem.alreadyEnrolled
          : t.student.redeem.created,
      });
      setCode('');
      router.push(`/student/courses/${res.data!.enrollmentId}`);
    });
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-5"
    >
      <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        <KeyRound className="h-3.5 w-3.5" />
        {t.student.redeem.label}
      </div>
      <Label htmlFor="redeem-code" className="sr-only">
        {t.student.redeem.srLabel}
      </Label>
      <div className="flex gap-2">
        <Input
          id="redeem-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t.student.redeem.placeholder}
          minLength={4}
          maxLength={16}
          autoComplete="off"
          className="font-mono uppercase tracking-[0.18em]"
          required
        />
        <Button type="submit" disabled={pending || code.trim().length < 4}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t.student.redeem.submit}
        </Button>
      </div>
      {feedback ? (
        <p
          className={
            feedback.kind === 'ok'
              ? 'mt-3 text-[12px] text-emerald-300'
              : 'mt-3 text-[12px] text-red-300'
          }
        >
          {feedback.msg}
        </p>
      ) : (
        <p className="mt-3 text-[12px] text-[var(--color-fg-subtle)]">
          {t.student.redeem.hint}
        </p>
      )}
    </form>
  );
}
