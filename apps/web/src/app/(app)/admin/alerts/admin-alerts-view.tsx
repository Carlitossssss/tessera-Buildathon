'use client';

import { CheckCircle } from 'lucide-react';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from '@/components/dashboard/stat-card';
import { relativeTime } from '@/lib/format';
import { OperationalCard } from '../operational-card';
import { resolveAdminAlertAction } from '../actions';
import { SEVERITY } from './severity';
import type { adminApi } from '@/lib/api/endpoints/admin';

type AlertsPayload = Awaited<ReturnType<typeof adminApi.alerts>>;

export function AdminAlertsView({ payload }: { payload: AlertsPayload }) {
  const t = useT();
  const copy = t.admin.alerts;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <OperationalCard
          href="/admin/alerts"
          value={payload.totals.open}
          badge={copy.cards.open.badge}
          title={copy.cards.open.title}
          description={copy.cards.open.description}
        />
        <OperationalCard
          href="/admin/alerts"
          value={payload.totals.errors}
          badge={copy.cards.critical.badge}
          title={copy.cards.critical.title}
          description={copy.cards.critical.description}
        />
        <OperationalCard
          href="/admin/alerts"
          value={payload.totals.warnings}
          badge={copy.cards.warnings.badge}
          title={copy.cards.warnings.title}
          description={copy.cards.warnings.description}
        />
      </div>

      <SectionHeading title={copy.heading.title} description={copy.heading.description} />

      <div className="space-y-3">
        {payload.data.map((alert) => {
          const s = SEVERITY[alert.severity as keyof typeof SEVERITY] ?? SEVERITY.info;
          const Icon = s.icon;
          return (
            <div
              key={alert.id}
              className={`rounded-2xl border ${s.border} ${s.bg} px-5 py-4 ${alert.resolved ? 'opacity-50' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.color}`} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--color-fg)]">{alert.title}</p>
                      {alert.resolved && <Badge variant="default">{copy.resolved}</Badge>}
                    </div>
                    <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                      {alert.description}
                    </p>
                    <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
                      {relativeTime(alert.createdAt)}
                    </p>
                  </div>
                </div>
                {!alert.resolved && (
                  <form action={resolveAdminAlertAction} className="flex gap-2">
                    <input type="hidden" name="alertId" value={alert.id} />
                    <Button size="sm" variant="ghost" type="submit">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {copy.resolve}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
