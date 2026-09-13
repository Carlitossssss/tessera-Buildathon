'use client';

import { Download, Shield, Trash2 } from 'lucide-react';
import { useT, type Dictionary } from '@tessera/i18n';
import { Badge } from '@/components/ui/badge';
import { PrivacyActions } from './privacy-actions';

const PANEL =
  'rounded-[26px] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.88),rgba(10,13,26,0.96))] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]';

/** Las categorias de datos y su base juridica, en el idioma activo. */
function categoriesFor(t: Dictionary) {
  const c = t.student.privacy.categories;
  const basis = t.student.privacy.basis;
  return [
    { label: c.profile.label, desc: c.profile.desc, basis: basis.contract },
    { label: c.onchain.label, desc: c.onchain.desc, basis: basis.legitimate },
    { label: c.progress.label, desc: c.progress.desc, basis: basis.contract },
    { label: c.session.label, desc: c.session.desc, basis: basis.legitimate },
  ];
}

export function PrivacyView({
  selectedName,
  selectedDetail,
}: {
  selectedName: string;
  selectedDetail: string;
}) {
  const t = useT();
  const categories = categoriesFor(t);
  const name = selectedName || t.student.privacy.myAccount;

  return (
    <div className="space-y-10">
      <header className={`${PANEL} relative overflow-hidden p-8 lg:p-10`}>
        <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(50%_45%_at_85%_15%,rgba(94,109,255,0.18),transparent_70%)]" />
        <div className="relative">
          <Badge variant="brand" className="uppercase tracking-[0.18em]">
            <Shield className="h-3 w-3" /> GDPR \u00b7 LFPDPPP
          </Badge>
          <h1 className="mt-5 text-[32px] font-semibold leading-[1.05] tracking-tight text-[var(--color-fg)] lg:text-[40px]">
            {t.student.privacy.title}
          </h1>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-[var(--color-fg-muted)]">
            {t.student.privacy.body}
          </p>
        </div>
      </header>

      <section className={`${PANEL} grid gap-5 p-8 lg:grid-cols-[auto_1fr] lg:items-start lg:gap-8`}>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
          <Download className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
            {t.student.privacy.export.title}
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
            {t.student.privacy.export.body}
          </p>
          <PrivacyActions kind="export" />
        </div>
      </section>

      <section className={`${PANEL} p-8`}>
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
          {t.student.privacy.categoriesTitle}
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] text-[var(--color-fg-muted)]">
          {t.student.privacy.categoriesBody}
        </p>
        <div className="mt-6 space-y-3">
          {categories.map((item) => (
            <div
              key={item.label}
              className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] px-4 py-4"
            >
              <div>
                <p className="text-[14px] font-medium text-[var(--color-fg)]">{item.label}</p>
                <p className="mt-1 text-[12.5px] text-[var(--color-fg-muted)]">{item.desc}</p>
              </div>
              <Badge variant="default">{item.basis}</Badge>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[26px] border border-red-500/30 bg-red-500/[0.04] p-8">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10 text-red-300">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
              {t.student.privacy.delete.title}
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
              {t.student.privacy.delete.bodyStart}{' '}
              <strong className="text-[var(--color-fg)]">{t.student.privacy.delete.bodyDays}</strong>{' '}
              {t.student.privacy.delete.bodyEnd}
            </p>
            <PrivacyActions
              kind="delete"
              accountRole="student"
              selectedName={name}
              selectedDetail={selectedDetail}
            />
          </div>
        </div>
      </section>

      <p className="text-center text-[12px] text-[var(--color-fg-subtle)]">
        {t.student.privacy.contact}{' '}
        <a href="mailto:privacy@tessera.io" className="underline hover:text-[var(--color-fg)]">
          privacy@tessera.io
        </a>
      </p>
    </div>
  );
}
