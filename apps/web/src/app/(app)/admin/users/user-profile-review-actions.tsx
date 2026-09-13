'use client';

import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';
import {
  SUSPENSION_REASON_LIMITS,
  SuspensionDialog,
  suspensionReasonError,
} from '../suspension-dialog';
import { approveUserProfileAction, rejectUserProfileAction } from '../actions';

export function UserProfileReviewActions({
  userId,
  name,
  email,
}: {
  userId: string;
  name: string | null;
  email: string;
}) {
  const t = useT();
  const copy = t.admin.users.actions;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedName = name?.trim() || email;

  function approve() {
    const form = new FormData();
    form.set('userId', userId);
    startTransition(async () => {
      try {
        await approveUserProfileAction(form);
        toast.success(copy.profileApproved);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : copy.profileApproveFailed);
      }
    });
  }

  function reject() {
    const validationError = suspensionReasonError(reason, t.admin.suspensionDialog.invalid);
    if (validationError) {
      setError(validationError);
      return;
    }
    const form = new FormData();
    form.set('userId', userId);
    form.set('reason', reason.trim());
    startTransition(async () => {
      try {
        await rejectUserProfileAction(form);
        toast.success(copy.profileRejected);
        setOpen(false);
        setReason('');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.profileRejectFailed);
        toast.error(copy.profileRejectFailed);
      }
    });
  }

  return (
    <>
      <div className="mt-2 flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={approve}
          disabled={pending}
          className="h-8 px-2 text-xs"
        >
          <Check className="h-3.5 w-3.5" />
          {copy.approveProfile}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(true)}
          disabled={pending}
          className="h-8 px-2 text-xs text-[var(--color-danger-500)] hover:bg-[var(--color-danger-500)]/10 hover:text-[var(--color-danger-500)]"
        >
          <X className="h-3.5 w-3.5" />
          {copy.reject}
        </Button>
      </div>

      <SuspensionDialog
        open={open}
        pending={pending}
        title={copy.rejectProfileTitle}
        description={copy.rejectProfileDescription}
        selectedName={selectedName}
        selectedDetail={email}
        selectedStatus={t.admin.users.profileStatus.pending}
        submitLabel={copy.rejectProfileTitle}
        reason={reason}
        error={error}
        onReasonChange={(value) => {
          setReason(value.slice(0, SUSPENSION_REASON_LIMITS.max));
          setError(null);
        }}
        onClose={() => {
          if (pending) return;
          setOpen(false);
          setReason('');
          setError(null);
        }}
        onSubmit={reject}
      />
    </>
  );
}
