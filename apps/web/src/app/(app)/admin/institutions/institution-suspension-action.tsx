'use client';

import { useState, useTransition } from 'react';
import { PauseCircle, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';
import {
  SUSPENSION_REASON_LIMITS,
  SuspensionDialog,
  suspensionReasonError,
} from '../suspension-dialog';
import { toggleInstitutionSuspensionAction } from '../actions';
import { ConfirmationDialog } from '../confirmation-dialog';

interface InstitutionSuspensionActionProps {
  institutionId: string;
  institutionName: string;
  status: 'pending' | 'approved' | 'suspended' | 'revoked';
  mode?: 'icon' | 'button';
}

export function InstitutionSuspensionAction({
  institutionId,
  institutionName,
  status,
  mode = 'icon',
}: InstitutionSuspensionActionProps) {
  const t = useT();
  const copy = t.admin.institutions.suspensionAction;
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isSuspended = status === 'suspended';
  const canUse = status === 'approved' || status === 'suspended';

  if (!canUse) {
    return mode === 'icon' ? (
      <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
    ) : null;
  }

  function closeModal() {
    if (pending) return;
    setOpen(false);
    setReason('');
    setError(null);
  }

  function closeConfirmation() {
    if (pending) return;
    setConfirmOpen(false);
    setError(null);
  }

  function updateReason(value: string) {
    setReason(value.slice(0, SUSPENSION_REASON_LIMITS.max));
    setError(null);
  }

  function submitToggle() {
    const validationError = isSuspended ? null : suspensionReasonError(reason, t.admin.suspensionDialog.invalid);
    if (validationError) {
      setError(validationError);
      return;
    }
    const form = new FormData();
    form.set('institutionId', institutionId);
    form.set('status', status);
    form.set('reason', reason.trim());
    startTransition(async () => {
      try {
        await toggleInstitutionSuspensionAction(form);
        if (isSuspended) {
          toast.success(copy.reactivated);
        } else {
          toast.success(copy.suspended);
        }
        setOpen(false);
        setConfirmOpen(false);
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
      <Button
        size="sm"
        variant={mode === 'button' ? 'secondary' : 'ghost'}
        type="button"
        title={isSuspended ? copy.reactivate : copy.suspend}
        onClick={() => (isSuspended ? setConfirmOpen(true) : setOpen(true))}
        disabled={pending}
        className={
          isSuspended
            ? 'text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200'
            : mode === 'icon'
              ? 'text-[var(--color-danger-500)] hover:bg-[var(--color-danger-500)]/10 hover:text-[var(--color-danger-500)]'
              : 'border-[var(--color-border)] text-[var(--color-brand-300)] hover:bg-[var(--color-brand-500)]/10 hover:text-[var(--color-brand-200)]'
        }
      >
        {isSuspended ? (
          <ShieldCheck className="h-3.5 w-3.5" />
        ) : mode === 'button' ? (
          <PauseCircle className="h-4 w-4" />
        ) : (
          <ShieldOff className="h-3.5 w-3.5" />
        )}
        {mode === 'button' ? (isSuspended ? copy.reactivate : copy.suspend) : null}
      </Button>

      <SuspensionDialog
        open={open}
        pending={pending}
        title={copy.suspend}
        description={copy.description}
        selectedName={institutionName}
        selectedDetail={copy.workspaceLabel}
        selectedStatus={copy.activeStatus}
        submitLabel={copy.suspend}
        reason={reason}
        error={error}
        onReasonChange={updateReason}
        onClose={closeModal}
        onSubmit={submitToggle}
      />

      <ConfirmationDialog
        open={confirmOpen}
        kind="reactivate-institution"
        pending={pending}
        selectedName={institutionName}
        selectedDetail="Workspace institucional"
        onClose={closeConfirmation}
        onConfirm={submitToggle}
      />
    </>
  );
}
