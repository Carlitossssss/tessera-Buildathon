'use client';

import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useRef } from 'react';
import { Info, LockKeyhole, UserRoundX, X } from 'lucide-react';
import { useT } from '@tessera/i18n';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const MAX_REASON_LENGTH = 300;
const MIN_REASON_LENGTH = 1;

export const SUSPENSION_REASON_LIMITS = {
  max: MAX_REASON_LENGTH,
  min: MIN_REASON_LENGTH,
};

function copyFor(t: ReturnType<typeof useT>) {
  return {
    close: t.admin.suspensionDialog.close,
    required: t.admin.suspensionDialog.required,
    reasonLabel: t.admin.suspensionDialog.reasonLabel,
    reasonHelp: t.admin.suspensionDialog.reasonHelp,
    placeholder: t.admin.suspensionDialog.placeholder,
    info: t.admin.suspensionDialog.info,
    later: t.admin.suspensionDialog.later,
    cancel: t.admin.suspensionDialog.cancel,
    invalid: t.admin.suspensionDialog.invalid,
  };
}

interface SuspensionDialogProps {
  open: boolean;
  pending: boolean;
  title: string;
  description: string;
  selectedName: string;
  selectedDetail: string;
  selectedStatus: string;
  submitLabel: string;
  loadingLabel?: string;
  reasonLabel?: string;
  reasonHelp?: string;
  placeholder?: string;
  info?: string;
  later?: string;
  reason: string;
  error: string | null;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

function initialsFor(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return (parts.map((part) => part[0]).join('') || 'TS').toUpperCase();
}

export function isValidSuspensionReason(reason: string) {
  return reason.trim().length >= MIN_REASON_LENGTH;
}

export function suspensionReasonError(reason: string, invalidMessage: string) {
  return isValidSuspensionReason(reason) ? null : invalidMessage;
}

export function SuspensionDialog({
  open,
  pending,
  title,
  description,
  selectedName,
  selectedDetail,
  selectedStatus,
  submitLabel,
  loadingLabel,
  reasonLabel,
  reasonHelp,
  placeholder,
  info,
  later,
  reason,
  error,
  onReasonChange,
  onClose,
  onSubmit,
}: SuspensionDialogProps) {
  const t = useT();
  const copy = copyFor(t);
  const resolvedLoadingLabel = loadingLabel ?? t.admin.suspensionDialog.suspending;
  const resolvedReasonLabel = reasonLabel ?? copy.reasonLabel;
  const resolvedReasonHelp = reasonHelp ?? copy.reasonHelp;
  const resolvedPlaceholder = placeholder ?? copy.placeholder;
  const resolvedInfo = info ?? copy.info;
  const resolvedLater = later ?? copy.later;
  const titleId = useId();
  const descriptionId = useId();
  const textareaId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cleanReason = reason.trim();
  const canSubmit = isValidSuspensionReason(reason) && !pending;

  useEffect(() => {
    if (!open) return;

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };

    document.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 60);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, pending, onClose]);

  if (!open) return null;

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('aria-hidden'));
    if (focusable.length === 0) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,7,18,0.78)] p-3 text-left backdrop-blur-lg sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        onKeyDown={trapFocus}
        className="relative flex max-h-[calc(100vh-48px)] w-[min(640px,calc(100vw-32px))] flex-col overflow-hidden rounded-[22px] border border-[var(--color-border-strong)] bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.12),transparent_34%),linear-gradient(180deg,var(--color-bg-elevated),#0d1228)] text-left shadow-[0_32px_110px_-52px_rgba(0,0,0,0.95)] max-sm:w-[calc(100vw-24px)]"
      >
        <div className="space-y-5 overflow-visible p-5 max-sm:overflow-y-auto sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl text-[var(--color-brand-200)] transition hover:bg-white/[0.06] hover:text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]/60 disabled:cursor-not-allowed disabled:opacity-50 sm:right-5 sm:top-5"
            aria-label={copy.close}
          >
            <X className="h-5 w-5 stroke-[1.8]" />
          </button>

          <header className="flex items-start justify-start gap-3.5 pr-10 sm:pr-12">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[var(--color-border-strong)] bg-[linear-gradient(145deg,rgba(99,102,241,0.22),rgba(255,255,255,0.03))] text-[var(--color-brand-200)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <UserRoundX className="h-[22px] w-[22px] stroke-[1.7]" />
            </span>
            <div className="min-w-0 text-left">
              <h2
                id={titleId}
                className="text-[21px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]"
              >
                {title}
              </h2>
              <p
                id={descriptionId}
                className="mt-1.5 text-[14.5px] leading-6 text-[var(--color-fg-muted)]"
              >
                {description}
              </p>
            </div>
          </header>

          <section className="flex min-h-[76px] items-center justify-start gap-3.5 rounded-2xl border border-[var(--color-border-strong)] bg-[rgba(17,21,42,0.72)] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] max-sm:flex-wrap">
            <Avatar className="h-11 w-11">
              <AvatarFallback className="text-[15px]">
                {initialsFor(selectedName || selectedDetail)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[15.5px] font-semibold leading-tight text-[var(--color-fg)]">
                {selectedName}
              </p>
              <p className="mt-1.5 truncate text-[13.5px] text-[var(--color-fg-muted)]">
                {selectedDetail}
              </p>
            </div>
            <span className="ml-auto inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-accent-600)]/25 bg-[var(--color-accent-600)]/10 px-4 text-sm font-semibold text-[var(--color-accent-400)] max-sm:ml-[58px]">
              {selectedStatus}
            </span>
          </section>

          <section className="space-y-2.5 text-left">
            <div className="space-y-1 text-left">
              <label
                htmlFor={textareaId}
                className="block text-left text-[14.5px] font-semibold leading-none text-[var(--color-fg)]"
              >
                {resolvedReasonLabel} <span className="text-[var(--color-brand-400)]">*</span>
              </label>
              <p className="text-left text-[13.5px] leading-5 text-[var(--color-fg-muted)]">
                {resolvedReasonHelp}
              </p>
            </div>
            <textarea
              ref={textareaRef}
              id={textareaId}
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              rows={5}
              maxLength={MAX_REASON_LENGTH}
              aria-invalid={Boolean(error)}
              className="min-h-[110px] max-h-[130px] w-full resize-y rounded-[14px] border border-[var(--color-border-strong)] bg-[rgba(13,18,40,0.76)] p-3.5 text-sm leading-6 text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] transition focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-500)]/30"
              placeholder={resolvedPlaceholder}
            />
            <div className="flex items-start justify-between gap-4">
              {error ? (
                <p role="alert" className="text-sm leading-5 text-[var(--color-danger-500)]">
                  {error}
                </p>
              ) : (
                <span />
              )}
              <p className="shrink-0 text-right text-xs tabular-nums text-[var(--color-fg-muted)]">
                {reason.length}/{MAX_REASON_LENGTH}
              </p>
            </div>
          </section>

          <div className="flex min-h-[54px] items-center justify-start gap-3 rounded-2xl border border-[var(--color-brand-700)]/35 bg-[rgba(17,26,58,0.42)] px-3.5 py-3 text-left text-[13.5px] leading-5 text-[var(--color-fg-muted)]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--color-brand-300)]/70 text-[var(--color-brand-200)]">
              <Info className="h-4 w-4" />
            </span>
            <p>{resolvedInfo}</p>
          </div>
        </div>

        <footer className="flex flex-col gap-4 border-t border-[var(--color-border)] bg-white/[0.015] px-5 pb-5 pt-[18px] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-left text-[13.5px] leading-5 text-[var(--color-fg-muted)]">{resolvedLater}</p>
          <div className="flex flex-col-reverse gap-2.5 [&>button]:w-full sm:flex-row sm:justify-end sm:[&>button]:w-auto">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={pending}
              className="h-[42px] min-w-[110px] border-[var(--color-border-strong)] bg-transparent px-4 text-[14px] text-[var(--color-fg-muted)]"
            >
              {copy.cancel}
            </Button>
            <Button
              type="button"
              size="md"
              onClick={onSubmit}
              disabled={!canSubmit}
              loading={pending}
              className="h-[42px] min-w-[190px] px-4 text-[14px]"
            >
              <LockKeyhole className="h-4 w-4" />
              {pending ? resolvedLoadingLabel : submitLabel}
            </Button>
          </div>
        </footer>
        <span className="sr-only" aria-live="polite">
          {cleanReason ? t.admin.suspensionDialog.charactersWritten.replace('{count}', String(cleanReason.length)) : ''}
        </span>
      </div>
    </div>
  );
}
