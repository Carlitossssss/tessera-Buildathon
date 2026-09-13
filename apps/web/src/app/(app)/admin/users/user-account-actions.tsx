'use client';

import { useState, useTransition } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';
import {
  SUSPENSION_REASON_LIMITS,
  SuspensionDialog,
  suspensionReasonError,
} from '../suspension-dialog';
import { toggleUserRestrictionAction } from '../actions';
import { ConfirmationDialog } from '../confirmation-dialog';

interface UserAccountActionsProps {
  userId: string;
  name: string | null;
  email: string;
  restricted: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function UserAccountActions({
  userId,
  name,
  email,
  restricted,
  disabled = false,
  disabledReason,
}: UserAccountActionsProps) {
  const t = useT();
  const copy = t.admin.users.actions;
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState<'reactivate-user' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedName = name?.trim() || email;
  const actionTitle = disabled
    ? (disabledReason ?? copy.notAvailable)
    : restricted
      ? copy.reactivate
      : copy.suspend;

  function closeModal() {
    if (pending) return;
    setOpen(false);
    setReason('');
    setError(null);
  }

  function closeConfirmation() {
    if (pending) return;
    setConfirmOpen(null);
    setError(null);
  }

  function updateReason(value: string) {
    setReason(value.slice(0, SUSPENSION_REASON_LIMITS.max));
    setError(null);
  }

  function submitToggle() {
    const validationError = restricted ? null : suspensionReasonError(reason, t.admin.suspensionDialog.invalid);
    if (validationError) {
      setError(validationError);
      return;
    }
    const form = new FormData();
    form.set('userId', userId);
    form.set('restricted', String(restricted));
    form.set('reason', reason.trim());
    startTransition(async () => {
      try {
        await toggleUserRestrictionAction(form);
        if (restricted) {
          toast.success(copy.reactivated);
        } else {
          toast.success(copy.suspended);
        }
        setOpen(false);
        setConfirmOpen(null);
        setReason('');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.toggleFailed);
        toast.error(copy.toggleFailed);
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          type="button"
          title={actionTitle}
          onClick={() => {
            if (disabled) return;
            if (restricted) {
              setConfirmOpen('reactivate-user');
              return;
            }
            setOpen(true);
          }}
          className={
            restricted
              ? 'text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200'
              : 'text-[var(--color-danger-500)] hover:bg-[var(--color-danger-500)]/10 hover:text-[var(--color-danger-500)]'
          }
          disabled={pending || disabled}
        >
          {restricted ? (
            <ShieldCheck className="h-3.5 w-3.5" />
          ) : (
            <ShieldOff className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      <SuspensionDialog
        open={open}
        pending={pending}
        title={copy.suspendTitle}
        description={copy.suspendDescription}
        selectedName={selectedName}
        selectedDetail={email}
        selectedStatus={copy.active}
        submitLabel={copy.suspend}
        reason={reason}
        error={error}
        onReasonChange={updateReason}
        onClose={closeModal}
        onSubmit={submitToggle}
      />

      <ConfirmationDialog
        open={confirmOpen !== null}
        kind={confirmOpen ?? 'reactivate-user'}
        pending={pending}
        selectedName={selectedName}
        selectedDetail={email}
        onClose={closeConfirmation}
        onConfirm={submitToggle}
      />
    </>
  );
}
