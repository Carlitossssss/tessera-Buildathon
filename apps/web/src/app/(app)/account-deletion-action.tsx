'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from './admin/confirmation-dialog';
import { requestAccountDeletionAction } from './account-actions';

export function AccountDeletionAction({
  accountRole,
  selectedName,
  selectedDetail,
}: {
  accountRole: 'student' | 'teacher' | 'institution_admin';
  selectedName: string;
  selectedDetail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const kind =
    accountRole === 'institution_admin' ? 'delete-institution-admin-account' : 'delete-account';

  function submit() {
    startTransition(async () => {
      const res = await requestAccountDeletionAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Eliminación programada');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="danger" type="button" onClick={() => setOpen(true)} disabled={pending}>
        <Trash2 className="h-4 w-4" />
        Iniciar eliminación
      </Button>
      <ConfirmationDialog
        open={open}
        kind={kind}
        pending={pending}
        selectedName={selectedName}
        selectedDetail={selectedDetail}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        onConfirm={submit}
      />
    </>
  );
}
