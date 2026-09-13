import { meApi } from '@/lib/api/endpoints/me';
import { safeFetch } from '@/lib/dashboard';
import { ApprovalGateNotice } from './approval-gate-notice';

export async function pendingApprovalGate(token: string) {
  const me = await safeFetch(() => meApi.institution(token));
  if (!me || me.institution.status === 'approved') return null;

  if (me.institution.status === 'suspended') {
    return <ApprovalGateNotice status="suspended" reason={me.institution.suspensionReason} />;
  }

  return <ApprovalGateNotice status="pending" />;
}

