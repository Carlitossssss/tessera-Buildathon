'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountDeletionAction } from '../../account-deletion-action';
import { useT } from '@tessera/i18n';
import { requestDataExportAction } from '../../account-actions';

interface Props {
  kind: 'export' | 'delete';
  accountRole?: 'student' | 'teacher' | 'institution_admin';
  selectedName?: string;
  selectedDetail?: string;
}

export function PrivacyActions({
  kind,
  accountRole = 'student',
  selectedName = '',
  selectedDetail = '',
}: Props) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const submit = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await requestDataExportAction();
      if (!res.ok) {
        setFeedback({ kind: 'err', msg: res.error });
        return;
      }
      setFeedback({
        kind: 'ok',
        msg: t.student.privacy.export.requested,
      });
    });
  };

  if (kind === 'delete') {
    return (
      <div className="mt-5">
        <AccountDeletionAction
          accountRole={accountRole}
          selectedName={selectedName}
          selectedDetail={selectedDetail}
        />
      </div>
    );
  }

  return (
    <div className="mt-5">
      <Button variant="secondary" onClick={submit} disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {t.student.privacy.export.submitting}
          </>
        ) : (
          t.student.privacy.export.submit
        )}
      </Button>
      {feedback ? (
        <p
          className={
            feedback.kind === 'ok'
              ? 'mt-3 text-[12.5px] text-emerald-300'
              : 'mt-3 text-[12.5px] text-red-300'
          }
        >
          {feedback.msg}
        </p>
      ) : null}
    </div>
  );
}
