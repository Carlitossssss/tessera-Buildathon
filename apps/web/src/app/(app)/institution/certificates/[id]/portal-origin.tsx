import { ExternalLink, KeyRound } from 'lucide-react';
import { publicEnv } from '@/lib/env';

/**
 * Procedencia del certificado cuando lo origino el portal token-gated.
 *
 * Es la mitad que faltaba del circulo de Unlock: la pagina del portal muestra
 * la membresia antes de emitir, pero desde el certificado no habia forma de
 * saber que llave lo hizo posible. Aqui se ve el Lock concreto contra el que
 * se comprobo el acceso, de modo que la membresia queda demostrada como causa
 * de la credencial y no como un adorno.
 *
 * No renderiza nada para los certificados que no vienen del portal: la mayoria
 * se emite desde el panel y una tarjeta vacia solo seria ruido.
 */

interface PortalOrigin {
  fromPortal: boolean;
  content: { slug: string; title: string; kind: string } | null;
  achievement: string | null;
  membership: {
    lockAddress: string;
    chainId: number;
    network: string;
    wallet: string;
    keyExpiresAt: string | null;
    checkoutUrl: string;
  };
  completedAt: string | null;
}

/** Explorador por red, para poder abrir el Lock y comprobarlo on-chain. */
const EXPLORERS: Record<number, string> = {
  11155111: 'https://sepolia.etherscan.io',
  84532: 'https://sepolia.basescan.org',
  43113: 'https://testnet.snowtrace.io',
};

function short(value: string): string {
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export async function PortalOriginPanel({ certificateId }: { certificateId: string }) {
  const api = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '');

  // La procedencia es informativa: si la consulta falla, el certificado sigue
  // siendo valido y la pagina no debe romperse por ello.
  const origin = await fetch(`${api}/v1/portal/certificates/${certificateId}/origin`, {
    cache: 'no-store',
  })
    .then((res) => (res.ok ? (res.json() as Promise<{ data: PortalOrigin }>) : null))
    .then((body) => body?.data ?? null)
    .catch(() => null);

  if (!origin?.fromPortal) return null;

  const explorer = EXPLORERS[origin.membership.chainId];
  const lockUrl = explorer ? `${explorer}/address/${origin.membership.lockAddress}` : null;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-brand-500)]/25 bg-[var(--color-brand-500)]/[0.04]">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--color-brand-500)]/20 px-5 py-3.5">
        <KeyRound className="h-4 w-4 text-[var(--color-brand-300)]" />
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">
          Origen: membresía Unlock
        </h3>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-[var(--color-brand-300)]">
          token-gated
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <p className="text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
          Esta credencial se emitió porque la wallet demostró tener una llave válida del Lock
          indicado. Sin esa membresía el contenido no se habría abierto y el certificado no
          existiría.
        </p>

        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row label="Lock" value={short(origin.membership.lockAddress)} mono />
          <Row label="Red de la membresía" value={origin.membership.network} />
          <Row label="Wallet que desbloqueó" value={short(origin.membership.wallet)} mono />
          <Row
            label="Completado"
            value={
              origin.completedAt
                ? new Date(origin.completedAt).toLocaleString('es', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : '—'
            }
          />
        </dl>

        <div className="mt-5 flex flex-wrap gap-2.5">
          {origin.content ? (
            <a
              href={`/portal/${origin.content.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              Ver contenido en el portal <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {lockUrl ? (
            <a
              href={lockUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              Ver el Lock on-chain <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd className={`mt-0.5 truncate text-[13px] text-[var(--color-fg)] ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
