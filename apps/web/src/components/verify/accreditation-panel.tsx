'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BadgeCheck,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { publicEnv } from '@/lib/env';

/**
 * Acreditación institucional verificable on-chain.
 *
 * Responde la pregunta que alguien se hace antes de creer en un diploma:
 * ¿quién respalda a esta institución, y puedo comprobarlo sin confiar en la
 * plataforma que lo afirma?
 *
 * Todo lo que se muestra se lee de los contratos. Y se entregan los comandos
 * para repetir la consulta por cuenta propia: una acreditación que sólo puede
 * verificarse preguntándole a quien la emite no le prueba nada a un tercero.
 *
 * El diseño refuerza esa idea: cada red es una tarjeta con su propio estado, y
 * la verificación independiente está a un clic, no escondida.
 */

interface ChainAccreditation {
  chainId: number;
  network: string;
  role: 'issuance' | 'audit';
  accredited: boolean | null;
  unavailableReason: string | null;
  registry: string | null;
  explorerUrl: string | null;
  verifyCommand: string | null;
}

export interface AccreditationData {
  institution: {
    name: string;
    slug: string;
    country: string | null;
    walletAddress: string;
    approvedAt: string | null;
  };
  chains: ChainAccreditation[];
}

const API = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '');

interface Props {
  slug: string;
  /**
   * Se llama cuando cambia el estado leído de la cadena. Permite que la página
   * que contiene el panel reaccione —por ejemplo, ocultando el botón de
   * acreditar cuando ya no hace falta— sin duplicar la consulta.
   */
  onLoaded?: (data: AccreditationData) => void;
}

export function AccreditationPanel({ slug, onLoaded }: Props) {
  const reduced = useReducedMotion();
  const [data, setData] = useState<AccreditationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  // Cambiar este valor relanza la lectura. Hace falta porque este panel es un
  // componente cliente: revalidatePath del servidor no lo alcanza, y tras
  // acreditar seguiría mostrando el estado anterior.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/v1/public/institutions/${encodeURIComponent(slug)}/accreditation`, {
      cache: 'no-store',
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ data: AccreditationData }>) : null))
      .then((body) => {
        if (!alive) return;
        setData(body?.data ?? null);
        if (body?.data) onLoaded?.(body.data);
      })
      .catch(() => {
        if (alive) setData(null);
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      alive = false;
    };
    // onLoaded se omite a propósito: si el padre lo recrea en cada render,
    // incluirlo dispararía la lectura en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, reloadKey]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setReloadKey((k) => k + 1);
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4 sm:p-5">
        <p className="flex items-center gap-2 text-[13px] text-[var(--color-fg-muted)]">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          Leyendo la acreditación on-chain…
        </p>
      </section>
    );
  }

  // Información adicional: si la API no responde, la página sigue siendo
  // válida y el panel simplemente no se dibuja.
  if (!data) return null;

  const commands = data.chains.map((c) => c.verifyCommand).filter((c): c is string => Boolean(c));

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-accent-500)]/25 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-accent-500),transparent_94%),transparent)]">
      {/* El encabezado envuelve en móvil: el título y los controles no caben
          en una línea a 360px, y apretarlos los vuelve ilegibles. */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--color-accent-500)]/20 px-4 py-3.5 sm:px-5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/10">
          <Landmark className="h-3.5 w-3.5 text-[var(--color-accent-400)]" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-[var(--color-fg)]">
            Acreditación on-chain
          </h2>
          <p className="mt-0.5 truncate text-[11px] text-[var(--color-fg-subtle)]">
            Leída de los contratos, no de nuestra base
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[11px] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)] disabled:opacity-60"
          aria-label="Volver a leer el estado en la cadena"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
          <span className="hidden sm:inline">{refreshing ? 'Leyendo…' : 'Actualizar'}</span>
        </button>
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        {/* Una columna en móvil, dos desde sm. Cada tarjeta es autónoma, así
            que apilarlas no pierde contexto. */}
        <div className="grid gap-3 sm:grid-cols-2">
          {data.chains.map((chain, index) => (
            <motion.div
              key={chain.chainId}
              initial={{ opacity: 0, y: reduced ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduced ? 0.2 : 0.4,
                delay: reduced ? 0 : index * 0.07,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <ChainCard chain={chain} />
            </motion.div>
          ))}
        </div>

        <dl className="grid gap-x-6 gap-y-3 border-t border-[var(--color-accent-500)]/15 pt-4 sm:grid-cols-2">
          <Row label="Wallet emisora" value={data.institution.walletAddress} copyable mono />
          <Row
            label="Aprobada"
            value={
              data.institution.approvedAt
                ? new Date(data.institution.approvedAt).toLocaleDateString('es', {
                    dateStyle: 'medium',
                  })
                : '—'
            }
          />
        </dl>

        {commands.length > 0 ? (
          <div className="border-t border-[var(--color-accent-500)]/15 pt-4">
            <button
              type="button"
              onClick={() => setShowCommands((v) => !v)}
              aria-expanded={showCommands}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 py-2 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
            >
              <Terminal className="h-3.5 w-3.5 shrink-0" />
              Comprobalo vos mismo
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 transition-transform duration-300',
                  showCommands && 'rotate-180',
                )}
              />
            </button>

            <AnimatePresence initial={false}>
              {showCommands ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduced ? 0.15 : 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3 rounded-xl border border-[var(--color-border)] bg-black/30 p-3.5">
                    <p className="text-[12px] leading-relaxed text-[var(--color-fg-subtle)]">
                      Con Foundry instalado, estos comandos consultan los contratos directamente y
                      devuelven lo mismo que ves arriba. No pasan por Tessera.
                    </p>
                    {commands.map((cmd) => (
                      <CommandLine key={cmd} command={cmd} />
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ChainCard({ chain }: { chain: ChainAccreditation }) {
  // Tres estados y no dos: "no acreditada" y "no pudimos leerlo" no son lo
  // mismo, y mostrarlos igual sería engañoso.
  const unknown = chain.accredited === null;
  const ok = chain.accredited === true;

  return (
    <div
      className={cn(
        'h-full rounded-xl border p-3.5 transition-colors',
        ok
          ? 'border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/[0.06]'
          : unknown
            ? 'border-[var(--color-border)] bg-white/[0.02]'
            : 'border-[var(--color-warning-500)]/25 bg-[var(--color-warning-500)]/[0.04]',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {unknown ? (
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-subtle)]" />
        ) : (
          <BadgeCheck
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              ok ? 'text-[var(--color-accent-400)]' : 'text-[var(--color-warning-500)]',
            )}
          />
        )}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-fg)]">
          {chain.network}
        </span>
        <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
          {chain.role === 'issuance' ? 'emisión' : 'auditoría'}
        </span>
      </div>

      <p
        className={cn(
          'mt-2.5 text-[13px] font-semibold',
          unknown && 'text-[var(--color-fg-subtle)]',
          ok && 'text-[var(--color-accent-400)]',
          !unknown && !ok && 'text-[var(--color-warning-500)]',
        )}
      >
        {unknown ? 'No disponible' : ok ? 'Acreditada' : 'No acreditada'}
      </p>

      {/* "No acreditada" a secas deja dudando si es un fallo o algo pendiente.
          La explicación depende del papel de la red. */}
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
        {chain.unavailableReason
          ? chain.unavailableReason
          : ok
            ? chain.role === 'issuance'
              ? 'El contrato la reconoce como emisor autorizado.'
              : 'Su acreditación es auditable de forma independiente en esta red.'
            : chain.role === 'issuance'
              ? 'Esta red habilita la emisión: sin acreditación no puede emitir certificados.'
              : 'Aún no se registró en esta red de auditoría. No afecta a los certificados ya emitidos.'}
      </p>

      {chain.explorerUrl ? (
        <a
          href={chain.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 inline-flex items-center gap-1 text-[11px] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          Ver el registro <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : null}
    </div>
  );
}

/**
 * Comando con botón de copiar.
 *
 * El comando es largo y en móvil se corta: copiarlo es el único modo práctico
 * de usarlo desde un teléfono, así que el botón no es un adorno.
 */
function CommandLine({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* sin portapapeles: el texto sigue seleccionable a mano */
    }
  }, [command]);

  return (
    <div className="group relative rounded-lg border border-[var(--color-border)] bg-black/40">
      <pre className="overflow-x-auto px-3 py-2.5 pr-11 font-mono text-[11px] leading-relaxed text-[var(--color-accent-400)]">
        {command}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        aria-label={copied ? 'Comando copiado' : 'Copiar comando'}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-[var(--color-accent-400)]" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
  copyable = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }, [value]);

  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-1.5">
        {/* break-all y no truncate: una address cortada con puntos suspensivos
            no se puede leer ni comparar, que es justo para lo que se mira. */}
        <span
          className={cn(
            'min-w-0 break-all text-[13px] text-[var(--color-fg)]',
            mono && 'font-mono text-[12px]',
          )}
        >
          {value}
        </span>
        {copyable ? (
          <button
            type="button"
            onClick={copy}
            className="shrink-0 text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]"
            aria-label={copied ? 'Copiado' : `Copiar ${label.toLowerCase()}`}
          >
            {copied ? (
              <Check className="h-3 w-3 text-[var(--color-accent-400)]" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        ) : null}
      </dd>
    </div>
  );
}
