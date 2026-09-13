'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildCourseOwnershipMessage,
  checkCourseMembership,
  fetchPreviewModule,
  formatDuration,
  formatPrice,
  readableContent,
  type PreviewModule,
} from '@/lib/portal/courses';
import { chainName, useWallet } from '@/lib/portal/use-wallet';
import { cn } from '@/lib/utils';
import { useT, type Dictionary } from '@tessera/i18n';

interface Membership {
  lockAddress: string;
  chainId: number;
  network: string;
  checkoutUrl: string;
  previewModuleCount: number;
  lockInfo: {
    name: string | null;
    keyPriceWei: string | null;
    expirationDuration: number | null;
  } | null;
}

interface ModuleRow {
  id: string;
  title: string;
  description: string | null;
  previewable: boolean;
}

interface Props {
  courseId: string;
  courseSlug: string;
  membership: Membership;
  modules: ModuleRow[];
  /** Sesión iniciada como estudiante: sin esto no se puede matricular. */
  signedIn: boolean;
  loginHref: string;
  /** Matrícula existente. Si la hay, el curso ya está abierto para esta persona. */
  enrollmentId?: string | null;
  /** Server action que matricula tras verificar la firma en el backend. */
  enrollAction: (input: { wallet: string; signature: string; issuedAt: number }) => Promise<
    { ok: true; enrollmentId: string } | { ok: false; message: string }
  >;
}

type Stage = 'idle' | 'checking' | 'denied' | 'signing' | 'enrolling';

const MEMBERSHIP_CHECK_ATTEMPTS = 5;
const MEMBERSHIP_CHECK_DELAY_MS = 1800;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Recorrido del bounty aplicado a un curso:
 * descubrir -> previsualizar -> verificar membresia -> desbloquear.
 *
 * Lo que decide es el servidor. Esta pantalla nunca "abre" nada por su
 * cuenta: pide la muestra (que el backend sirve solo para los modulos
 * marcados) y pide la matricula (que el backend concede solo tras leer el
 * Lock on-chain). Sin llave valida, el contenido no existe para el navegador.
 */
export function CourseUnlockGate({
  courseId,
  membership,
  modules,
  signedIn,
  loginHref,
  enrollAction,
  enrollmentId = null,
}: Props) {
  const t = useT();
  const gate = t.public.courseDetail.gate;
  const wallet = useWallet();
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState(membership.checkoutUrl);

  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewModule | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewCount = modules.filter((m) => m.previewable).length;

  const checkMembershipWithRetry = useCallback(
    async (address: string) => {
      let lastStatus: Awaited<ReturnType<typeof checkCourseMembership>> | null = null;

      for (let attempt = 1; attempt <= MEMBERSHIP_CHECK_ATTEMPTS; attempt += 1) {
        try {
          lastStatus = await checkCourseMembership(courseId, address);
          if (lastStatus.hasAccess) return lastStatus;
        } catch {
          if (attempt === MEMBERSHIP_CHECK_ATTEMPTS) return null;
        }

        if (attempt < MEMBERSHIP_CHECK_ATTEMPTS) {
          setMessage(
            attempt === 1
              ? gate.waitingOnchain
              : gate.stillVerifying,
          );
          await wait(MEMBERSHIP_CHECK_DELAY_MS);
        }
      }

      return lastStatus;
    },
    [courseId, gate.waitingOnchain, gate.stillVerifying],
  );

  /** Previsualizar: el servidor decide si este módulo es de muestra. */
  const openPreview = useCallback(
    async (moduleId: string) => {
      if (openModuleId === moduleId) {
        setOpenModuleId(null);
        return;
      }

      setOpenModuleId(moduleId);
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(true);

      const result = await fetchPreviewModule(courseId, moduleId);
      setPreviewLoading(false);

      if (result.ok) {
        setPreview(result.module);
        return;
      }
      if (result.reason === 'membership') {
        setPreviewError(gate.moduleNeedsMembership);
        if (result.checkoutUrl) setCheckoutUrl(result.checkoutUrl);
        return;
      }
      setPreviewError(result.message);
    },
    [courseId, openModuleId, gate.moduleNeedsMembership],
  );

  /** Verificar membresía y, si es válida, matricular. */
  const unlock = useCallback(async () => {
    setMessage(null);

    if (!signedIn) {
      window.location.href = loginHref;
      return;
    }

    const address = wallet.address ?? (await wallet.connect());
    if (!address) return;

    if (wallet.chainId !== membership.chainId) {
      const switched = await wallet.switchChain(membership.chainId);
      if (!switched) {
        setMessage(gate.switchChainPrompt.replace('{chain}', chainName(membership.chainId)));
        return;
      }
    }

    setStage('checking');
    const status = await checkMembershipWithRetry(address);

    if (!status) {
      setStage('idle');
      setMessage(gate.cantReachChain);
      return;
    }

    if (!status.hasAccess) {
      setCheckoutUrl(status.lock.checkoutUrl || membership.checkoutUrl);
      setStage('denied');
      return;
    }

    // Tiene llave. Ahora hay que probar que la wallet es suya: sin la firma
    // el backend rechaza la matrícula, porque consultar el Lock sólo dice que
    // ESA wallet tiene membresía, no que quien pide sea su dueño.
    setStage('signing');
    const issuedAt = Date.now();
    const signature = await wallet.signMessage(
      buildCourseOwnershipMessage({ walletAddress: address, courseId, issuedAt }),
      address,
    );

    if (!signature) {
      setStage('denied');
      setMessage(gate.needSignature);
      return;
    }

    setStage('enrolling');
    const result = await enrollAction({ wallet: address, signature, issuedAt });

    if (result.ok) {
      // La matrícula ya existe: el recorrido del curso vive en el área del
      // estudiante, así que lo llevamos ahí.
      window.location.href = `/student/courses/${result.enrollmentId}`;
      return;
    }

    setStage('denied');
    setMessage(result.message);
  }, [
    checkMembershipWithRetry,
    courseId,
    enrollAction,
    loginHref,
    membership.chainId,
    membership.checkoutUrl,
    signedIn,
    wallet,
    gate.switchChainPrompt,
    gate.cantReachChain,
    gate.needSignature,
  ]);

  const busy = stage === 'checking' || stage === 'signing' || stage === 'enrolling';
  const wrongChain = wallet.address !== null && wallet.chainId !== membership.chainId;

  return (
    <div className="space-y-5">
      {/* ── Temario con muestra ─────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--color-border)] px-4 py-3.5 sm:px-5">
          <Eye className="h-4 w-4 text-[var(--color-fg-muted)]" />
          <span className="text-sm font-medium text-[var(--color-fg)]">{t.public.courseDetail.coursePlan}</span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {enrollmentId
              ? gate.fullAccess
              : previewCount > 0
                ? gate.openOfTotal.replace('{open}', String(previewCount)).replace('{total}', String(modules.length))
                : gate.sampleClosed}
          </span>
        </div>

        <ol className="divide-y divide-[var(--color-border)]">
          {modules.map((m, i) => {
            const open = openModuleId === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => m.previewable && void openPreview(m.id)}
                  disabled={!m.previewable}
                  aria-expanded={m.previewable ? open : undefined}
                  className={cn(
                    // El padding se reduce en móvil: con 360px de ancho, el
                    // número, el título y el distintivo no entran cómodos con
                    // el espaciado de escritorio.
                    'flex w-full items-start gap-3 px-4 py-4 text-left transition-colors sm:gap-4 sm:px-5',
                    m.previewable
                      ? 'hover:bg-white/[0.03]'
                      : 'cursor-default opacity-70',
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] bg-white/[0.03] font-mono text-[13px] text-[var(--color-fg-muted)] sm:h-9 sm:w-9 sm:text-sm">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[var(--color-fg)]">
                      {m.title}
                    </span>
                    {m.description ? (
                      <span className="mt-1 block text-xs leading-5 text-[var(--color-fg-muted)]">
                        {m.description}
                      </span>
                    ) : null}
                  </span>
                  {m.previewable ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-accent-500)]/30 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-accent-400)]">
                      <LockOpen className="h-3 w-3" /> {gate.badges.sample}
                    </span>
                  ) : enrollmentId ? (
                    /* Para quien ya se matriculó, estos módulos no están
                       cerrados: se leen dentro del curso. */
                    <LockOpen
                      className="h-4 w-4 shrink-0 text-[var(--color-accent-400)]"
                      aria-label={gate.badges.availableInCourse}
                    />
                  ) : (
                    <Lock className="h-4 w-4 shrink-0 text-[var(--color-fg-subtle)]" />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: reduced ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-[var(--color-border)] bg-black/20 px-4 py-4 sm:px-5">
                        {previewLoading ? (
                          <p className="flex items-center gap-2 text-[13px] text-[var(--color-fg-muted)]">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {gate.loadingSample}
                          </p>
                        ) : previewError ? (
                          <p className="text-[13px] text-[var(--color-warning-500)]">
                            {previewError}
                          </p>
                        ) : preview ? (
                          <PreviewBody module={preview} noContent={gate.noContent} />
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── Desbloquear ─────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-500)]/[0.05]">
        {/* Envuelve en móvil: el título y el distintivo no caben juntos a 360px. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-[var(--color-brand-500)]/20 px-4 py-3.5 sm:px-5">
          <KeyRound className="h-4 w-4 shrink-0 text-[var(--color-brand-300)]" />
          <span className="text-sm font-semibold text-[var(--color-fg)]">
            {gate.membershipAccess}
          </span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-[var(--color-brand-300)]">
            unlock protocol
          </span>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <AnimatePresence mode="wait">
            {enrollmentId ? (
              /* Ya se matriculó: pedirle de nuevo la membresía sería un callejón
                 sin salida, porque el curso ya está abierto para esta persona. */
              <motion.div
                key="enrolled"
                initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-start gap-3">
                  <LockOpen className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent-400)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-fg)]">
                      gate.alreadyEnrolledTitle
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
                      gate.alreadyEnrolledBody
                    </p>
                  </div>
                </div>
                <Button asChild className="w-full sm:w-auto">
                  <a href={`/student/courses/${enrollmentId}`}>
                    {gate.continueCourse} <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </motion.div>
            ) : stage === 'denied' ? (
              <motion.div
                key="denied"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning-500)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-fg)]">
                      gate.deniedTitle
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
                      {message ??
                        gate.deniedDefault}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <Button asChild>
                    <a href={checkoutUrl} target="_blank" rel="noreferrer">
                      {gate.getMembership} <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button variant="outline" onClick={unlock} disabled={busy}>
                    <RefreshCw className="h-4 w-4" /> {gate.alreadyBought}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="cta"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <Steps stage={stage} labels={gate.steps} />

                {message ? (
                  <p className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--color-warning-500)]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {message}
                  </p>
                ) : null}

                {!signedIn ? (
                  <Button asChild className="w-full sm:w-auto">
                    <a href={loginHref}>
                      {gate.signInToContinue} <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                ) : wallet.available ? (
                  <Button onClick={unlock} disabled={busy} className="w-full sm:w-auto">
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {stage === 'checking'
                          ? gate.verifyingOnchain
                          : stage === 'signing'
                            ? gate.signing
                            : gate.enrolling}
                      </>
                    ) : (
                      <>
                        <Wallet className="h-4 w-4" />
                        {wallet.address ? gate.verifyMembership : gate.connectWallet}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                ) : (
                  <p className="text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
                    gate.installWallet
                  </p>
                )}

                {wallet.error ? (
                  <p className="text-[13px] text-[var(--color-danger-500)]">{wallet.error}</p>
                ) : null}

                {wrongChain ? (
                  <p className="text-[13px] text-[var(--color-warning-500)]">
                    {gate.wrongChainPrefix} {chainName(wallet.chainId)}{gate.wrongChainMid}{' '}
                    {chainName(membership.chainId)}{gate.wrongChainEnd}
                  </p>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>

          <dl className="grid gap-x-6 gap-y-3 border-t border-[var(--color-brand-500)]/15 pt-4 sm:grid-cols-2">
            <Row label={gate.row.lock} value={`${membership.lockAddress.slice(0, 10)}…${membership.lockAddress.slice(-6)}`} mono />
            <Row label={gate.row.network} value={membership.network} />
            <Row label={gate.row.price} value={formatPrice(membership.lockInfo?.keyPriceWei ?? null)} />
            <Row
              label={gate.row.duration}
              value={formatDuration(membership.lockInfo?.expirationDuration ?? null)}
            />
          </dl>

          <p className="text-[12px] leading-relaxed text-[var(--color-fg-subtle)]">
            {gate.checkedEveryAttempt}
          </p>
        </div>
      </section>
    </div>
  );
}

function Steps({ stage, labels }: { stage: Stage; labels: Dictionary['public']['courseDetail']['gate']['steps'] }) {
  const steps = [
    { id: 'wallet', label: labels.wallet },
    { id: 'check', label: labels.check },
    { id: 'sign', label: labels.sign },
    { id: 'open', label: labels.open },
  ];
  const activeIndex =
    stage === 'checking' ? 1 : stage === 'signing' ? 2 : stage === 'enrolling' ? 3 : 0;

  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-2">
      {steps.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex && stage !== 'idle';
        return (
          <li
            key={step.id}
            className={cn(
              'inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em]',
              done && 'text-[var(--color-accent-400)]',
              active && 'text-[var(--color-brand-300)]',
              !done && !active && 'text-[var(--color-fg-subtle)]',
            )}
          >
            {done ? (
              <Check className="h-3 w-3" />
            ) : active ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="h-1 w-1 rounded-full bg-current" />
            )}
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

/** Muestra el contenido real del módulo abierto, sea del módulo o sus temarios. */
function PreviewBody({ module, noContent }: { module: PreviewModule; noContent: string }) {
  const own = readableContent(module.content);
  const topics = module.topics.filter((topic) => readableContent(topic.content));

  if (!own && topics.length === 0) {
    return (
      <p className="text-[13px] text-[var(--color-fg-muted)]">
        {noContent}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {own ? (
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--color-fg)]">
          {own}
        </p>
      ) : null}

      {topics.map((topic) => (
        <div key={topic.id}>
          <p className="text-[13px] font-semibold text-[var(--color-fg)]">{topic.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
            {readableContent(topic.content)}
          </p>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd className={cn('mt-0.5 truncate text-[13px] text-[var(--color-fg)]', mono && 'font-mono')}>
        {value}
      </dd>
    </div>
  );
}
