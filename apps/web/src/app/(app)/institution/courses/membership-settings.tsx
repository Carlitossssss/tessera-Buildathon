'use client';

import { useEffect, useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ExternalLink,
  Info,
  Key,
  Loader2,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/ui/copy-button';
import type { LockVerification } from '@/lib/api/endpoints/me';
import { saveDefaultLockAction, verifyLockAction } from '../actions';
import { LOCK_CHAINS, isValidLockAddress } from './lock-fields';

/**
 * Lock de la institución: el contrato que cobra sus membresías.
 *
 * Antes esto era un campo de texto que daba por bueno cualquier cosa con
 * forma de dirección: decía "configurado" sin haber leído una sola función
 * del contrato. Una dirección con la forma correcta pero inexistente dejaba
 * el curso imposible de matricular, y nadie se enteraba hasta que un alumno
 * lo intentaba.
 *
 * Ahora se lee contra la cadena antes de guardar y se muestra lo que se
 * encontró. La diferencia no es cosmética: "verificado" significa que alguien
 * leyó el contrato, no que el texto tenía 42 caracteres.
 *
 * El Lock es de la institución y no de Tessera porque quien lo despliega es
 * quien cobra. Si fuera nuestro, el dinero de las membresías llegaría a
 * nuestra wallet y tendríamos que devolverlo: seríamos un intermediario
 * financiero, que es justo lo que Unlock existe para evitar.
 */

interface Props {
  initialLockAddress: string | null;
  initialLockChainId: number | null;
}

const EXPLORERS: Record<number, string> = {
  11155111: 'https://sepolia.etherscan.io',
  84532: 'https://sepolia.basescan.org',
  43113: 'https://testnet.snowtrace.io',
};

export function MembershipSettings({ initialLockAddress, initialLockChainId }: Props) {
  const [address, setAddress] = useState(initialLockAddress ?? '');
  const [chainId, setChainId] = useState<number>(initialLockChainId ?? LOCK_CHAINS[0].id);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);
  const [reading, setReading] = useState<LockVerification | null>(null);
  const [pending, start] = useTransition();
  const [checking, startCheck] = useTransition();

  useEffect(() => {
    setAddress(initialLockAddress ?? '');
    setChainId(initialLockChainId ?? LOCK_CHAINS[0].id);
    setReading(null);
  }, [initialLockAddress, initialLockChainId]);

  const configured = Boolean(initialLockAddress);
  const trimmed = address.trim();
  const invalid = trimmed.length > 0 && !isValidLockAddress(trimmed);
  const dirty = trimmed !== (initialLockAddress ?? '') || chainId !== initialLockChainId;

  // La lectura deja de valer en cuanto se toca la dirección o la red: si se
  // quedara en pantalla, describiría un Lock distinto del que está escrito.
  function edit(next: { address?: string; chainId?: number }) {
    if (next.address !== undefined) setAddress(next.address);
    if (next.chainId !== undefined) setChainId(next.chainId);
    setReading(null);
    setFeedback(null);
  }

  function verify() {
    if (!isValidLockAddress(trimmed)) {
      setFeedback({ tone: 'error', message: 'Pegá una dirección válida (0x… y 40 caracteres).' });
      return;
    }
    setFeedback(null);
    startCheck(async () => {
      const res = await verifyLockAction({ lockAddress: trimmed, lockChainId: chainId });
      if (res.ok && res.data) setReading(res.data);
      else setFeedback({ tone: 'error', message: res.ok ? 'No se pudo leer' : res.error });
    });
  }

  function save(clear = false) {
    setFeedback(null);

    if (!clear && !isValidLockAddress(trimmed)) {
      setFeedback({ tone: 'error', message: 'Pegá una dirección válida (0x… y 40 caracteres).' });
      return;
    }

    start(async () => {
      const res = await saveDefaultLockAction(
        clear
          ? { lockAddress: null, lockChainId: null }
          : { lockAddress: trimmed, lockChainId: chainId },
      );
      if (res.ok) {
        setFeedback({
          tone: 'ok',
          message: clear ? 'Se quitó el Lock.' : 'Lock guardado. Ya se propone al crear cursos.',
        });
        if (clear) {
          setAddress('');
          setReading(null);
        }
      } else {
        setFeedback({ tone: 'error', message: res.error });
      }
    });
  }

  const explorer = EXPLORERS[chainId];
  const lockUrl = explorer && trimmed ? `${explorer}/address/${trimmed}` : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-brand-500)]/25 bg-[color-mix(in_oklab,var(--color-brand-500),transparent_95%)]">
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-[var(--color-brand-500)]/20 px-4 py-3.5 sm:px-5">
        <Key className="h-4 w-4 shrink-0 text-[var(--color-brand-300)]" />
        <div className="min-w-0">
          {/* El título nombra lo que la institución consigue, no el protocolo
              que hay debajo. "Tu Lock de membresía" obligaba a saber qué es un
              Lock antes de entender para qué sirve la pantalla. */}
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">
            Cobrar por tus cursos
          </h2>
          <p className="text-[11.5px] text-[var(--color-fg-subtle)]">
            El contrato que vende el acceso y verifica quién pagó
          </p>
        </div>
        <StatusChip configured={configured} reading={reading} />
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        {/* Por qué el Lock es suyo. Sin esto, la pantalla parece pedir un dato
            arbitrario y la institución no sabe qué está pegando. */}
        <div className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-black/20 p-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
          <div className="space-y-2 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
            <p>
              Un <strong className="text-[var(--color-fg)]">Lock</strong> es el contrato de Unlock
              que vende y verifica tus membresías.{' '}
              <strong className="text-[var(--color-fg)]">
                El dinero va directo a la wallet que lo despliega
              </strong>
              , sin pasar por Tessera.
            </p>
            <p>
              Por eso el Lock es tuyo: si usaras uno ajeno, los pagos irían a esa otra wallet y sus
              miembros entrarían gratis a tus cursos.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,200px)]">
          <div className="grid gap-2">
            <Label htmlFor="default-lock-address">Dirección del Lock</Label>
            <Input
              id="default-lock-address"
              value={address}
              onChange={(e) => edit({ address: e.target.value })}
              placeholder="0x…"
              className="font-mono text-[13px]"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={invalid || undefined}
            />
            {invalid ? (
              <p className="text-[11px] text-[var(--color-danger-500)]">
                Debe empezar con 0x y tener 40 caracteres hexadecimales.
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="default-lock-chain">Red</Label>
            <select
              id="default-lock-chain"
              value={chainId}
              onChange={(e) => edit({ chainId: Number(e.target.value) })}
              className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm text-[var(--color-fg)] outline-none transition-colors focus:border-[var(--color-brand-500)]/60"
            >
              {LOCK_CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {reading ? <LockReadout key="readout" reading={reading} lockUrl={lockUrl} /> : null}
        </AnimatePresence>

        <AnimatePresence>
          {feedback ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={
                feedback.tone === 'ok'
                  ? 'flex items-start gap-2 text-[13px] text-[var(--color-accent-400)]'
                  : 'flex items-start gap-2 text-[13px] text-[var(--color-danger-500)]'
              }
            >
              {feedback.tone === 'ok' ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              {feedback.message}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Comprobar va antes que guardar, y es lo que convierte esta
              pantalla en algo verificable en vez de un acto de fe. */}
          <Button variant="outline" onClick={verify} disabled={checking || !trimmed || invalid}>
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Comprobar en la red
          </Button>

          <Button onClick={() => save(false)} disabled={pending || !dirty || invalid}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Guardar Lock
          </Button>

          {configured ? (
            <>
              <CopyButton
                value={initialLockAddress ?? ''}
                label="Copiar dirección"
                variant="ghost"
              />
              <Button variant="ghost" onClick={() => save(true)} disabled={pending}>
                Quitar
              </Button>
            </>
          ) : null}
        </div>

        {!configured ? <CreateLockGuide /> : null}

        <p className="text-[12px] leading-relaxed text-[var(--color-fg-subtle)]">
          Este Lock se propone al crear cursos con membresía. Podés usar otro distinto en cada curso
          si querés un precio propio.
        </p>
      </div>
    </section>
  );
}

/**
 * Insignia del encabezado.
 *
 * Distingue "guardado" de "verificado": lo primero dice que hay un texto
 * escrito, lo segundo que alguien leyó el contrato. Confundirlos es
 * exactamente lo que hacía la versión anterior.
 */
function StatusChip({
  configured,
  reading,
}: {
  configured: boolean;
  reading: LockVerification | null;
}) {
  const base =
    'ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider';

  if (reading?.status === 'ok') {
    return (
      <span className={`${base} border-[var(--color-accent-500)]/30 text-[var(--color-accent-400)]`}>
        <ShieldCheck className="h-3 w-3" /> verificado
      </span>
    );
  }
  if (reading?.status === 'foreign-owner') {
    return (
      <span className={`${base} border-[var(--color-warning-500)]/40 text-[var(--color-warning-500)]`}>
        <AlertTriangle className="h-3 w-3" /> dueño ajeno
      </span>
    );
  }
  if (reading?.status === 'not-a-lock') {
    return (
      <span className={`${base} border-[var(--color-danger-500)]/40 text-[var(--color-danger-500)]`}>
        <AlertCircle className="h-3 w-3" /> no es un Lock
      </span>
    );
  }
  if (configured) {
    return (
      <span className={`${base} border-[var(--color-border)] text-[var(--color-fg-muted)]`}>
        <Check className="h-3 w-3" /> guardado
      </span>
    );
  }
  return (
    <span className={`${base} border-[var(--color-warning-500)]/30 text-[var(--color-warning-500)]`}>
      <AlertCircle className="h-3 w-3" /> sin configurar
    </span>
  );
}

/**
 * Lo que la cadena dijo del Lock.
 *
 * Todo esto es público y se lee en un segundo; no mostrarlo era desperdiciar
 * la única forma que tiene la institución de reconocer su propio contrato.
 */
function LockReadout({
  reading,
  lockUrl,
}: {
  reading: LockVerification;
  lockUrl: string | null;
}) {
  if (reading.status === 'unreadable') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-black/20 p-3.5"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
        <p className="text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
          No se pudo leer ese contrato ahora mismo. Puede ser la red, no la dirección: probá de
          nuevo en un momento. Podés guardarlo igual si estás seguro de que es el correcto.
        </p>
      </motion.div>
    );
  }

  /**
   * Una wallet pegada donde va el Lock.
   *
   * Es el error mas frecuente de esta pantalla, y lo provocabamos nosotros:
   * mostrabamos «los pagos van a 0xEe10…» justo encima del campo, asi que esa
   * direccion era la ultima que la persona habia visto. Ademas el mensaje
   * decia «puede ser la red, no la direccion» —culpando al RPC cuando el
   * problema era justamente la direccion— y dejaba reintentando sin entender.
   */
  if (reading.status === 'not-a-contract') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="flex gap-3 rounded-xl border border-[var(--color-warning-500)]/35 bg-[var(--color-warning-500)]/[0.07] p-3.5"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning-500)]" />
        <div className="space-y-1.5 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
          <p className="font-medium text-[var(--color-fg)]">Eso es una wallet, no el Lock</p>
          <p>
            En esa dirección no hay ningún contrato desplegado. El Lock es el contrato que crea
            Unlock, y su dirección es distinta de la de la wallet con la que lo creaste.
          </p>
          <p>
            Entrá a{' '}
            <a
              href="https://app.unlock-protocol.com"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-brand-300)] underline underline-offset-2 hover:text-[var(--color-brand-200)]"
            >
              app.unlock-protocol.com
            </a>
            , abrí tu Lock y copiá la dirección que aparece en su ficha.
          </p>
        </div>
      </motion.div>
    );
  }

  if (reading.status === 'not-a-lock') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="flex gap-3 rounded-xl border border-[var(--color-danger-500)]/35 bg-[var(--color-danger-500)]/[0.07] p-3.5"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger-500)]" />
        <div className="space-y-1 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
          <p className="font-medium text-[var(--color-fg)]">Esa dirección no es un Lock</p>
          <p>
            Existe en {reading.network ?? 'la red elegida'}, pero no responde como un contrato de
            Unlock. Revisá que sea la dirección del Lock y no la de tu wallet ni la de otro
            contrato.
          </p>
        </div>
      </motion.div>
    );
  }

  const foreign = reading.status === 'foreign-owner';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-3 rounded-xl border border-[var(--color-border)] bg-black/25 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-accent-400)]" />
        <p className="text-[13px] font-medium text-[var(--color-fg)]">
          {reading.name ? `«${reading.name}»` : 'Lock encontrado'}
        </p>
        {reading.version ? (
          <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-fg-subtle)]">
            PublicLock v{reading.version}
          </span>
        ) : null}
        {lockUrl ? (
          <a
            href={lockUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-[var(--color-brand-300)] hover:text-[var(--color-brand-200)]"
          >
            Ver en el explorador <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Fact label="Precio" value={reading.price ?? '—'} />
        <Fact label="Duración" value={reading.duration ?? '—'} />
        <Fact
          label="Llaves vendidas"
          value={reading.keysSold != null ? reading.keysSold.toLocaleString('es') : '—'}
          hint={reading.keyCap}
        />
        <Fact label="Red" value={reading.network ?? '—'} />
      </dl>

      {/* El aviso que da sentido a toda la verificación: el Lock funciona,
          pero cobra a otra wallet. No se bloquea —se puede desplegar desde
          una wallet personal a propósito— pero callarlo sería peor. */}
      {foreign ? (
        <div className="flex gap-3 rounded-lg border border-[var(--color-warning-500)]/35 bg-[var(--color-warning-500)]/[0.07] p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning-500)]" />
          <div className="space-y-1.5 text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
            <p className="font-medium text-[var(--color-fg)]">Este Lock no es de tu institución</p>
            <p>
              Su dueño es{' '}
              <span className="font-mono text-[var(--color-fg)]">{short(reading.owner)}</span> y tu
              wallet es{' '}
              <span className="font-mono text-[var(--color-fg)]">
                {short(reading.institutionWallet)}
              </span>
              . Los pagos de las membresías irán a esa otra wallet, no a la tuya.
            </p>
            <p>
              Si desplegaste el Lock desde una wallet personal, está bien. Si no reconocés esa
              dirección, no la guardes.
            </p>
          </div>
        </div>
      ) : (
        /* Se dice "la wallet que lo creó" y no "tu wallet": Tessera no puede
           saber cuál es la tuya. La que guarda del workspace es una wallet
           custodiada que generamos nosotros, no la de MetaMask con la que se
           despliega un Lock. */
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-[var(--color-fg-subtle)]">
          <Wallet className="h-3 w-3 shrink-0" />
          Los pagos van a la wallet que creó este Lock:{' '}
          <span className="font-mono text-[var(--color-fg-muted)]">{short(reading.owner)}</span>
        </p>
      )}
    </motion.div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium text-[var(--color-fg)]">{value}</dd>
      {hint ? <p className="text-[10.5px] text-[var(--color-fg-subtle)]">{hint}</p> : null}
    </div>
  );
}

/**
 * Qué hacer si todavía no hay Lock.
 *
 * Antes había un botón suelto a app.unlock-protocol.com y nada más: la
 * institución llegaba allí sin saber qué buscar ni qué traer de vuelta.
 */
function CreateLockGuide() {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-[var(--color-border)] bg-black/20 p-4">
      <p className="text-[13px] font-medium text-[var(--color-fg)]">¿Todavía no tenés un Lock?</p>
      <ol className="space-y-2 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
        {[
          'Entrá al panel de Unlock con la wallet de tu institución. La que uses para crearlo será la que cobre.',
          'Creá el Lock eligiendo la misma red que seleccionaste arriba, su precio y cuánto dura la membresía.',
          'Cuando termine el despliegue, copiá la dirección del contrato y pegala acá.',
          'Pulsá «Comprobar en la red» para confirmar que es el correcto antes de guardarlo.',
        ].map((step, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[var(--color-brand-500)]/40 font-mono text-[9px] text-[var(--color-brand-200)]">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <Button asChild variant="outline" size="sm">
        <a href="https://app.unlock-protocol.com/locks/create" target="_blank" rel="noreferrer">
          Crear mi Lock en Unlock <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  );
}

function short(value: string | null): string {
  if (!value) return '—';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
