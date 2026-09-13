import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';

interface InstitutionRejectionNoticeProps {
  reason?: string | null;
}

export function InstitutionRejectionNotice({ reason }: InstitutionRejectionNoticeProps) {
  const t = useT();
  const cleanReason = reason?.trim();
  if (!cleanReason) return null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--color-border-strong)] bg-[rgba(17,26,58,0.48)] px-5 py-4 text-sm shadow-[0_18px_60px_-40px_rgba(37,75,218,0.9)] sm:flex-row sm:items-start">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-brand-500)]/35 bg-[var(--color-brand-500)]/10 text-[var(--color-brand-200)]">
        <AlertTriangle className="h-4 w-4" />
      </span>
      <div className="flex-1 text-[var(--color-fg-muted)]">
        <p className="font-semibold text-[var(--color-fg)]">{t.institution.rejectionNotice.title}</p>
        <p className="mt-1 leading-6">{cleanReason}</p>
      </div>
      <Button size="sm" asChild>
        <Link href="/institution/settings">{t.institution.rejectionNotice.reviewProfile}</Link>
      </Button>
    </div>
  );
}

