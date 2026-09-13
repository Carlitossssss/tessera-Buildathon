'use client';

import { useState, useTransition } from 'react';
import { Clock3, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';
import {
  SUSPENSION_REASON_LIMITS,
  SuspensionDialog,
  suspensionReasonError,
} from '../suspension-dialog';
import { rejectInstitutionAction } from '../actions';

interface InstitutionReviewActionProps {
  institutionId: string;
  institutionName: string;
  status: 'pending' | 'approved' | 'suspended' | 'revoked';
}

export function InstitutionReviewAction({
  institutionId,
  institutionName,
  status,
}: InstitutionReviewActionProps) {
  const t = useT();
  const copy = t.admin.institutions.reviewAction;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function closeModal() {
    if (pending) return;
    setOpen(false);
    setReason('');
    setError(null);
  }

  function updateReason(value: string) {
    setReason(value.slice(0, SUSPENSION_REASON_LIMITS.max));
    setError(null);
  }

  function submitRejection() {
    const validationError = suspensionReasonError(reason, t.admin.suspensionDialog.invalid);
    if (validationError) {
      setError(validationError);
      return;
    }
    const form = new FormData();
    form.set('institutionId', institutionId);
    form.set('reason', reason.trim());
    startTransition(async () => {
      try {
        await rejectInstitutionAction(form);
        toast.success(copy.rejected);
        setOpen(false);
        setReason('');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.rejectFailed);
        toast.error(copy.rejectFailed);
      }
    });
  }

  if (status === 'revoked') {
    return (
      <Button
        size="sm"
        type="button"
        variant="secondary"
        disabled
        title={copy.waitingChangesTitle}
      >
        <Clock3 className="h-4 w-4" />
        {copy.waitingChanges}
      </Button>
    );
  }

  if (status !== 'pending') return null;

  return (
    <>
      <Button
        size="sm"
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="border-[var(--color-danger-500)]/30 text-[var(--color-danger-500)] hover:bg-[var(--color-danger-500)]/10"
      >
        <XCircle className="h-4 w-4" />
        {copy.reject}
      </Button>

      <SuspensionDialog
        open={open}
        pending={pending}
        title={copy.rejectTitle}
        description={copy.rejectDescription}
        selectedName={institutionName}
        selectedDetail={copy.workspaceLabel}
        selectedStatus={copy.pendingStatus}
        submitLabel={copy.rejectTitle}
        loadingLabel={copy.loading}
        reasonLabel={copy.reasonLabel}
        reasonHelp={copy.reasonHelp}
        placeholder={copy.placeholder}
        info={copy.info}
        later={copy.later}
        reason={reason}
        error={error}
        onReasonChange={updateReason}
        onClose={closeModal}
        onSubmit={submitRejection}
      />
    </>
  );
}
