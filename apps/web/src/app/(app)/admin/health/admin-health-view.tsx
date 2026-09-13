'use client';

import { CheckCircle, XCircle } from 'lucide-react';
import { useT, type Dictionary } from '@tessera/i18n';
import { SectionHeading } from '@/components/dashboard/stat-card';
import { OperationalCard } from '../operational-card';

type HealthPayload = {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeMs: number;
  responseMs: number;
  version: string;
  checks: Record<string, string>;
  blockchain: { network: string; blockNumber: string } | null;
};

function checkDetail(name: string, status: string, health: HealthPayload, t: Dictionary): string {
  const d = t.admin.health.details;
  if (name === 'rpc' && health.blockchain) {
    return d.rpcBlock.replace('{block}', health.blockchain.blockNumber);
  }
  if (name === 'db') return status === 'ok' ? d.dbOk : d.dbDown;
  if (name === 'redis') return status === 'ok' ? d.redisOk : d.redisDown;
  if (name === 'arweave') {
    return status === 'not_configured'
      ? d.arweaveNotConfigured
      : status === 'ok'
        ? d.arweaveOk
        : d.arweaveDegraded;
  }
  if (name === 'pinata') {
    return status === 'not_configured' ? d.notConfigured : status === 'ok' ? d.pinataOk : d.pinataDegraded;
  }
  if (name === 'objectStorage') {
    return status === 'not_configured'
      ? d.notConfigured
      : status === 'minio'
        ? d.objectStorageMinio
        : d.objectStorageOther.replace('{status}', status.toUpperCase());
  }
  if (name === 'stripeWebhook') {
    return status === 'ok' ? d.stripeWebhookOk : d.stripeWebhookDown;
  }
  if (name === 'email') return status === 'ok' ? d.emailOk : d.emailMock;
  if (name === 'signer') {
    if (status === 'web3signer') return d.signerWeb3;
    if (status === 'openbao') return d.signerOpenbao;
    if (status === 'local') return d.signerLocal;
    return d.notConfigured;
  }
  return status;
}

function checkName(name: string, t: Dictionary): string {
  const labels = t.admin.health.checkNames as Record<string, string>;
  return labels[name] ?? name;
}

function isHealthyCheck(name: string, status: string) {
  if (status === 'ok') return true;
  if (name === 'signer') return ['web3signer', 'openbao', 'local'].includes(status);
  if (name === 'objectStorage') return ['minio', 'r2', 's3'].includes(status);
  return false;
}

export function AdminHealthView({ health }: { health: HealthPayload }) {
  const t = useT();
  const copy = t.admin.health;

  const checks = Object.entries(health.checks).map(([name, status]) => ({
    id: name,
    name: checkName(name, t),
    status,
    detail: checkDetail(name, status, health, t),
  }));
  const ok = checks.filter((c) => isHealthyCheck(c.id, c.status)).length;
  const total = checks.length;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <OperationalCard
          href="/admin/health"
          value={health.status === 'ok' ? copy.status.healthy : copy.status.degraded}
          badge={copy.cards.overall.badge}
          title={copy.cards.overall.title}
          description={copy.cards.overall.description
            .replace('{ok}', String(ok))
            .replace('{total}', String(total))}
        />
        <OperationalCard
          href="/admin/health"
          value={health.version}
          badge={copy.cards.version.badge}
          title={copy.cards.version.title}
          description={copy.cards.version.description}
        />
        <OperationalCard
          href="/admin/health"
          value={`${ok}/${total}`}
          badge={copy.cards.services.badge}
          title={copy.cards.services.title}
          description={copy.cards.services.description}
        />
      </div>

      <SectionHeading title={copy.heading.title} description={copy.heading.description} />

      <div className="space-y-2">
        {checks.map((check) => (
          <div
            key={check.name}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-5 py-3"
          >
            <div className="flex items-center gap-3">
              {isHealthyCheck(check.id, check.status) ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-[var(--color-danger-500)]" />
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">{check.name}</p>
                <p className="text-xs text-[var(--color-fg-muted)]">{check.detail}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-semibold text-[var(--color-fg-muted)]">
                {check.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--color-fg-subtle)]">{copy.note}</p>
    </div>
  );
}
