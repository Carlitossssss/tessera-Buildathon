'use client';

import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  ChevronDown,
  ExternalLink,
  Fingerprint,
  Link2Off,
  Loader2,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { publicEnv } from '@/lib/env';
import { cn } from '@/lib/utils';
import { useT } from '@tessera/i18n';

/**
 * Procedencia on-chain del certificado.
 *
 * Un diploma es un activo del mundo real: alguien concreto responde por él.
 * Este panel contesta las tres preguntas que hacen que eso sea auditable
 * —quién lo emitió, si estaba autorizado, y si puede venderse— leyendo todo
 * del contrato, no de nuestra base de datos.
 *
 * Incluye los comandos para repetir la lectura sin pasar por Tessera. Ese es
 * el punto: una afirmación de procedencia que sólo puede comprobarse con
 * nuestra propia API no le prueba nada a un tercero.
 */

interface Provenance {
  chainId: number;
  network: string;
  tokenId: string;
  issuer: string | null;
  issuerApproved: boolean | null;
  soulbound: boolean | null;
  owner: string | null;
  explorerUrl: string;
  verifyCommands: string[];
  unavailableReason?: string;
}

const API = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '');

function short(value: string): string {
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export function ProvenancePanel({ tokenId, chainId }: { tokenId: string; chainId?: number }) {
  const t = useT();
  const p = t.public.verify.provenance;
  const [data, setData] = useState<Provenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCommands, setShowCommands] = useState(false);

  useEffect(() => {
    let alive = true;
    const query = chainId ? `?chainId=${chainId}` : '';

    fetch(`${API}/v1/certificates/${tokenId}/provenance${query}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ data: Provenance }>) : null))
      .then((body) => {
        if (alive) setData(body?.data ?? null);
      })
      .catch(() => {
        if (alive) setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [tokenId, chainId]);

  // La procedencia es información adicional: si el RPC no responde, el
  // certificado sigue siendo válido y la página no debe mostrar un error.
  if (loading) {
    return (
      <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
        <p className="flex items-center gap-2 text-[13px] text-[var(--color-fg-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {p.loading}
        </p>
      </section>
    );
  }

  if (!data || !data.issuer) return null;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-accent-500)]/25 bg-[var(--color-accent-500)]/[0.035]">
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-[var(--color-accent-500)]/20 px-4 py-3.5 sm:px-5">
        <Fingerprint className="h-4 w-4 shrink-0 text-[var(--color-accent-400)]" />
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">{p.title}</h2>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent-400)]">
          {data.network}
        </span>
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        <p className="text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
          {p.body}
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Fact
            icon={Fingerprint}
            label={p.issuedBy}
            value={short(data.issuer)}
            hint="certificateIssuer()"
            mono
          />
          <Fact
            icon={BadgeCheck}
            label={p.issuerApproved}
            value={data.issuerApproved ? p.approvedYes : p.approvedNo}
            hint="isApprovedInstitution()"
            tone={data.issuerApproved ? 'ok' : 'warn'}
          />
          <Fact
            icon={data.soulbound ? Link2Off : ShieldCheck}
            label={p.transferable}
            value={data.soulbound ? p.soulboundYes : p.soulboundNo}
            hint="locked() · ERC-5192"
            tone={data.soulbound ? 'ok' : 'warn'}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={data.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            {p.viewContract} <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <button
            type="button"
            onClick={() => setShowCommands((v) => !v)}
            aria-expanded={showCommands}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            <Terminal className="h-3.5 w-3.5" />
            {p.checkYourself}
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', showCommands && 'rotate-180')}
            />
          </button>
        </div>

        {showCommands ? (
          <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-black/30 p-3.5">
            <p className="text-[12px] leading-relaxed text-[var(--color-fg-subtle)]">
              {p.commandsIntro}
            </p>
            <div className="space-y-1.5 overflow-x-auto">
              {data.verifyCommands.map((cmd) => (
                <pre
                  key={cmd}
                  className="whitespace-pre font-mono text-[11px] leading-relaxed text-[var(--color-accent-400)]"
                >
                  {cmd}
                </pre>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  hint,
  mono = false,
  tone = 'neutral',
}: {
  icon: typeof Fingerprint;
  label: string;
  value: string;
  hint: string;
  mono?: boolean;
  tone?: 'ok' | 'warn' | 'neutral';
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </div>
      <p
        className={cn(
          'mt-1.5 truncate text-[13px] font-medium',
          mono && 'font-mono',
          tone === 'ok' && 'text-[var(--color-accent-400)]',
          tone === 'warn' && 'text-[var(--color-warning-500)]',
          tone === 'neutral' && 'text-[var(--color-fg)]',
        )}
      >
        {value}
      </p>
      <p className="mt-1 truncate font-mono text-[10px] text-[var(--color-fg-subtle)]">{hint}</p>
    </div>
  );
}
