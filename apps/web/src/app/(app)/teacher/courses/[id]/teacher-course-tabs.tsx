'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Circle,
  ClipboardList,
  CreditCard,
  FileSignature,
  Globe2,
  GraduationCap,
  KeyRound,
  Layers3,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDate, relativeTime } from '@/lib/format';
import type {
  AssessmentQuestionRow,
  AssessmentRow,
  CourseDetail,
  CourseEnrollmentList,
  ModuleContentType,
  ModuleProgressStatus,
  TeacherGradingItem,
  TopicRow,
} from '@/lib/api/endpoints/me';
import { ModuleContentManager } from '../../../institution/courses/[id]/module-content-manager';

type CourseVisibility = CourseDetail['course']['visibility'];
type CourseStatus = CourseDetail['course']['status'];
type AssignmentRole = CourseDetail['teachers'][number]['assignmentRole'];

type TabId = 'resumen' | 'contenido' | 'estudiantes' | 'grading' | 'equipo';

export interface ModuleContentBundle {
  moduleId: string;
  topics: TopicRow[];
  assessments: AssessmentRow[];
  questions: Record<string, AssessmentQuestionRow[]>;
}

interface Props {
  detail: CourseDetail;
  enrollments: CourseEnrollmentList;
  moduleContents: ModuleContentBundle[];
  gradingQueue: TeacherGradingItem[];
  pendingGrading: number;
}

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'resumen', label: 'Resumen', icon: Sparkles },
  { id: 'contenido', label: 'Contenido', icon: Layers3 },
  { id: 'estudiantes', label: 'Estudiantes', icon: Users },
  { id: 'grading', label: 'Calificaciones', icon: FileSignature },
  { id: 'equipo', label: 'Equipo', icon: GraduationCap },
];

const COURSE_STATUS_META: Record<
  CourseStatus,
  { label: string; variant: 'success' | 'warning' | 'default' }
> = {
  published: { label: 'Publicado', variant: 'success' },
  draft: { label: 'Borrador', variant: 'warning' },
  archived: { label: 'Archivado', variant: 'default' },
};

const VISIBILITY_META: Record<
  CourseVisibility,
  { label: string; icon: LucideIcon; description: string }
> = {
  public_free: {
    label: 'Pública gratuita',
    icon: Globe2,
    description: 'Visible en el catálogo abierto.',
  },
  public_paid: {
    label: 'Pública de pago',
    icon: CreditCard,
    description: 'Aparece en el catálogo y se cobra al inscribirse.',
  },
  private_code: {
    label: 'Privada por código',
    icon: KeyRound,
    description: 'Sólo se accede canjeando el código.',
  },
  hybrid: {
    label: 'Híbrida',
    icon: Building2,
    description: 'Visible al público y privada con código para inscritos.',
  },
  token_gated: {
    label: 'Con membresía (Unlock)',
    icon: Wallet,
    description: 'La matrícula la concede una llave de Unlock verificada on-chain.',
  },
};

const CONTENT_TYPE_LABEL: Record<ModuleContentType, string> = {
  video: 'Video',
  article: 'Lectura',
  quiz: 'Quiz',
  assignment: 'Tarea',
  live: 'En vivo',
};

const STATUS_META: Record<ModuleProgressStatus, { label: string; icon: LucideIcon; tone: string }> =
  {
    not_started: {
      label: 'Sin empezar',
      icon: Circle,
      tone: 'text-[var(--color-fg-subtle)]',
    },
    in_progress: { label: 'En progreso', icon: Loader2, tone: 'text-amber-300' },
    completed: { label: 'Completado', icon: CheckCircle2, tone: 'text-emerald-300' },
  };

const ROLE_LABEL: Record<AssignmentRole, string> = {
  owner: 'Docente',
  assistant: 'Revisor',
};

const PANEL =
  'rounded-[26px] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.88),rgba(10,13,26,0.96))] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]';
const SUBPANEL = 'rounded-2xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.82)]';

function InitialsChip({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  const dim = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-9 w-9 text-[12px]';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white/[0.04] font-semibold tracking-wide text-[var(--color-brand-200)]',
        dim,
      )}
    >
      {initials}
    </span>
  );
}

function InfoChip({
  icon: Icon,
  label,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'success' | 'brand';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium',
        tone === 'success'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : tone === 'brand'
            ? 'border-[var(--color-brand-500)]/30 bg-[var(--color-brand-500)]/10 text-[var(--color-brand-200)]'
            : 'border-[var(--color-border)] bg-[rgba(14,18,36,0.7)] text-[var(--color-fg-muted)]',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function TeacherCourseTabs({
  detail,
  enrollments,
  moduleContents,
  gradingQueue,
  pendingGrading,
}: Props) {
  const [tab, setTab] = useState<TabId>('resumen');

  const stats = useMemo(() => {
    const completionRate =
      detail.metrics.enrollments > 0
        ? Math.round((detail.metrics.completed / detail.metrics.enrollments) * 100)
        : 0;
    return {
      completionRate,
      modules: detail.modules.length,
      requiredModules: enrollments.totals.requiredModules,
      enrollments: detail.metrics.enrollments,
      completed: detail.metrics.completed,
      inProgress: detail.metrics.inProgress,
      avgScore: detail.metrics.avgScore != null ? `${Math.round(detail.metrics.avgScore)}%` : '—',
      certificates: detail.metrics.certificatesIssued,
    };
  }, [detail, enrollments.totals.requiredModules]);

  const visMeta = VISIBILITY_META[detail.course.visibility];
  const VisIcon = visMeta.icon;

  return (
    <div className="space-y-5">
      {/* Header del curso */}
      <header className={cn(PANEL, 'overflow-hidden')}>
        <div className="flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="min-w-0 break-words text-[26px] font-semibold leading-[1.1] tracking-[-0.01em] text-[var(--color-fg)] sm:text-[30px] md:text-[34px]">
                  {detail.course.title}
                </h1>
                <Badge variant={COURSE_STATUS_META[detail.course.status].variant}>
                  {COURSE_STATUS_META[detail.course.status].label}
                </Badge>
              </div>
              <p className="mt-1.5 font-mono text-xs text-[var(--color-fg-subtle)]">
                /{detail.course.slug}
              </p>
            </div>
            <span
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[var(--color-border)] bg-[rgba(14,18,36,0.7)] px-3 py-1.5 text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]"
              title={visMeta.description}
            >
              <VisIcon className="h-3.5 w-3.5 text-[var(--color-brand-300)]" />
              {visMeta.label}
            </span>
          </div>

          {detail.course.description?.trim() ? (
            <p className="max-w-[68ch] text-sm leading-6 text-[var(--color-fg-muted)]">
              {detail.course.description}
            </p>
          ) : (
            <p className="max-w-[68ch] text-sm italic leading-6 text-[var(--color-fg-subtle)]">
              Sin descripción. Pídele a tu administración que la complete para mostrar el alcance
              del curso a tus estudiantes.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <InfoChip icon={Layers3} label={`${stats.modules} módulos`} />
            <InfoChip icon={Users} label={`${detail.teachers.length} docentes`} />
            <InfoChip
              icon={ShieldCheck}
              label={detail.course.autoIssueEnabled ? 'Auto-emisión' : 'Emisión manual'}
              tone={detail.course.autoIssueEnabled ? 'success' : 'default'}
            />
            <InfoChip
              icon={Sparkles}
              label={`Aprob. ${detail.course.passingScore}%`}
              tone="brand"
            />
            {detail.metrics.enrollments > 0 && (
              <InfoChip
                icon={GraduationCap}
                label={`${stats.completionRate}% completan`}
                tone={stats.completionRate >= 50 ? 'success' : 'default'}
              />
            )}
            {pendingGrading > 0 && (
              <InfoChip icon={FileSignature} label={`${pendingGrading} por calificar`} />
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px border-t border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-3 md:grid-cols-5">
          {[
            { label: 'Inscritos', value: stats.enrollments },
            { label: 'Completados', value: stats.completed, tone: 'success' as const },
            { label: 'En progreso', value: stats.inProgress, tone: 'warning' as const },
            { label: 'Score prom.', value: stats.avgScore },
            { label: 'Emitidos', value: stats.certificates, tone: 'brand' as const },
          ].map((s) => (
            <div
              key={s.label}
              className="flex min-w-0 flex-col gap-1.5 bg-[rgba(9,12,26,0.92)] px-4 py-4 sm:px-5 sm:py-5"
            >
              <dt className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
                {s.label}
              </dt>
              <dd
                className={cn(
                  'font-mono text-[26px] leading-none tabular-nums',
                  s.tone === 'success'
                    ? 'text-emerald-300'
                    : s.tone === 'warning'
                      ? 'text-amber-300'
                      : s.tone === 'brand'
                        ? 'text-[var(--color-brand-300)]'
                        : 'text-[var(--color-fg)]',
                )}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {/* Tabs */}
      <nav className={cn(PANEL, 'overflow-x-auto p-2')}>
        <div className="flex min-w-max gap-2">
          {TABS.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            const counter =
              item.id === 'estudiantes'
                ? stats.enrollments
                : item.id === 'grading'
                  ? pendingGrading
                  : item.id === 'contenido'
                    ? stats.modules
                    : item.id === 'equipo'
                      ? detail.teachers.length
                      : null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
                  active
                    ? 'border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/12 text-[var(--color-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'border border-transparent text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:bg-white/[0.04] hover:text-[var(--color-fg)]',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {counter !== null && counter > 0 && (
                  <span
                    className={cn(
                      'ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 font-mono text-[10px] tabular-nums',
                      active
                        ? 'bg-[var(--color-brand-500)]/30 text-[var(--color-brand-100)]'
                        : 'bg-white/[0.06] text-[var(--color-fg-muted)]',
                    )}
                  >
                    {counter}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Tab body */}
      {tab === 'resumen' && (
        <ResumenTab
          detail={detail}
          enrollments={enrollments}
          stats={stats}
          pendingGrading={pendingGrading}
          onJump={setTab}
        />
      )}
      {tab === 'contenido' && <ContenidoTab detail={detail} moduleContents={moduleContents} />}
      {tab === 'estudiantes' && (
        <EstudiantesTab enrollments={enrollments} totalModules={stats.modules} />
      )}
      {tab === 'grading' && (
        <GradingTab gradingQueue={gradingQueue} pendingGrading={pendingGrading} />
      )}
      {tab === 'equipo' && <EquipoTab detail={detail} />}
    </div>
  );
}

// ─── Resumen ────────────────────────────────────────────────────────────────
function ResumenTab({
  detail,
  enrollments,
  stats,
  pendingGrading,
  onJump,
}: {
  detail: CourseDetail;
  enrollments: CourseEnrollmentList;
  stats: { modules: number; requiredModules: number; enrollments: number };
  pendingGrading: number;
  onJump: (id: TabId) => void;
}) {
  const recentEnrollments = enrollments.data.slice(0, 5);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <section className={cn(PANEL, 'p-5 sm:p-6')}>
        <header className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
              Mapa de módulos
            </h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--color-fg-muted)]">
              Estructura del curso. Para editar contenidos abre la pestaña{' '}
              <button
                type="button"
                onClick={() => onJump('contenido')}
                className="text-[var(--color-brand-300)] hover:underline"
              >
                Contenido
              </button>
              .
            </p>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            {stats.requiredModules} requeridos
          </span>
        </header>
        {detail.modules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center text-[13px] text-[var(--color-fg-muted)]">
            La administración aún no ha creado módulos. Pídeles que añadan al menos uno para que
            puedas cargar contenido.
          </div>
        ) : (
          <ol className="space-y-2.5">
            {detail.modules.map((m, i) => (
              <li
                key={m.id}
                className={cn(
                  SUBPANEL,
                  'flex items-center gap-4 px-4 py-3 transition-colors hover:border-[var(--color-border-strong)]',
                )}
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-[var(--color-fg)]">
                      {m.title}
                    </span>
                    <Badge variant="default">{CONTENT_TYPE_LABEL[m.contentType]}</Badge>
                    {m.isRequired ? (
                      <Badge variant="brand">Requerido</Badge>
                    ) : (
                      <span className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                        Opcional
                      </span>
                    )}
                  </div>
                  {m.description && (
                    <p className="mt-1 line-clamp-1 text-[12.5px] text-[var(--color-fg-muted)]">
                      {m.description}
                    </p>
                  )}
                </div>
                <span className="font-mono text-[11px] tabular-nums text-[var(--color-fg-subtle)]">
                  peso {m.weight}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onJump('contenido')}
                  className="shrink-0"
                >
                  Editar contenido
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={cn(PANEL, 'p-5 sm:p-6')}>
        <header className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
            Actividad reciente
          </h2>
          <button
            type="button"
            onClick={() => onJump('estudiantes')}
            className="text-[12px] text-[var(--color-brand-300)] hover:underline"
          >
            Ver todos →
          </button>
        </header>
        {recentEnrollments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center text-[13px] text-[var(--color-fg-muted)]">
            Aún no hay inscripciones en este curso.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {recentEnrollments.map((e) => {
              const display = e.studentName || e.name || e.studentEmail || e.email;
              return (
                <li key={e.id} className={cn(SUBPANEL, 'flex items-center gap-3 px-3.5 py-2.5')}>
                  <InitialsChip name={display} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-[var(--color-fg)]">
                      {display}
                    </p>
                    <p className="truncate text-[11.5px] text-[var(--color-fg-subtle)]">
                      Inscrito {relativeTime(e.createdAt)} · {e.completedModules}/{stats.modules}{' '}
                      módulos
                    </p>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/teacher/students/${e.id}`}>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {pendingGrading > 0 && (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
            <div className="flex items-start gap-3">
              <FileSignature className="mt-0.5 h-4 w-4 text-amber-300" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[var(--color-fg)]">
                  {pendingGrading} entrega(s) esperan tu calificación.
                </p>
                <p className="mt-1 text-[11.5px] text-[var(--color-fg-muted)]">
                  Revísalas para que las y los estudiantes puedan avanzar.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onJump('grading')}>
                Calificar
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Contenido ──────────────────────────────────────────────────────────────
function ContenidoTab({
  detail,
  moduleContents,
}: {
  detail: CourseDetail;
  moduleContents: ModuleContentBundle[];
}) {
  if (detail.modules.length === 0) {
    return (
      <section className={cn(PANEL, 'p-8 text-center')}>
        <Layers3 className="mx-auto h-8 w-8 text-[var(--color-fg-subtle)]" />
        <h3 className="mt-3 text-[15px] font-semibold text-[var(--color-fg)]">
          Aún no hay módulos
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[var(--color-fg-muted)]">
          La estructura de módulos la define la administración. Pídeles que creen los módulos del
          curso y luego podrás cargar contenido (lecturas, quizzes y entregas) en cada uno.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className={cn(PANEL, 'flex items-start gap-3 p-4')}>
        <ClipboardList className="mt-0.5 h-4 w-4 text-[var(--color-brand-300)]" />
        <p className="text-[12.5px] leading-5 text-[var(--color-fg-muted)]">
          Aquí trabajas sobre módulos existentes. Puedes crear nuevos métodos de evaluación; la
          estructura del módulo y las evaluaciones ya creadas quedan bajo administración
          institucional.
        </p>
      </div>

      {detail.modules.map((m, i) => {
        const bundle = moduleContents.find((b) => b.moduleId === m.id);
        return (
          <section key={m.id} className={cn(PANEL, 'overflow-hidden p-5 sm:p-6')}>
            <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                    Módulo {String(i + 1).padStart(2, '0')}
                  </span>
                  <Badge variant="default">{CONTENT_TYPE_LABEL[m.contentType]}</Badge>
                  {m.isRequired && <Badge variant="brand">Requerido</Badge>}
                </div>
                <h3 className="mt-1 text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
                  {m.title}
                </h3>
                {m.description && (
                  <p className="mt-1.5 max-w-prose text-[13px] text-[var(--color-fg-muted)]">
                    {m.description}
                  </p>
                )}
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                peso {m.weight}
              </span>
            </header>

            <ModuleContentManager
              courseId={detail.course.id}
              moduleId={m.id}
              topics={bundle?.topics ?? []}
              assessments={bundle?.assessments ?? []}
              questionsByAssessment={bundle?.questions ?? {}}
              accessMode="teacher"
            />
          </section>
        );
      })}
    </div>
  );
}

// ─── Estudiantes ────────────────────────────────────────────────────────────
function EstudiantesTab({
  enrollments,
  totalModules,
}: {
  enrollments: CourseEnrollmentList;
  totalModules: number;
}) {
  if (enrollments.data.length === 0) {
    return (
      <section className={cn(PANEL, 'p-8 text-center')}>
        <Users className="mx-auto h-8 w-8 text-[var(--color-fg-subtle)]" />
        <h3 className="mt-3 text-[15px] font-semibold text-[var(--color-fg)]">
          Sin estudiantes inscritos
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[var(--color-fg-muted)]">
          Las inscripciones las gestiona tu administración (manuales, por pago o vía API). Cuando
          existan, aparecerán aquí con su avance.
        </p>
      </section>
    );
  }

  return (
    <section className={cn(PANEL, 'overflow-hidden')}>
      <header className="flex items-baseline justify-between gap-3 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-[var(--color-fg)]">
            Estudiantes inscritos
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-fg-muted)]">
            Lectura. Para añadir o quitar inscripciones contacta a tu administración.
          </p>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
          {enrollments.data.length} inscritos · {totalModules} módulos
        </span>
      </header>
      <div className="overflow-x-auto border-t border-[var(--color-border)]">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
              <th className="px-5 py-3 font-medium">Estudiante</th>
              <th className="px-3 py-3 font-medium">Origen</th>
              <th className="px-3 py-3 text-right font-medium">Módulos</th>
              <th className="px-3 py-3 text-right font-medium">Avance</th>
              <th className="px-3 py-3 text-right font-medium">Final</th>
              <th className="px-3 py-3 font-medium">Inscrito</th>
              <th className="px-5 py-3 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.data.map((e) => {
              const display = e.studentName || e.name || e.studentEmail || e.email;
              const progress =
                totalModules > 0 ? Math.round((e.completedModules / totalModules) * 100) : 0;
              const final = e.finalScore != null ? `${Math.round(e.finalScore)}%` : '—';
              return (
                <tr
                  key={e.id}
                  className="border-b border-[var(--color-border)]/60 transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <InitialsChip name={display} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--color-fg)]">{display}</p>
                        <p className="truncate text-[11.5px] text-[var(--color-fg-subtle)]">
                          {e.studentEmail ?? e.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--color-fg-muted)]">
                    <Badge variant="default">{e.source}</Badge>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-[var(--color-fg)]">
                    {e.completedModules}
                    <span className="text-[var(--color-fg-subtle)]">/{totalModules}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <ProgressPill value={progress} />
                  </td>
                  <td
                    className={cn(
                      'px-3 py-3 text-right font-mono tabular-nums',
                      e.finalScore != null
                        ? 'text-[var(--color-fg)]'
                        : 'text-[var(--color-fg-subtle)]',
                    )}
                  >
                    {final}
                  </td>
                  <td className="px-3 py-3 text-[var(--color-fg-muted)]">
                    {formatDate(e.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/teacher/students/${e.id}`}>
                        Ver progreso
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProgressPill({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const tone =
    v >= 75 ? 'bg-emerald-500' : v >= 30 ? 'bg-amber-400' : 'bg-[var(--color-brand-500)]';
  return (
    <div className="inline-flex w-28 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn('h-full rounded-full transition-all', tone)}
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">{v}%</span>
    </div>
  );
}

// ─── Calificaciones ─────────────────────────────────────────────────────────
function GradingTab({
  gradingQueue,
  pendingGrading,
}: {
  gradingQueue: TeacherGradingItem[];
  pendingGrading: number;
}) {
  if (gradingQueue.length === 0) {
    return (
      <section className={cn(PANEL, 'p-8 text-center')}>
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
        <h3 className="mt-3 text-[15px] font-semibold text-[var(--color-fg)]">
          Sin entregas pendientes
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[var(--color-fg-muted)]">
          Cuando un estudiante envíe un ensayo o entrega manual, aparecerá aquí para que la revises.
        </p>
      </section>
    );
  }

  return (
    <section className={cn(PANEL, 'overflow-hidden')}>
      <header className="flex items-baseline justify-between gap-3 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-[var(--color-fg)]">
            Por calificar en este curso
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-fg-muted)]">
            {pendingGrading} entrega(s) en espera. Las quizzes autocalificadas no aparecen aquí.
          </p>
        </div>
        <Button asChild size="sm" variant="secondary">
          <Link href="/teacher/grading">Ver toda la cola →</Link>
        </Button>
      </header>
      <ul className="divide-y divide-[var(--color-border)]/60 border-t border-[var(--color-border)]">
        {gradingQueue.map((g) => {
          const display = g.student.name ?? g.student.email ?? 'Estudiante sin nombre';
          return (
            <li
              key={g.attemptId}
              className="flex flex-wrap items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
            >
              <InitialsChip name={display} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[13.5px] font-medium text-[var(--color-fg)]">
                    {display}
                  </p>
                  <Badge variant={g.status === 'submitted' ? 'warning' : 'success'}>
                    {g.status === 'submitted' ? 'Pendiente' : 'Calificada'}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--color-fg-muted)]">
                  {g.assessment?.title ?? 'Entrega'} · {g.module?.title ?? 'Módulo'} ·{' '}
                  {g.submittedAt ? `enviado ${relativeTime(g.submittedAt)}` : 'sin envío'}
                </p>
              </div>
              <span className="font-mono text-[11.5px] tabular-nums text-[var(--color-fg-subtle)]">
                Intento #{g.attemptNumber} · /{g.assessment?.maxScore ?? 100}
              </span>
              <Button asChild size="sm" variant="primary">
                <Link href={`/teacher/grading/${g.attemptId}`}>
                  {g.status === 'submitted' ? 'Calificar' : 'Revisar'}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Equipo ─────────────────────────────────────────────────────────────────
function EquipoTab({ detail }: { detail: CourseDetail }) {
  return (
    <section className={cn(PANEL, 'p-5 sm:p-6')}>
      <header className="mb-4">
        <h2 className="text-[16px] font-semibold tracking-tight text-[var(--color-fg)]">
          Docentes asignados
        </h2>
        <p className="mt-0.5 text-[12px] text-[var(--color-fg-muted)]">
          Lectura. La asignación y revocación de docentes la realiza tu administración.
        </p>
      </header>

      {detail.teachers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center text-[13px] text-[var(--color-fg-muted)]">
          Aún no hay docentes asignados a este curso.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {detail.teachers.map((t) => {
            const display = t.name ?? t.email;
            return (
              <li key={t.id} className={cn(SUBPANEL, 'flex items-center gap-3 px-4 py-3')}>
                <InitialsChip name={display} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-[var(--color-fg)]">
                    {display}
                  </p>
                  <p className="truncate text-[11.5px] text-[var(--color-fg-subtle)]">{t.email}</p>
                </div>
                <Badge variant={t.assignmentRole === 'owner' ? 'brand' : 'default'}>
                  {ROLE_LABEL[t.assignmentRole]}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Re-export para evitar tree-shake quejándose de exports no usados
export type { ModuleProgressStatus };
export { STATUS_META };
