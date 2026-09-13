'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/dashboard/stat-card';

export function InstitutionNotFound() {
  const t = useT();
  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/admin/institutions">
          <ArrowLeft className="h-4 w-4" />
          {t.admin.institutions.detail.back}
        </Link>
      </Button>
      <SectionHeading
        title={t.admin.institutions.detail.notFoundTitle}
        description={t.admin.institutions.detail.notFoundDescription}
      />
    </div>
  );
}
