'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  Play,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { publicEnv } from '@/lib/env';
import type {
  AttemptRow,
  LearnAssessment,
  LearnCoursePayload,
  LearnModule,
  LearnModuleGate,
  LearnQuestionPublic,
  TopicRow,
} from '@/lib/api/endpoints/me';
import {
  startAttemptAction,
  submitAttemptAction,
  updateLearnModuleProgressAction,
} from '../../actions';

const TYPE_LABEL = {
  multiple_choice: 'Selección múltiple',
  true_false: 'Verdadero / Falso',
  essay: 'Ensayo',
} as const;

interface Props {
  payload: LearnCoursePayload;
}

export function LearnCourseView({ payload }: Props) {
  const { course, enrollment, modules } = payload;
  const completedModules = modules.filter((m) => m.progress?.status === 'completed').length;
  const totalRequired = modules.filter((m) => m.isRequired).length;
  const finalScore = enrollment.finalScore ?? null;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.88),rgba(10,13,26,0.96))] p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-xs uppercase tracking-wide text-[var(--color-fg-subtle)]">
            Curso en progreso
          </p>
          {/* Si entró con membresía, el estudiante ve con qué llave abrió el
              curso. Una llave vencida no le quita el acceso ya concedido, así
              que esto informa; nunca restringe. */}
          {enrollment.membership ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brand-500)]/35 bg-[var(--color-brand-500)]/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-brand-200)]">
              <KeyRound className="h-3 w-3" />
              Membresía Unlock
            </span>
          ) : null}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-fg)]">{course.title}</h1>
        {course.description ? (
          <p className="mt-2 max-w-[70ch] text-sm text-[var(--color-fg-muted)]">
            {course.description}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat
            icon={BookOpen}
            label="Módulos"
            value={`${completedModules} / ${modules.length}`}
            hint={`${totalRequired} obligatorios`}
          />
          <Stat
            icon={Trophy}
            label="Score final"
            value={finalScore != null ? `${Math.round(finalScore)}%` : '—'}
            hint={`Aprueba con ${course.passingScore}%`}
          />
          <Stat
            icon={ClipboardCheck}
            label="Estado"
            value={
              enrollment.completedAt
                ? 'Completado'
                : enrollment.status === 'in_progress'
                  ? 'En progreso'
                  : 'Por comenzar'
            }
            hint={enrollment.startedAt ? `Iniciado` : 'Aún sin actividad'}
          />
        </div>

        <MembershipBar membership={enrollment.membership} gate={course.gate ?? null} />
      </header>

      <div className="space-y-3">
        {modules.map((module, idx) => (
          <ModuleCard
            key={module.id}
            module={module}
            index={idx}
            enrollmentId={enrollment.id}
            wallet={enrollment.membership?.wallet ?? null}
          />
        ))}
      </div>
    </div>
  );
}

/** Exploradores por red, para poder abrir el Lock y comprobarlo on-chain. */
const LOCK_EXPLORERS: Record<number, string> = {
  11155111: 'https://sepolia.etherscan.io',
  84532: 'https://sepolia.basescan.org',
  43113: 'https://testnet.snowtrace.io',
};

/**
 * Detalle de la membresía que abrió el curso.
 *
 * Cierra el círculo del lado del estudiante: puede comprobar por sí mismo, en
 * el explorador, la llave que le dio acceso. Se muestra vencida cuando
 * corresponde, pero sin alarmar: el acceso ya concedido no se retira.
 */
/**
 * Estado de la membresía del curso, en una sola barra.
 *
 * El recorrido que pide el bounty —descubrir, previsualizar, verificar,
 * desbloquear— sólo se entiende si el estudiante ve en qué punto está. Antes
 * esto era una nota que aparecía únicamente tras entrar con una llave; ahora
 * cubre los cuatro estados, y en los que hace falta ofrece el camino de compra.
 *
 * No restringe nada: la autorización se decide en el servidor. Esto informa.
 */
function MembershipBar({
  membership,
  gate,
}: {
  membership: LearnCoursePayload['enrollment']['membership'];
  gate: LearnModuleGate | null;
}) {
  // Un curso sin Lock no tiene membresía de la que hablar.
  if (!membership && !gate) return null;

  const expiresAt = membership?.keyExpiresAt ? new Date(membership.keyExpiresAt) : null;
  const expired = expiresAt ? expiresAt.getTime() < Date.now() : false;
  const daysLeft =
    expiresAt && !expired
      ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
      : null;

  const chainId = membership?.chainId ?? gate?.chainId ?? null;
  const lockAddress = membership?.lockAddress ?? gate?.lockAddress ?? null;
  const explorer = chainId ? LOCK_EXPLORERS[chainId] : undefined;
  const lockUrl = explorer && lockAddress ? `${explorer}/address/${lockAddress}` : null;
  const membershipDuration = formatMembershipDuration(gate?.durationSeconds);

  // Tres estados, y cada uno dice algo distinto: activa tranquiliza, vencida
  // avisa sin alarmar --el acceso ya concedido no se pierde-- y sin membresía
  // invita a conseguirla.
  const state: 'active' | 'expired' | 'none' = membership
    ? expired
      ? 'expired'
      : 'active'
    : 'none';

  const tone =
    state === 'active'
      ? 'border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/[0.06]'
      : state === 'expired'
        ? 'border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/[0.06]'
        : 'border-[var(--color-brand-500)]/30 bg-[var(--color-brand-500)]/[0.06]';

  return (
    <div className={cn('mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3', tone)}>
      {state === 'active' ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-accent-400)]" />
      ) : state === 'expired' ? (
        <Clock className="h-4 w-4 shrink-0 text-[var(--color-warning-400)]" />
      ) : (
        <KeyRound className="h-4 w-4 shrink-0 text-[var(--color-brand-300)]" />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-[var(--color-fg)]">
          {state === 'active'
            ? 'Membresía activa'
            : state === 'expired'
              ? 'Tu membresía venció'
              : 'Este curso se abre con una membresía'}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--color-fg-muted)]">
          {state === 'active' ? (
            <>
              {daysLeft != null
                ? `Vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}.`
                : 'Sin fecha de caducidad.'}
              {membership?.wallet ? (
                <>
                  {' '}
                  Llave de{' '}
                  <span className="font-mono text-[var(--color-fg)]">
                    {membership.wallet.slice(0, 6)}…{membership.wallet.slice(-4)}
                  </span>
                  .
                </>
              ) : null}
            </>
          ) : state === 'expired' ? (
            <>
              {/* Importa decirlo: quien ya entró no pierde el curso al vencer
                  la llave, y sin esta frase la barra parece una amenaza. */}
              Conservas el acceso a este curso. Renueva si quieres volver a usar
              la membresía en otros contenidos.
            </>
          ) : (
            <>
              {gate?.price ? (
                <>
                  {gate.price}
                  {membershipDuration ? ` · ${membershipDuration}` : ''} en {gate.network}.
                </>
              ) : (
                <>Necesitas una llave de Unlock{gate ? ` en ${gate.network}` : ''}.</>
              )}
            </>
          )}
        </p>
      </div>

      {/* El camino de compra se ofrece cuando falta o venció, nunca cuando ya
          está activa: ahí sólo sería ruido. */}
      {gate && state !== 'active' ? (
        <a
          href={gate.checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/10 px-3 py-1.5 text-[12px] font-medium text-[var(--color-brand-200)] transition hover:bg-[var(--color-brand-500)]/20"
        >
          <KeyRound className="h-3 w-3" />
          {state === 'expired' ? 'Renovar' : 'Obtener membresía'}
        </a>
      ) : null}

      {lockUrl ? (
        <a
          href={lockUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          Ver el Lock <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

/** Duración legible del material: "12:40", "1:05:30". */
function formatDuration(totalSeconds: number | null | undefined): string | null {
  if (typeof totalSeconds !== 'number' || !Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return null;
  }
  const seconds = Math.round(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

/** Duración de la membresía en palabras: "30 días", "1 año", "Sin caducidad". */
function formatMembershipDuration(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  // Unlock usa 0 para las llaves que no expiran.
  if (seconds === 0) return 'Sin caducidad';
  const days = Math.round(seconds / 86_400);
  if (days >= 365) {
    const years = Math.round(days / 365);
    return years === 1 ? '1 año' : `${years} años`;
  }
  if (days >= 1) return days === 1 ? '1 día' : `${days} días`;
  const hours = Math.max(1, Math.round(seconds / 3600));
  return hours === 1 ? '1 hora' : `${hours} horas`;
}

const MATERIAL_LABEL: Record<string, string> = {
  video: 'Vídeo',
  audio: 'Audio',
  document: 'Documento',
};

/**
 * Portada del temario, con el muro de pago encima cuando hace falta.
 *
 * Es el momento en que alguien decide comprar, así que el camino de compra va
 * justo aquí y no en un mensaje de error: el precio, la duración de la
 * membresía y la red salen del Lock, leídos on-chain.
 *
 * La imagen la sirve el API por su ruta protegida, que decide si entrega la
 * nítida o la difuminada. El navegador nunca recibe la nítida sin permiso, así
 * que el candado que se ve encima es señalización, no la barrera: la barrera
 * está en el servidor.
 */
function TopicCover({
  topic,
  gate,
  wallet,
}: {
  topic: TopicRow;
  /** Sólo cuando falta pagarlo: si ya hay acceso, llega null y no hay muro. */
  gate: LearnModuleGate | null;
  /** Wallet de la matrícula: deja que el servidor entregue la portada nítida. */
  wallet?: string | null;
}) {
  const api = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  // El permiso viaja en la URL porque una etiqueta <img> no puede mandar
  // cabeceras: el navegador pide la imagen por su cuenta, sin pasar por el
  // cliente de API. No autoriza por sí solo —el servidor vuelve a decidir si
  // entrega la nítida o la difuminada— pero sin él la petición es anónima y
  // la portada no llegaba nunca.
  // La wallet viaja junto al permiso: es con la que el servidor comprueba la
  // llave del módulo para decidir si entrega la portada nítida o la
  // difuminada. Sin ella la petición es anónima para ese Lock y la nítida no
  // se entrega nunca, aunque la membresía esté pagada.
  const params = new URLSearchParams();
  if (topic.coverToken) params.set('t', topic.coverToken);
  if (wallet) params.set('wallet', wallet);
  const query = params.toString();
  const src = `${api}/v1/me/learn/topics/${topic.id}/cover${query ? `?${query}` : ''}`;

  // El archivo completo lleva su propio permiso, distinto del de la portada:
  // el de la miniatura viaja en cada <img> y no debe abrir el vídeo.
  const materialParams = new URLSearchParams();
  if (topic.materialToken) materialParams.set('t', topic.materialToken);
  if (wallet) materialParams.set('wallet', wallet);
  const materialQuery = materialParams.toString();
  const materialUrl =
    topic.hasMaterial && topic.materialToken
      ? `${api}/v1/me/learn/topics/${topic.id}/material${materialQuery ? `?${materialQuery}` : ''}`
      : null;
  const duration = formatDuration(topic.assetDurationSeconds);
  const kind = topic.contentType ? MATERIAL_LABEL[topic.contentType] : null;
  const membership = formatMembershipDuration(gate?.durationSeconds);

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-[rgba(8,11,22,0.9)]">
      {/* Se usa <img> y no next/image a propósito: la portada viene de una
          ruta autenticada del API, que el optimizador de Next no puede
          atravesar. */}
      <img
        src={src}
        alt={`Portada de ${topic.title}`}
        className="h-full w-full object-cover"
        loading="lazy"
      />

      {/* Sobre la portada: de qué es el material y cuánto dura. Saberlo es
          parte de lo que decide la compra y no revela el contenido. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 bg-gradient-to-b from-black/70 to-transparent p-3">
        {kind ? (
          <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/90 backdrop-blur-sm">
            {kind}
          </span>
        ) : null}
        {duration ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[10px] text-white/90 backdrop-blur-sm">
            <Clock className="h-2.5 w-2.5" /> {duration}
          </span>
        ) : null}
      </div>

      {/* Con acceso, la portada deja de ser un muro y pasa a ser la puerta:
          el material se abre desde aquí, que es donde el estudiante lo está
          mirando. Antes no había ningún camino para abrirlo. */}
      {!gate && materialUrl ? (
        <a
          href={materialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-gradient-to-t from-black/70 via-black/25 to-transparent opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full border border-white/30 bg-white/15 backdrop-blur-sm">
            <Play className="h-5 w-5 translate-x-px text-white" />
          </span>
          <span className="rounded-lg bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#0B1120] shadow-lg">
            Abrir {kind ? kind.toLowerCase() : 'material'}
          </span>
        </a>
      ) : null}

      {gate ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/85 via-black/55 to-black/30 p-4 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm">
            <Lock className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-white">Material con membresía</p>
            <p className="mt-0.5 text-[11px] text-white/70">
              {gate.price ? (
                <>
                  {gate.price}
                  {membership ? ` · ${membership}` : ''}
                </>
              ) : (
                'Desbloquea con tu llave de Unlock'
              )}
            </p>
          </div>
          <a
            href={gate.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#0B1120] shadow-lg transition hover:bg-white/90"
          >
            <KeyRound className="h-3.5 w-3.5" /> Desbloquear
          </a>
          <p className="text-[10px] text-white/55">{gate.network}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Aviso para el material que no tiene portada.
 *
 * Sin imagen no hay dónde poner el muro, pero dejarlo invisible sería peor: al
 * menos se dice que el material existe, de qué tipo es y cómo desbloquearlo.
 */
function TopicMaterialNote({
  topic,
  gate,
  wallet,
}: {
  topic: TopicRow;
  gate: LearnModuleGate | null;
  wallet?: string | null;
}) {
  const duration = formatDuration(topic.assetDurationSeconds);
  const kind = topic.contentType ? MATERIAL_LABEL[topic.contentType] : 'Material';
  const membership = formatMembershipDuration(gate?.durationSeconds);
  const api = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '');

  // Sin portada tampoco había forma de abrir el archivo: quedaba anunciado y
  // fuera de alcance. Con acceso, aquí está su único camino.
  const params = new URLSearchParams();
  if (topic.materialToken) params.set('t', topic.materialToken);
  if (wallet) params.set('wallet', wallet);
  const query = params.toString();
  const materialUrl =
    topic.materialToken && !gate
      ? `${api}/v1/me/learn/topics/${topic.id}/material${query ? `?${query}` : ''}`
      : null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--color-fg-muted)]">
        {gate ? (
          <Lock className="h-3.5 w-3.5 text-[var(--color-warning-400)]" />
        ) : (
          <BookOpen className="h-3.5 w-3.5" />
        )}
        {kind}
        {duration ? <span className="font-mono text-[var(--color-fg-subtle)]">· {duration}</span> : null}
      </span>

      {gate ? (
        <a
          href={gate.checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/10 px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--color-brand-200)] transition hover:bg-[var(--color-brand-500)]/20"
        >
          <KeyRound className="h-3 w-3" />
          {gate.price ? `Desbloquear · ${gate.price}` : 'Desbloquear'}
          {membership ? <span className="text-[var(--color-fg-subtle)]">· {membership}</span> : null}
        </a>
      ) : materialUrl ? (
        <a
          href={materialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--color-fg)] transition hover:bg-white/[0.08]"
        >
          <Play className="h-3 w-3" /> Abrir
        </a>
      ) : null}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.55)] p-3">
      <div className="flex items-center gap-2 text-[var(--color-fg-subtle)]">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 font-mono text-lg tabular-nums text-[var(--color-fg)]">{value}</p>
      {hint ? <p className="text-[11px] text-[var(--color-fg-subtle)]">{hint}</p> : null}
    </div>
  );
}

function ModuleCard({
  module,
  index,
  enrollmentId,
  wallet,
}: {
  /** Wallet de la matrícula: con ella el servidor comprueba la llave del módulo. */
  wallet?: string | null;
  module: LearnModule;
  index: number;
  enrollmentId: string;
}) {
  const [open, setOpen] = useState(index === 0);
  const [progressPending, startProgress] = useTransition();
  const router = useRouter();
  const status = module.progress?.status ?? 'not_started';
  const score = module.progress?.score;

  const updateProgress = (nextStatus: 'in_progress' | 'completed') => {
    startProgress(async () => {
      const res = await updateLearnModuleProgressAction(enrollmentId, module.id, nextStatus);
      if (res.ok) {
        router.refresh();
      } else {
        alert(res.error);
      }
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.55)]">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open && status === 'not_started') updateProgress('in_progress');
        }}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-brand-500)]/10 font-mono text-xs text-[var(--color-brand-200)]">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-[var(--color-fg)]">
              {module.title}
            </h3>
            {module.isRequired ? (
              <Badge variant="warning">Obligatorio</Badge>
            ) : (
              <Badge>Opcional</Badge>
            )}
            <Badge>Peso {module.weight}</Badge>
            {status === 'completed' ? <Badge variant="success">Completado</Badge> : null}
            {status === 'in_progress' ? <Badge variant="brand">En curso</Badge> : null}
          </div>
          {module.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-[var(--color-fg-muted)]">
              {module.description}
            </p>
          ) : null}
          {score != null ? (
            <p className="mt-1 font-mono text-[11px] tabular-nums text-[var(--color-fg-subtle)]">
              Score del módulo: {Math.round(score)}%
            </p>
          ) : null}
        </div>
        {open ? (
          <ChevronDown className="h-5 w-5 text-[var(--color-fg-subtle)]" />
        ) : (
          <ChevronRight className="h-5 w-5 text-[var(--color-fg-subtle)]" />
        )}
      </button>

      {open ? (
        <div className="space-y-5 border-t border-[var(--color-border)] bg-[rgba(8,11,22,0.55)] px-5 py-5">
          {module.topics.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                Temarios
              </p>
              {module.topics.map((topic, i) => {
                const text = (topic.content as { text?: string } | null)?.text;
                return (
                  <article
                    key={topic.id}
                    className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.55)]"
                  >
                    {/* La portada va primero: es lo que decide si alguien
                        quiere desbloquear el material. */}
                    {topic.hasCover ? (
                      <TopicCover
                        topic={topic}
                        /* El muro se pinta sólo si falta pagarlo. Antes bastaba
                           con que el módulo tuviera Lock, así que el candado
                           seguía puesto después de comprar la membresía. */
                        gate={module.hasAccess === false ? (module.gate ?? null) : null}
                        wallet={wallet}
                      />
                    ) : null}

                    <div className="p-4">
                      <p className="text-xs font-mono text-[var(--color-fg-subtle)]">T{i + 1}</p>
                      <h4 className="mt-1 text-sm font-semibold text-[var(--color-fg)]">
                        {topic.title}
                      </h4>
                      {topic.description ? (
                        <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                          {topic.description}
                        </p>
                      ) : null}
                      {text ? (
                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--color-fg)]">
                          {text}
                        </p>
                      ) : null}
                      {/* Material sin portada: al menos se dice que existe y
                          como abrirlo, en vez de dejarlo invisible. */}
                      {topic.hasMaterial && !topic.hasCover ? (
                        <TopicMaterialNote
                          topic={topic}
                          gate={module.hasAccess === false ? (module.gate ?? null) : null}
                          wallet={wallet}
                        />
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {module.assessments.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                Evaluaciones
              </p>
              {module.assessments.map((a) => (
                <AssessmentCard
                  key={a.id}
                  assessment={a}
                  enrollmentId={enrollmentId}
                  topicTitle={module.topics.find((t) => t.id === a.topicId)?.title ?? null}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--color-fg-subtle)]">
                Este módulo no tiene evaluaciones. Puedes marcarlo como leído cuando termines los
                temarios.
              </p>
              {status === 'completed' ? (
                <Badge variant="success">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Leído
                </Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  loading={progressPending}
                  onClick={() => updateProgress('completed')}
                >
                  Marcar como leído
                </Button>
              )}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function AssessmentCard({
  assessment,
  enrollmentId,
  topicTitle,
}: {
  assessment: LearnAssessment;
  enrollmentId: string;
  topicTitle: string | null;
}) {
  const [pending, start] = useTransition();
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(
    assessment.attempts.find((a) => a.status === 'in_progress')?.id ?? null,
  );
  const router = useRouter();
  const bestGraded = assessment.attempts
    .filter((a) => a.status === 'graded' && a.score != null)
    .reduce<AttemptRow | null>(
      (best, cur) => (best == null || (cur.score ?? 0) > (best.score ?? 0) ? cur : best),
      null,
    );
  const passed = bestGraded?.score != null && bestGraded.score >= assessment.passingScore;
  const remaining = Math.max(0, assessment.attemptsAllowed - assessment.attempts.length);

  const handleStart = () => {
    start(async () => {
      const res = await startAttemptAction(enrollmentId, assessment.id);
      if (res.ok && res.data) {
        setActiveAttemptId(res.data.attemptId);
        router.refresh();
      } else if (!res.ok) {
        alert(res.error);
      }
    });
  };

  return (
    <article className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.55)]">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="text-sm font-semibold text-[var(--color-fg)]">{assessment.title}</h5>
            <Badge variant="brand">{TYPE_LABEL[assessment.type]}</Badge>
            <Badge>Peso {assessment.weight}</Badge>
            <Badge>Aprueba {assessment.passingScore}%</Badge>
            {topicTitle ? (
              <span className="text-[11px] text-[var(--color-fg-subtle)]">· {topicTitle}</span>
            ) : null}
          </div>
          {assessment.description ? (
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{assessment.description}</p>
          ) : null}
          <p className="mt-1 font-mono text-[11px] tabular-nums text-[var(--color-fg-subtle)]">
            Intentos {assessment.attempts.length} / {assessment.attemptsAllowed}
            {bestGraded ? ` · Mejor: ${Math.round(bestGraded.score ?? 0)}%` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {bestGraded?.score != null ? (
            passed ? (
              <Badge variant="success">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Aprobado
              </Badge>
            ) : (
              <Badge variant="warning">No aprobado</Badge>
            )
          ) : null}
          {activeAttemptId ? null : remaining > 0 ? (
            <Button size="sm" type="button" loading={pending} onClick={handleStart}>
              {assessment.attempts.length === 0 ? 'Iniciar' : 'Reintentar'}
            </Button>
          ) : (
            <Badge>Sin intentos disponibles</Badge>
          )}
        </div>
      </div>

      {activeAttemptId ? (
        <AttemptForm
          attemptId={activeAttemptId}
          enrollmentId={enrollmentId}
          questions={assessment.questions}
          type={assessment.type}
          onClose={() => setActiveAttemptId(null)}
        />
      ) : null}

      {assessment.attempts.length > 0 ? (
        <div className="border-t border-[var(--color-border)] bg-[rgba(8,11,22,0.4)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
            Historial
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[var(--color-fg-muted)]">
            {assessment.attempts.map((att) => (
              <li key={att.id} className="flex items-center justify-between">
                <span>
                  Intento #{att.attemptNumber} · {att.status}
                </span>
                <span className="font-mono tabular-nums">
                  {att.score != null ? `${Math.round(att.score)}%` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function AttemptForm({
  attemptId,
  enrollmentId,
  questions,
  type,
  onClose,
}: {
  attemptId: string;
  enrollmentId: string;
  questions: LearnQuestionPublic[];
  type: LearnAssessment['type'];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [essay, setEssay] = useState('');
  const [result, setResult] = useState<{ status: string; score: number | null } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = type === 'essay' ? { essay } : answers;
    start(async () => {
      const res = await submitAttemptAction(
        enrollmentId,
        attemptId,
        payload as Record<string, unknown>,
      );
      if (res.ok && res.data) {
        setResult(res.data);
        router.refresh();
      } else if (!res.ok) {
        alert(res.error);
      }
    });
  };

  if (result) {
    return (
      <div className="border-t border-[var(--color-border)] bg-emerald-500/5 px-4 py-4 text-sm text-[var(--color-fg)]">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          <p>
            {result.status === 'graded'
              ? `Calificado: ${Math.round(result.score ?? 0)}%`
              : 'Respuesta enviada. Está pendiente de calificación manual.'}
          </p>
        </div>
        <Button size="sm" variant="ghost" type="button" className="mt-3" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 border-t border-[var(--color-border)] bg-[rgba(8,11,22,0.55)] px-4 py-4"
    >
      {type === 'essay' ? (
        <textarea
          value={essay}
          onChange={(e) => setEssay(e.target.value)}
          rows={8}
          required
          minLength={10}
          placeholder="Escribe tu respuesta…"
          className="w-full rounded-xl border border-[var(--color-border)] bg-white/[0.03] px-4 py-3 text-sm text-[var(--color-fg)] focus:border-[var(--color-brand-400)] focus:outline-none"
        />
      ) : (
        <ol className="space-y-4">
          {questions.map((q, idx) => (
            <li
              key={q.id}
              className="rounded-lg border border-[var(--color-border)] bg-[rgba(14,18,36,0.55)] p-3"
            >
              <p className="text-xs font-mono text-[var(--color-fg-subtle)]">
                P{idx + 1} · {q.points} pts
              </p>
              <p className="mt-1 text-sm text-[var(--color-fg)]">{q.prompt}</p>
              {q.kind === 'single' && q.options ? (
                <ul className="mt-3 space-y-1">
                  {q.options.map((opt) => (
                    <li key={opt.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                          answers[q.id] === opt.id
                            ? 'border-[var(--color-brand-500)]/60 bg-[var(--color-brand-500)]/10 text-[var(--color-fg)]'
                            : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]',
                        )}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt.id}
                          checked={answers[q.id] === opt.id}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                          className="sr-only"
                        />
                        {answers[q.id] === opt.id ? (
                          <CheckCircle2 className="h-4 w-4 text-[var(--color-brand-300)]" />
                        ) : (
                          <Circle className="h-4 w-4 text-[var(--color-fg-subtle)]" />
                        )}
                        {opt.label}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : null}
              {q.kind === 'boolean' ? (
                <div className="mt-3 flex gap-2">
                  {[
                    { v: true, label: 'Verdadero' },
                    { v: false, label: 'Falso' },
                  ].map((opt) => (
                    <button
                      key={String(opt.v)}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.v }))}
                      className={cn(
                        'rounded-lg border px-4 py-2 text-sm',
                        answers[q.id] === opt.v
                          ? 'border-[var(--color-brand-500)]/60 bg-[var(--color-brand-500)]/10 text-[var(--color-fg)]'
                          : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {q.kind === 'text' ? (
                <textarea
                  rows={3}
                  value={String(answers[q.id] ?? '')}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  className="mt-3 w-full rounded-lg border border-[var(--color-border)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-[var(--color-brand-400)] focus:outline-none"
                />
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-[var(--color-fg-subtle)] inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> Una vez enviado no podrás editarlo.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enviar respuestas
          </Button>
        </div>
      </div>
    </form>
  );
}
