'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { Info, Send, ShieldCheck, UserRoundX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/endpoints/auth';
import { sendRestrictionAppealAction } from './restricted-actions';
import { useT, type Dictionary } from '@tessera/i18n';

/**
 * Textos de la pantalla, en el idioma activo.
 *
 * Antes era una constante fija; ahora se arma desde el diccionario en cada
 * render, sin cambiar la estructura del resto del componente.
 */
function copyFor(t: Dictionary) {
  const c = t.account.restricted;
  return {
    title: c.title,
    subtitle: c.subtitle,
    reasonLabel: c.reasonLabel,
    fallbackReason: c.fallbackReason,
    secure: c.secure,
    nextTitle: c.nextTitle,
    steps: [c.steps.request, c.steps.wait],
    messageLabel: c.messageLabel,
    messageHelp: c.messageHelp,
    messageMinHelp: c.messageMinHelp,
    messagePlaceholder: c.messagePlaceholder,
    requestReview: c.requestReview,
    sentReview: c.sentReview,
    signOut: c.signOut,
    note: c.note,
    sending: c.sending,
    success: c.success,
    minMessage: c.minMessage,
  };
}

const MIN_APPEAL_LENGTH = 20;
const MAX_APPEAL_LENGTH = 2000;

interface AccountRestrictedScreenProps {
  email: string;
  name?: string | null;
  accountId?: string | null;
  restrictedAt?: string | null;
  reason?: string | null;
}

export function AccountRestrictedScreen({
  email,
  accountId,
  reason,
}: AccountRestrictedScreenProps) {
  const t = useT();
  const COPY = copyFor(t);
  const router = useRouter();
  const { data: session } = useSession();
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const suspensionReason = reason?.trim() || COPY.fallbackReason;
  const trimmedMessage = message.trim();
  const storageKey = useMemo(
    () => `tessera.restricted-appeal.sent:${accountId ?? email}`,
    [accountId, email],
  );
  const canSubmit = trimmedMessage.length >= MIN_APPEAL_LENGTH && !pending && !sent;

  useEffect(() => {
    const alreadySent = window.localStorage.getItem(storageKey) === 'true';
    setSent(alreadySent);
    if (alreadySent) {
      setStatus({ ok: true, text: COPY.success });
    }
  }, [storageKey, COPY.success]);

  useEffect(() => {
    const accessToken = session?.accessToken;
    if (!accessToken) return;

    let cancelled = false;
    const refreshRestriction = async () => {
      try {
        const current = await authApi.me(accessToken);
        if (cancelled) return;
        if (!current.user.restricted) router.refresh();
      } catch {
        if (!cancelled) void signOut({ callbackUrl: '/login' });
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshRestriction();
    };

    void refreshRestriction();
    const interval = window.setInterval(refreshRestriction, 8000);
    window.addEventListener('focus', refreshRestriction);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshRestriction);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [router, session?.accessToken]);

  function submitReview() {
    if (sent) return;
    if (trimmedMessage.length < MIN_APPEAL_LENGTH) {
      setStatus({ ok: false, text: COPY.minMessage });
      return;
    }

    setStatus({ ok: true, text: COPY.sending });
    startTransition(async () => {
      const res = await sendRestrictionAppealAction(trimmedMessage);
      if (res.ok) {
        setMessage('');
        setSent(true);
        window.localStorage.setItem(storageKey, 'true');
        setStatus({ ok: true, text: COPY.success });
      } else {
        // El fallback queda fijo: es el mismo texto que ya devuelve
        // sendRestrictionAppealAction cuando la API no da un mensaje propio,
        // y esa server action tampoco tiene contexto de React para traducir.
        setStatus({ ok: false, text: res.error ?? 'No pudimos enviar la solicitud.' });
      }
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-6 text-[var(--color-fg)] sm:px-6">
      <section className="w-[min(630px,calc(100vw-32px))] max-w-full rounded-[20px] border border-[var(--color-border-strong)] bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.14),transparent_34%),linear-gradient(180deg,var(--color-bg-elevated),#0d1228)] px-5 py-6 shadow-[0_26px_90px_-58px_rgba(99,102,241,0.65)] max-sm:w-[calc(100vw-24px)] sm:px-[38px] sm:pb-[22px] sm:pt-[26px]">
        <header className="text-center">
          <div className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full border border-[var(--color-border-strong)] bg-[linear-gradient(145deg,rgba(99,102,241,0.2),rgba(255,255,255,0.03))] text-[var(--color-brand-200)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] max-sm:h-16 max-sm:w-16">
            <UserRoundX className="h-8 w-8 stroke-[1.7] max-sm:h-7 max-sm:w-7" />
          </div>
          <h1 className="mt-4 text-[27px] font-semibold leading-tight tracking-tight text-[var(--color-fg)] max-sm:text-2xl">
            {COPY.title}
          </h1>
          <p className="mt-2 text-[15.5px] leading-6 text-[var(--color-fg-muted)]">
            {COPY.subtitle}
          </p>
        </header>

        <div className="mt-5 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-card)]/70 px-[18px] py-3.5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              {COPY.reasonLabel}
            </p>
            <Info className="h-4 w-4 shrink-0 text-[var(--color-brand-300)]" />
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--color-fg)]">{suspensionReason}</p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-sm leading-5 text-[var(--color-brand-200)]">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <p>{COPY.secure}</p>
        </div>

        <div className="mt-5 text-left">
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">{COPY.nextTitle}</h2>
          <ol className="mt-3 space-y-2.5">
            {COPY.steps.map((step, index) => (
              <li
                key={step}
                className="flex items-center gap-3 text-sm text-[var(--color-fg-muted)]"
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-500)]/18 text-xs font-semibold text-[var(--color-brand-200)] ring-1 ring-[var(--color-brand-500)]/35">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-5 space-y-2.5 text-left">
          <div className="space-y-1">
            <label
              htmlFor="appeal-message"
              className="text-sm font-semibold text-[var(--color-fg)]"
            >
              {COPY.messageLabel} <span className="text-[var(--color-brand-400)]">*</span>
            </label>
            <p className="text-xs leading-5 text-[var(--color-fg-muted)]">
              {COPY.messageHelp} {COPY.messageMinHelp}
            </p>
          </div>
          <textarea
            id="appeal-message"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setStatus(null);
            }}
            disabled={sent || pending}
            rows={4}
            maxLength={MAX_APPEAL_LENGTH}
            placeholder={COPY.messagePlaceholder}
            className="min-h-[96px] w-full resize-y rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-card)]/70 px-4 py-3 text-sm leading-6 text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] transition focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-500)]/30"
          />
          <div className="flex items-start justify-between gap-4">
            {status ? (
              <p
                role="status"
                className={`text-xs leading-5 ${
                  status.ok ? 'text-[var(--color-brand-200)]' : 'text-[var(--color-danger-500)]'
                }`}
              >
                {status.text}
              </p>
            ) : (
              <span />
            )}
            <p className="shrink-0 text-xs tabular-nums text-[var(--color-fg-subtle)]">
              {message.length}/{MAX_APPEAL_LENGTH}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-[var(--color-border)] pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-7">
            <Button
              type="button"
              className="h-11 min-w-[200px]"
              onClick={submitReview}
              disabled={!canSubmit}
              loading={pending}
            >
              <Send className="h-4 w-4" />
              {sent ? COPY.sentReview : pending ? COPY.sending : COPY.requestReview}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 text-[var(--color-fg-muted)]"
              onClick={() => void signOut({ callbackUrl: '/login' })}
            >
              {COPY.signOut}
            </Button>
          </div>
          <p className="mt-3 text-center text-xs leading-5 text-[var(--color-fg-subtle)]">
            {COPY.note}
          </p>
        </div>
      </section>
    </main>
  );
}
