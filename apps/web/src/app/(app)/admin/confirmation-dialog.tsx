'use client';

import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useRef } from 'react';
import { Building2, ShieldCheck, Trash2, UserCheck, X } from 'lucide-react';
import { useT } from '@tessera/i18n';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ConfirmationKind =
  | 'reactivate-user'
  | 'reactivate-institution'
  | 'delete-user'
  | 'remove-team-member'
  | 'delete-account'
  | 'delete-institution-admin-account';

function copyFor(t: ReturnType<typeof useT>) {
  return {
    close: t.admin.confirmationDialog.close,
    cancel: t.admin.confirmationDialog.cancel,
    reactivate: t.admin.confirmationDialog.reactivateUser,
    reactivateInstitution: t.admin.confirmationDialog.reactivateInstitution,
    delete: t.admin.confirmationDialog.delete,
    removeTeamMember: t.admin.confirmationDialog.removeTeamMember,
    deleteAccount: t.admin.confirmationDialog.deleteAccount,
    deleteInstitutionAdminAccount: t.admin.confirmationDialog.deleteInstitutionAdminAccount,
  };
}

interface ConfirmationDialogProps {
  open: boolean;
  kind: ConfirmationKind;
  pending: boolean;
  selectedName: string;
  selectedDetail: string;
  onClose: () => void;
  onConfirm: () => void;
}

function initialsFor(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return (parts.map((part) => part[0]).join('') || 'TS').toUpperCase();
}

export function ConfirmationDialog({
  open,
  kind,
  pending,
  selectedName,
  selectedDetail,
  onClose,
  onConfirm,
}: ConfirmationDialogProps) {
  const t = useT();
  const COPY = copyFor(t);
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copy =
    kind === 'reactivate-user'
      ? COPY.reactivate
      : kind === 'reactivate-institution'
        ? COPY.reactivateInstitution
        : kind === 'delete-account'
        ? COPY.deleteAccount
        : kind === 'delete-institution-admin-account'
          ? COPY.deleteInstitutionAdminAccount
          : kind === 'remove-team-member'
            ? COPY.removeTeamMember
            : COPY.delete;
  const HeaderIcon =
    kind === 'reactivate-user' ? UserCheck : kind === 'reactivate-institution' ? Building2 : Trash2;
  const SubmitIcon =
    kind === 'reactivate-user' ? UserCheck : kind === 'reactivate-institution' ? Building2 : Trash2;

  useEffect(() => {
    if (!open) return;

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };

    document.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 60);
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
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
        className="relative w-[min(540px,calc(100vw-32px))] overflow-hidden rounded-[20px] border border-[var(--color-border-strong)] bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.12),transparent_34%),linear-gradient(180deg,var(--color-bg-elevated),#0d1228)] text-left shadow-[0_30px_100px_-54px_rgba(0,0,0,0.95)] max-sm:w-[calc(100vw-24px)]"
      >
        <div className="space-y-5 p-5 sm:p-7">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={pending}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl text-[var(--color-brand-200)] transition hover:bg-white/[0.06] hover:text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]/60 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={COPY.close}
          >
            <X className="h-5 w-5 stroke-[1.8]" />
          </button>

          <header className="flex items-start gap-3.5 pr-10">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[var(--color-border-strong)] bg-[linear-gradient(145deg,rgba(99,102,241,0.22),rgba(255,255,255,0.03))] text-[var(--color-brand-200)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <HeaderIcon className="h-[22px] w-[22px] stroke-[1.7]" />
            </span>
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-[21px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]"
              >
                {copy.title}
              </h2>
              <p
                id={descriptionId}
                className="mt-1.5 text-[14px] leading-6 text-[var(--color-fg-muted)]"
              >
                {copy.description}
              </p>
            </div>
          </header>

          <section className="flex min-h-[76px] items-center gap-3.5 rounded-2xl border border-[var(--color-border-strong)] bg-[rgba(17,21,42,0.72)] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] max-sm:flex-wrap">
            <Avatar className="h-11 w-11">
              <AvatarFallback className="text-[15px]">
                {initialsFor(selectedName || selectedDetail)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15.5px] font-semibold leading-tight text-[var(--color-fg)]">
                {selectedName}
              </p>
              <p className="mt-1.5 truncate text-[13.5px] text-[var(--color-fg-muted)]">
                {selectedDetail}
              </p>
            </div>
            <Badge variant="default" className="ml-auto shrink-0 max-sm:ml-[58px]">
              {copy.status}
            </Badge>
          </section>

          <section className="rounded-2xl border border-[var(--color-brand-700)]/35 bg-[rgba(17,26,58,0.42)] p-4 text-left">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--color-brand-300)]/70 text-[var(--color-brand-200)]">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">{copy.infoTitle}</p>
                <p className="mt-1 text-[13.5px] leading-5 text-[var(--color-fg-muted)]">
                  {copy.infoText}
                </p>
              </div>
            </div>
          </section>

          <p className="text-[14px] font-medium leading-6 text-[var(--color-fg)]">
            {copy.question}
          </p>
        </div>

        <footer className="flex flex-col-reverse gap-2.5 border-t border-[var(--color-border)] bg-white/[0.015] px-5 pb-5 pt-[18px] sm:flex-row sm:justify-end sm:px-7">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={pending}
            className="h-[42px] min-w-[112px] border-[var(--color-border-strong)] bg-transparent px-4 text-[14px] text-[var(--color-fg-muted)]"
          >
            {COPY.cancel}
          </Button>
          <Button
            type="button"
            size="md"
            onClick={onConfirm}
            disabled={pending}
            loading={pending}
            className="h-[42px] min-w-[196px] px-4 text-[14px]"
          >
            <SubmitIcon className="h-4 w-4" />
            {pending ? copy.pending : copy.submit}
          </Button>
        </footer>
      </div>
    </div>
  );
}
