'use client';

import { Activity, CheckCircle, XCircle } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { CopyButton } from '@/components/ui/copy-button';
import { useT, type Dictionary } from '@tessera/i18n';

export type TesseraNetwork = {
  chainId: number;
  name: string;
  currency: string;
  explorer: string;
  purpose: 'issuance' | 'display' | 'membership' | 'institutional';
  role: string;
  rationale: string;
  value: string;
  contracts: Record<string, string>;
  verificationUnavailable: boolean;
  issuing: boolean;
};

export type HealthPayload = {
  status: 'ok' | 'degraded';
  responseMs: number;
  version: string;
  checks: Record<string, string>;
  networks?: TesseraNetwork[];
  blockchain: {
    network: string;
    chainId?: number;
    blockNumber: string;
    contracts?: Record<string, string>;
  } | null;
};

/**
 * Pagina publica de estado, en el idioma activo.
 *
 * `role`, `rationale` y `value` de cada red llegan del payload del API en
 * espanol (config/networks.ts, del lado del servidor) y no se traducen aqui:
 * bilingualizar esos textos exige bilingualizar la respuesta del API misma,
 * que queda fuera de esta pasada de frontend.
 */
export function StatusView({ health }: { health: HealthPayload | null }) {
  const t = useT();
  const checks = Object.entries(health?.checks ?? {});
  const ok = health?.status === 'ok';
  const networks = health?.networks ?? [];
  const contractLabels = contractLabelsFor(t);
  const checkLabels = checkLabelsFor(t);

  return (
    <article className="py-24">
      <Container size="lg">
        <div className="rounded-3xl border border-[var(--color-border)] bg-white/[0.02] p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-brand-200)]">
                Status
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-fg)]">
                {t.public.status.title}
              </h1>
              <p className="mt-3 text-sm text-[var(--color-fg-muted)]">{t.public.status.body}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/[0.03] px-4 py-2 text-sm text-[var(--color-fg)]">
              {ok ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 text-[var(--color-danger-500)]" />
              )}
              {ok ? t.public.status.operational : t.public.status.degraded}
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Metric label={t.public.status.metrics.apiVersion} value={health?.version ?? 'dev'} />
            <Metric
              label={t.public.status.metrics.response}
              value={`${health?.responseMs ?? 0}ms`}
            />
            <Metric
              label={t.public.status.metrics.network}
              value={health?.blockchain?.network ?? '—'}
            />
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {checks.map(([key, status]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] px-5 py-4"
            >
              <div className="flex items-center gap-3">
                {status === 'ok' ||
                key === 'signer' ||
                status === 'mock' ||
                status === 'unsealed' ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-[var(--color-danger-500)]" />
                )}
                <span className="text-sm font-medium text-[var(--color-fg)]">
                  {checkLabels[key] ?? key}
                </span>
              </div>
              <span className="font-mono text-xs text-[var(--color-fg-muted)]">{status}</span>
            </div>
          ))}
          {checks.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] px-5 py-4 text-sm text-[var(--color-fg-muted)]">
              {t.public.status.noChecks}
            </div>
          ) : null}
        </div>

        {networks.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-[var(--color-fg)]">
              {t.public.status.networksTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-fg-muted)]">
              {t.public.status.networksBody}
            </p>

            <div className="mt-5 space-y-4">
              {networks.map((net) => (
                <article
                  key={net.chainId}
                  className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white/[0.02]"
                >
                  <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
                    <h3 className="text-base font-semibold text-[var(--color-fg)]">{net.name}</h3>
                    <code className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                      {net.chainId}
                    </code>
                    {net.issuing ? (
                      <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                        {t.public.status.issuing}
                      </span>
                    ) : (
                      <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
                        {t.public.status.deployed}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] uppercase tracking-[0.12em] text-[var(--color-brand-200)]">
                      {net.role}
                    </span>
                  </header>

                  <div className="px-5 py-4 sm:px-6">
                    <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
                      {net.rationale}
                    </p>
                    <p className="mt-2 max-w-2xl border-l-2 border-[var(--color-brand-500)]/40 pl-3 text-[13px] leading-relaxed text-[var(--color-fg-subtle)]">
                      {net.value}
                    </p>

                    <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                      {Object.entries(net.contracts).map(([key, address]) => (
                        <div
                          key={key}
                          className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] px-4 py-2.5"
                        >
                          <dt className="w-[78px] shrink-0 text-xs text-[var(--color-fg-subtle)]">
                            {contractLabels[key] ?? key}
                          </dt>
                          <dd className="min-w-0 flex-1">
                            <a
                              href={`${net.explorer}/address/${address}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate font-mono text-xs text-[var(--color-fg)] transition-colors hover:text-[var(--color-brand-300)] hover:underline"
                            >
                              {address}
                            </a>
                          </dd>
                          <CopyButton value={address} />
                        </div>
                      ))}
                    </dl>

                    {net.verificationUnavailable ? (
                      <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
                        {t.public.status.verificationUnavailable}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </Container>
    </article>
  );
}

function contractLabelsFor(t: Dictionary): Record<string, string> {
  return {
    registry: t.public.status.contracts.registry,
    certificate: t.public.status.contracts.certificate,
    badge: t.public.status.contracts.badge,
    autoIssuer: t.public.status.contracts.autoIssuer,
  };
}

function checkLabelsFor(t: Dictionary): Record<string, string> {
  return {
    db: t.public.status.checks.db,
    redis: t.public.status.checks.redis,
    rpc: t.public.status.checks.rpc,
    arweave: t.public.status.checks.arweave,
    signer: t.public.status.checks.signer,
    openbao: t.public.status.checks.openbao,
    stripeWebhook: t.public.status.checks.stripeWebhook,
    email: t.public.status.checks.email,
  };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        <Activity className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-3 text-xl font-semibold text-[var(--color-fg)]">{value}</p>
    </div>
  );
}
