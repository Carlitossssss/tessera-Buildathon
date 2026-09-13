'use client';

import { Clock, PauseCircle } from 'lucide-react';
import { useT } from '@tessera/i18n';
import { EmptyState } from '@/components/dashboard/stat-card';

export function ApprovalGateNotice({
  status,
  reason,
}: {
  status: 'suspended' | 'pending';
  reason?: string | null;
}) {
  const t = useT();
  const copy = t.institution.approvalGate;

  if (status === 'suspended') {
    return (
      <EmptyState
        icon={PauseCircle}
        title={copy.suspended.title}
        description={reason ?? copy.suspended.description}
      />
    );
  }

  return <EmptyState icon={Clock} title={copy.pending.title} description={copy.pending.description} />;
}
