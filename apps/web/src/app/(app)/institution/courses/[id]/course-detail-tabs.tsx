'use client';

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  CreditCard,
  GitBranch,
  Globe2,
  GraduationCap,
  KeyRound,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  AssessmentQuestionRow,
  AssessmentRow,
  CertTemplateRow,
  CourseDetail,
  CourseEnrollment,
  CourseEnrollmentList,
  EnrollmentProgress,
  ModuleContentType,
  ModuleProgressStatus,
  TeamMember,
  TopicRow,
} from '@/lib/api/endpoints/me';
import { ModuleContentManager } from './module-content-manager';
import {
  isValidLockAddress,
  LOCK_CHAINS,
  LockFields,
  type CourseAccessMode,
} from '../lock-fields';
import {
  archiveCourseAction,
  assignCourseTeacherAction,
  createModuleAction,
  deleteCourseAction,
  deleteModuleAction,
  enrollStudentAction,
  getEnrollmentProgressAction,
  inviteTeamMemberAction,
  regenerateAccessCodeAction,
  removeEnrollmentAction,
  reorderModulesAction,
  setModuleProgressAction,
  unassignCourseTeacherAction,
  updateCourseAction,
  updateModuleAction,
} from '../../actions';

type CourseVisibility = CourseDetail['course']['visibility'];

type TabId = 'general' | 'modules' | 'teachers' | 'students' | 'danger';
type CourseStatus = CourseDetail['course']['status'];
type AcademicMemberRole = 'teacher' | 'reviewer';
type FeedbackState = { tone: 'success' | 'error'; message: string } | null;

const ACADEMIC_MEMBER_ROLE_LABEL: Record<AcademicMemberRole, string> = {
  teacher: 'Docente',
  reviewer: 'Revisor',
};

const COURSE_ASSIGNMENT_ROLE_LABEL = {
  owner: 'Docente',
  assistant: 'Revisor',
} as const;

export interface ModuleContentBundle {
  moduleId: string;
  topics: TopicRow[];
  assessments: AssessmentRow[];
  questions: Record<string, AssessmentQuestionRow[]>;
}

interface Props {
  detail: CourseDetail;
  enrollments: CourseEnrollmentList;
  teamMembers: TeamMember[];
  currentUserId: string;
  templates: CertTemplateRow[];
  moduleContents: ModuleContentBundle[];
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'modules', label: 'Módulos' },
  { id: 'teachers', label: 'Personal' },
  { id: 'students', label: 'Estudiantes' },
  { id: 'danger', label: 'Peligro' },
];

const CONTENT_TYPE_LABEL: Record<ModuleContentType, string> = {
  video: 'Video',
  article: 'Lectura',
  quiz: 'Quiz',
  assignment: 'Tarea',
  live: 'En vivo',
};

const CONTENT_TYPE_HELP: Record<ModuleContentType, string> = {
  video: 'Lección grabada o cápsula visual.',
  article: 'Lectura guiada, PDF o nota interna.',
  quiz: 'Evaluación corta con score.',
  assignment: 'Entrega revisable o evidencia.',
  live: 'Sesión en tiempo real o sincrónica.',
};

const COURSE_STATUS_META: Record<
  CourseStatus,
  { label: string; variant: 'success' | 'warning' | 'default'; description: string }
> = {
  published: {
    label: 'Publicado',
    variant: 'success',
    description: 'Visible y listo para operación académica.',
  },
  draft: {
    label: 'Borrador',
    variant: 'warning',
    description: 'Aún en diseño. Úsalo para construir sin exponerlo.',
  },
  archived: {
    label: 'Archivado',
    variant: 'default',
    description: 'Se conserva el historial, pero el curso queda congelado.',
  },
};

const STATUS_LABEL: Record<ModuleProgressStatus, string> = {
  not_started: 'Sin empezar',
  in_progress: 'En progreso',
  completed: 'Completado',
};

const STATUS_COLOR: Record<ModuleProgressStatus, string> = {
  not_started: 'text-[var(--color-fg-subtle)]',
  in_progress: 'text-amber-300',
  completed: 'text-emerald-300',
};

const STATUS_ICON: Record<ModuleProgressStatus, LucideIcon> = {
  not_started: Circle,
  in_progress: Loader2,
  completed: CheckCircle2,
};

const ATTEMPT_STATUS_LABEL = {
  in_progress: 'Iniciado',
  submitted: 'Enviado',
  graded: 'Calificado',
} as const;

function summarizeAssessmentAttempts(module: EnrollmentProgress['modules'][number]) {
  const attempts = module.assessments.flatMap((assessment) => assessment.attempts);
  return {
    started: attempts.filter((attempt) => attempt.status === 'in_progress').length,
    submitted: attempts.filter((attempt) => attempt.status === 'submitted').length,
    graded: attempts.filter((attempt) => attempt.status === 'graded').length,
    total: attempts.length,
  };
}

function formatAttemptAnswers(answers: Record<string, unknown>) {
  const essay = answers.essay;
  if (typeof essay === 'string' && essay.trim()) return essay.trim();

  const values = Object.values(answers)
    .map((value) => {
      if (typeof value === 'string') return value;
      if (typeof value === 'boolean') return value ? 'Verdadero' : 'Falso';
      if (value == null) return null;
      return JSON.stringify(value);
    })
    .filter((value): value is string => Boolean(value && value.trim()));

  if (values.length === 0) return null;
  return values.join(' · ');
}

const VISIBILITY_META: Record<
  CourseVisibility,
  { label: string; description: string; icon: LucideIcon; usesPrice: boolean; usesCode: boolean }
> = {
  public_free: {
    label: 'Pública gratuita',
    description: 'Aparece en el catálogo abierto. Cualquiera se inscribe sin pagar.',
    icon: Globe2,
    usesPrice: false,
    usesCode: false,
  },
  public_paid: {
    label: 'Pública de pago',
    description: 'Aparece en el catálogo abierto y se cobra al inscribirse.',
    icon: CreditCard,
    usesPrice: true,
    usesCode: false,
  },
  private_code: {
    label: 'Privada por código',
    description: 'No aparece en el catálogo. Sólo se accede canjeando el código.',
    icon: KeyRound,
    usesPrice: false,
    usesCode: true,
  },
  hybrid: {
    label: 'Híbrida',
    description:
      'Visible y de pago para externos. Tus estudiantes registrados acceden gratis con el código.',
    icon: Building2,
    usesPrice: true,
    usesCode: true,
  },
  token_gated: {
    label: 'Con membresía (Unlock)',
    description:
      'Visible en el catálogo. La matrícula la concede una llave de Unlock; el precio lo fija el Lock on-chain.',
    icon: Wallet,
    // El precio vive en el Lock, no en priceCents: mostrar ese campo aquí
    // sugeriría un importe que nadie cobra.
    usesPrice: false,
    usesCode: false,
  },
};

const PANEL_CLASS =
  'rounded-[26px] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.88),rgba(10,13,26,0.96))] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]';
const SUBPANEL_CLASS = 'rounded-2xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.82)]';
const TEXTAREA_CLASS =
  'w-full rounded-xl border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors focus:border-[var(--color-brand-400)] focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-brand-500),transparent_60%)]';

export function CourseDetailTabs({
  detail,
  enrollments,
  teamMembers,
  currentUserId,
  templates,
  moduleContents,
}: Props) {
  const [tab, setTab] = useState<TabId>('general');
  const completionRate =
    detail.metrics.enrollments > 0
      ? Math.round((detail.metrics.completed / detail.metrics.enrollments) * 100)
      : 0;
  const stats: Array<{
    label: string;
    value: string | number;
    tone?: 'default' | 'success' | 'warning' | 'brand';
  }> = [
    { label: 'Inscritos', value: detail.metrics.enrollments },
    { label: 'Completados', value: detail.metrics.completed, tone: 'success' },
    { label: 'En progreso', value: detail.metrics.inProgress, tone: 'warning' },
    {
      label: 'Score prom.',
      value: detail.metrics.avgScore != null ? `${Math.round(detail.metrics.avgScore)}%` : '—',
    },
    { label: 'Emitidos', value: detail.metrics.certificatesIssued, tone: 'brand' },
  ];
  const visMeta = VISIBILITY_META[detail.course.visibility];
  const VisIcon = visMeta.icon;

  return (
    <div className="space-y-5">
      <header className={cn(PANEL_CLASS, 'overflow-hidden')}>
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
              {detail.course.accessCode && (
                <span className="ml-1 hidden border-l border-[var(--color-border)] pl-2 font-mono text-[10px] tracking-[0.18em] text-[var(--color-fg-subtle)] sm:inline">
                  {detail.course.accessCode}
                </span>
              )}
            </span>
          </div>

          {detail.course.description?.trim() ? (
            <p className="max-w-[68ch] text-sm leading-6 text-[var(--color-fg-muted)]">
              {detail.course.description}
            </p>
          ) : (
            <p className="max-w-[68ch] text-sm italic leading-6 text-[var(--color-fg-subtle)]">
              Sin descripción. Define alcance y promesa para operar el curso con claridad.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <InfoChip icon={Layers3} label={`${detail.modules.length} módulos`} />
            <InfoChip icon={Users} label={`${detail.teachers.length} personal`} />
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
                label={`${completionRate}% completan`}
                tone={completionRate >= 50 ? 'success' : 'default'}
              />
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px border-t border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-3 md:grid-cols-5">
          {stats.map((s) => (
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

      <nav className={cn(PANEL_CLASS, 'overflow-x-auto p-2')}>
        <div className="flex min-w-max gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
                tab === item.id
                  ? 'border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/12 text-[var(--color-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                  : 'border border-transparent text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:bg-white/[0.04] hover:text-[var(--color-fg)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'general' && <GeneralTab detail={detail} templates={templates} />}
      {tab === 'modules' && <ModulesTab detail={detail} moduleContents={moduleContents} />}
      {tab === 'teachers' && (
        <TeachersTab detail={detail} teamMembers={teamMembers} currentUserId={currentUserId} />
      )}
      {tab === 'students' && <StudentsTab courseId={detail.course.id} enrollments={enrollments} />}
      {tab === 'danger' && <DangerTab detail={detail} />}
    </div>
  );
}

function GeneralTab({ detail, templates }: { detail: CourseDetail; templates: CertTemplateRow[] }) {
  const c = detail.course;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [status, setStatus] = useState<CourseStatus>(c.status);
  const [autoIssueEnabled, setAutoIssueEnabled] = useState(c.autoIssueEnabled);
  const [visibility, setVisibility] = useState<CourseVisibility>(c.visibility);
  const [accessCode, setAccessCode] = useState<string | null>(c.accessCode);
  const [codePending, startCode] = useTransition();
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const visMeta = VISIBILITY_META[visibility];

  // Configuración del Lock. Se precarga con lo guardado para que editar un
  // curso con membresía no obligue a volver a escribirlo todo.
  const [lockAddress, setLockAddress] = useState(c.lockAddress ?? '');
  const [lockChainId, setLockChainId] = useState<number>(c.lockChainId ?? LOCK_CHAINS[0].id);
  const [previewModuleCount, setPreviewModuleCount] = useState(c.previewModuleCount ?? 1);
  // Se precarga lo guardado: editar otra cosa del curso no debe cambiar en
  // silencio cómo caduca el acceso de quienes ya pagaron.
  const [accessMode, setAccessMode] = useState<CourseAccessMode>(c.accessMode ?? 'perpetual');
  const usesLock = visibility === 'token_gated';

  return (
    <form
      action={(fd) => {
        fd.set('status', status);
        fd.set('autoIssueEnabled', autoIssueEnabled ? 'on' : '');
        fd.set('visibility', visibility);

        if (usesLock) {
          // Se valida antes de enviar para señalar el campo. La API y un CHECK
          // en la base lo vuelven a exigir: un curso con membresía sin Lock
          // quedaría en el catálogo sin que nadie pudiera matricularse.
          if (!isValidLockAddress(lockAddress)) {
            setFeedback({
              tone: 'error',
              message: 'Pegá la dirección del Lock (0x…, 42 caracteres).',
            });
            return;
          }
          fd.set('lockAddress', lockAddress.trim());
          fd.set('lockChainId', String(lockChainId));
          fd.set('previewModuleCount', String(previewModuleCount));
          fd.set('accessMode', accessMode);
        } else {
          fd.delete('lockAddress');
          fd.delete('lockChainId');
          fd.delete('previewModuleCount');
          // Sin Lock no hay llave que revalidar; el backend lo devuelve a
          // pago único de todos modos.
          fd.delete('accessMode');
        }

        setFeedback(null);
        start(async () => {
          const res = await updateCourseAction(c.id, fd);
          if (res.ok) {
            setFeedback({ tone: 'success', message: 'Curso actualizado correctamente.' });
            router.refresh();
          } else {
            setFeedback({ tone: 'error', message: res.error ?? 'No se pudo guardar.' });
          }
        });
      }}
      className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_22rem]"
    >
      <Panel
        eyebrow="Base del curso"
        title="Identidad, promesa y reglas"
        description="Define el título público, el slug canónico y los criterios con los que el equipo va a operar este curso."
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Field label="Título">
            <Input name="title" defaultValue={c.title} required minLength={2} />
          </Field>
          <Field label="Slug">
            <Input name="slug" defaultValue={c.slug} required minLength={2} />
          </Field>
        </div>

        <Field
          label="Descripción"
          help="Escribe el objetivo del curso, su valor y cómo debe interpretarlo el equipo institucional."
        >
          <textarea
            name="description"
            defaultValue={c.description ?? ''}
            rows={5}
            placeholder="Ej. Programa intensivo para certificar competencias internas de onboarding técnico."
            className={TEXTAREA_CLASS}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-3">
          <Field
            label="Precio (USD)"
            help={visMeta.usesPrice ? undefined : 'No aplica en este modo de acceso.'}
          >
            <Input
              name="priceUsd"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(c.priceCents / 100).toFixed(2)}
              disabled={!visMeta.usesPrice}
              className={cn(!visMeta.usesPrice && 'opacity-50')}
            />
          </Field>
          <Field label="Nota mínima (%)">
            <Input
              name="passingScore"
              type="number"
              min="0"
              max="100"
              defaultValue={c.passingScore}
            />
          </Field>
          <Field label="Duración (h)">
            <Input
              name="durationHours"
              type="number"
              min="0"
              step="0.5"
              defaultValue={c.durationHours ?? ''}
            />
          </Field>
        </div>

        <Field
          label="Plantilla de certificado"
          help="Se usará cuando la emisión automática esté activada para este curso."
        >
          <Select name="templateId" defaultValue={c.templateId ?? ''}>
            <option value="">Sin plantilla vinculada</option>
            {[...templates]
              .sort((a, b) => a.name.localeCompare(b.name, 'es'))
              .map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
          </Select>
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending}>
            Guardar cambios
          </Button>
          <Badge variant="brand">Moneda fija: {c.currency}</Badge>
          {feedback ? <InlineFeedback feedback={feedback} /> : null}
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel
          eyebrow="Publicación"
          title="Estado visible"
          description="Aquí decides si el curso está en construcción, en operación o archivado con historial."
          compact
        >
          <input type="hidden" name="status" value={status} />
          <div className="space-y-2.5">
            {(['draft', 'published', 'archived'] as const).map((option) => {
              const meta = COURSE_STATUS_META[option];
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={status === option}
                  onClick={() => setStatus(option)}
                  className={cn(
                    'w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition-all duration-150',
                    status === option
                      ? 'border-[var(--color-brand-500)]/50 bg-[var(--color-brand-500)]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'border-[var(--color-border)] bg-white/[0.02] hover:border-[var(--color-border-strong)] hover:bg-white/[0.04]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[var(--color-fg)]">{meta.label}</span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-[var(--color-fg-muted)]">
                    {meta.description}
                  </p>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel
          eyebrow="Automatización"
          title="Emisión automática"
          description="Usa certificados instantáneos sólo cuando el recorrido y el scoring ya estén bien calibrados."
          compact
        >
          <input type="hidden" name="autoIssueEnabled" value={autoIssueEnabled ? 'on' : ''} />
          <div className="grid gap-3">
            <ToggleCard
              title="Activada"
              description="Al completar y aprobar, el certificado puede emitirse sin intervención manual."
              active={autoIssueEnabled}
              onClick={() => setAutoIssueEnabled(true)}
            />
            <ToggleCard
              title="Manual"
              description="Requiere revisión previa o decisión operativa antes de emitir la credencial."
              active={!autoIssueEnabled}
              onClick={() => setAutoIssueEnabled(false)}
            />
          </div>
        </Panel>

        <Panel
          eyebrow="Acceso & visibilidad"
          title="¿Quién puede ver e inscribirse?"
          description="Cambia el modo en cualquier momento. El código se genera y limpia automáticamente."
          compact
        >
          <input type="hidden" name="visibility" value={visibility} />
          <div className="grid gap-2.5">
            {(Object.keys(VISIBILITY_META) as CourseVisibility[]).map((option) => {
              const meta = VISIBILITY_META[option];
              const Icon = meta.icon;
              const active = visibility === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setVisibility(option)}
                  className={cn(
                    'flex w-full cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]',
                    active
                      ? 'border-[var(--color-brand-500)]/55 bg-[var(--color-brand-500)]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'border-[var(--color-border)] bg-white/[0.02] hover:border-[var(--color-border-strong)] hover:bg-white/[0.04]',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border',
                      active
                        ? 'border-[var(--color-brand-400)]/60 bg-[color-mix(in_oklab,var(--color-brand-500),transparent_70%)] text-[var(--color-brand-200)]'
                        : 'border-[var(--color-border)] bg-white/[0.03] text-[var(--color-fg-muted)]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--color-fg)]">
                      {meta.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-[var(--color-fg-muted)]">
                      {meta.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {usesLock && (
            <div className="mt-4">
              <LockFields
                idPrefix="edit-course-lock"
                lockAddress={lockAddress}
                onLockAddressChange={setLockAddress}
                lockChainId={lockChainId}
                onLockChainIdChange={setLockChainId}
                previewModuleCount={previewModuleCount}
                onPreviewModuleCountChange={setPreviewModuleCount}
                accessMode={accessMode}
                onAccessModeChange={setAccessMode}
                totalModules={detail.modules.length}
              />
            </div>
          )}

          {visMeta.usesCode && (
            <div className="mt-4 space-y-2 rounded-2xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.7)] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                  Código de canje
                </span>
                {accessCode && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(accessCode);
                        setCopyState('copied');
                        setTimeout(() => setCopyState('idle'), 1500);
                      } catch {
                        /* noop */
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-[var(--color-fg-muted)] transition hover:bg-white/[0.06] hover:text-[var(--color-fg)]"
                  >
                    <Copy className="h-3 w-3" />
                    {copyState === 'copied' ? 'Copiado' : 'Copiar'}
                  </button>
                )}
              </div>
              <div className="font-mono text-base tracking-[0.18em] text-[var(--color-fg)] break-all">
                {accessCode ?? 'Se generará al guardar'}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={codePending}
                  onClick={() => {
                    startCode(async () => {
                      const res = await regenerateAccessCodeAction(c.id);
                      if (res.ok) {
                        setAccessCode(res.data?.accessCode ?? null);
                        setFeedback({ tone: 'success', message: 'Código de canje regenerado.' });
                      } else {
                        setFeedback({
                          tone: 'error',
                          message: res.error ?? 'No se pudo regenerar.',
                        });
                      }
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:bg-white/[0.06] hover:text-[var(--color-fg)] disabled:opacity-60"
                >
                  <RefreshCw className={cn('h-3 w-3', codePending && 'animate-spin')} />
                  {codePending ? 'Regenerando…' : 'Regenerar código'}
                </button>
                <span className="text-[11px] text-[var(--color-fg-subtle)]">
                  Compartíselo a tu comunidad para que canjeen el acceso.
                </span>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </form>
  );
}

function ModulesTab({
  detail,
  moduleContents,
}: {
  detail: CourseDetail;
  moduleContents: ModuleContentBundle[];
}) {
  const router = useRouter();
  const courseId = detail.course.id;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const contentByModule = new Map(moduleContents.map((m) => [m.moduleId, m]));
  const totalWeight = detail.modules.reduce((acc, module) => acc + (module.weight ?? 0), 0);
  const requiredCount = detail.modules.filter((module) => module.isRequired).length;

  const moveModule = (moduleId: string, direction: 'up' | 'down') => {
    const currentIndex = detail.modules.findIndex((module) => module.id === moduleId);
    if (currentIndex < 0) return;
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= detail.modules.length) return;
    const order = detail.modules.map((module) => module.id);
    [order[currentIndex], order[nextIndex]] = [order[nextIndex]!, order[currentIndex]!];
    setFeedback(null);
    start(async () => {
      const res = await reorderModulesAction(courseId, order);
      if (res.ok) {
        setFeedback({ tone: 'success', message: 'Orden de módulos actualizado.' });
        router.refresh();
      } else {
        setFeedback({ tone: 'error', message: res.error ?? 'No se pudo reordenar.' });
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStrip
          title="Módulos"
          body={`${detail.modules.length} piezas activas en el recorrido.`}
        />
        <SummaryStrip
          title="Peso acumulado"
          body={
            totalWeight === 100
              ? 'La ponderación está alineada para el score final.'
              : `Hoy suma ${totalWeight}. Conviene cerrarlo en 100 para que el promedio sea claro.`
          }
        />
        <SummaryStrip
          title="Obligatorios"
          body={`${requiredCount} módulo(s) definen la finalización del curso.`}
        />
      </div>

      <Panel
        eyebrow="Arquitectura del curso"
        title="Construye el recorrido"
        description="Evita formularios grises y ordena el curso como una secuencia operable: formato, peso y obligatoriedad se leen de un golpe."
        action={
          <Button size="sm" type="button" onClick={() => setShowCreate((value) => !value)}>
            <Plus className="h-4 w-4" /> {showCreate ? 'Cerrar editor' : 'Nuevo módulo'}
          </Button>
        }
      >
        {showCreate ? (
          <ModuleForm
            mode="create"
            onClose={() => setShowCreate(false)}
            onSubmit={(fd) => {
              setFeedback(null);
              start(async () => {
                const res = await createModuleAction(courseId, fd);
                if (res.ok) {
                  setShowCreate(false);
                  setFeedback({ tone: 'success', message: 'Módulo creado.' });
                  router.refresh();
                } else {
                  setFeedback({ tone: 'error', message: res.error ?? 'No se pudo crear.' });
                }
              });
            }}
            pending={pending}
          />
        ) : null}

        {feedback ? <InlineFeedback feedback={feedback} /> : null}

        {detail.modules.length === 0 ? (
          <EmptyHint
            icon={Layers3}
            title="Todavía no hay módulos"
            description="Empieza con una lectura, un video o una evaluación. El primer módulo define el tono del recorrido."
          />
        ) : (
          <div className="grid gap-3">
            {detail.modules.map((module, index) => {
              const isEditing = editingId === module.id;
              return (
                <div key={module.id} className={cn(SUBPANEL_CLASS, 'overflow-hidden')}>
                  {isEditing ? (
                    <div className="p-4">
                      <ModuleForm
                        mode="edit"
                        initial={module}
                        onClose={() => setEditingId(null)}
                        onSubmit={(fd) => {
                          setFeedback(null);
                          start(async () => {
                            const res = await updateModuleAction(courseId, module.id, fd);
                            if (res.ok) {
                              setEditingId(null);
                              setFeedback({ tone: 'success', message: 'Módulo actualizado.' });
                              router.refresh();
                            } else {
                              setFeedback({
                                tone: 'error',
                                message: res.error ?? 'No se pudo actualizar.',
                              });
                            }
                          });
                        }}
                        pending={pending}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
                      <div className="flex items-start gap-4">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-brand-500)]/10 font-mono text-sm font-semibold text-[var(--color-brand-200)]">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-[var(--color-fg)]">
                              {module.title}
                            </h3>
                            <Badge variant="brand">{CONTENT_TYPE_LABEL[module.contentType]}</Badge>
                            <Badge variant={module.isRequired ? 'warning' : 'default'}>
                              {module.isRequired ? 'Obligatorio' : 'Opcional'}
                            </Badge>
                            <Badge variant="default">Peso {module.weight}</Badge>
                          </div>
                          <p className="mt-2 max-w-[68ch] text-sm leading-6 text-[var(--color-fg-muted)]">
                            {module.description?.trim() || CONTENT_TYPE_HELP[module.contentType]}
                          </p>
                        </div>
                      </div>

                      <div className="ml-auto flex flex-wrap items-center gap-2 lg:justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant={expandedId === module.id ? 'primary' : 'secondary'}
                          onClick={() =>
                            setExpandedId((prev) => (prev === module.id ? null : module.id))
                          }
                        >
                          {expandedId === module.id ? 'Ocultar contenido' : 'Contenido'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending || index === 0}
                          onClick={() => moveModule(module.id, 'up')}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending || index === detail.modules.length - 1}
                          onClick={() => moveModule(module.id, 'down')}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingId(module.id)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (
                              !confirm(
                                '¿Eliminar este módulo? El avance ligado también se perderá.',
                              )
                            )
                              return;
                            setFeedback(null);
                            start(async () => {
                              const res = await deleteModuleAction(courseId, module.id);
                              if (res.ok) {
                                setFeedback({ tone: 'success', message: 'Módulo eliminado.' });
                                router.refresh();
                              } else {
                                setFeedback({
                                  tone: 'error',
                                  message: res.error ?? 'No se pudo eliminar.',
                                });
                              }
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {expandedId === module.id && !isEditing
                    ? (() => {
                        const bundle = contentByModule.get(module.id);
                        return (
                          <ModuleContentManager
                            courseId={courseId}
                            moduleId={module.id}
                            topics={bundle?.topics ?? []}
                            assessments={bundle?.assessments ?? []}
                            questionsByAssessment={bundle?.questions ?? {}}
                          />
                        );
                      })()
                    : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ModuleForm({
  mode,
  initial,
  onSubmit,
  onClose,
  pending,
}: {
  mode: 'create' | 'edit';
  initial?: CourseDetail['modules'][number];
  onSubmit: (fd: FormData) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [contentType, setContentType] = useState<ModuleContentType>(
    initial?.contentType ?? 'article',
  );

  // Membresía propia del módulo. Es opcional a propósito: la mayoría de los
  // módulos hereda el acceso del curso, y mostrar siempre estos campos haría
  // parecer obligatorio algo que casi nunca hace falta.
  const [gated, setGated] = useState(Boolean(initial?.lockAddress));
  const [lockAddress, setLockAddress] = useState(initial?.lockAddress ?? '');
  const [lockChainId, setLockChainId] = useState<number>(
    initial?.lockChainId ?? LOCK_CHAINS[0].id,
  );

  return (
    <form
      action={onSubmit}
      className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-[rgba(12,16,32,0.78)] p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-fg)]">
            {mode === 'create' ? 'Nuevo módulo' : 'Editar módulo'}
          </p>
          <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
            Define formato, peso y obligatoriedad sin depender de selects nativos.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-fg-subtle)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Field label="Título">
        <Input name="title" defaultValue={initial?.title ?? ''} required minLength={2} />
      </Field>

      <Field
        label="Descripción"
        help="Usa una descripción breve que ayude al equipo a entender el propósito pedagógico de este paso."
      >
        <textarea
          name="description"
          defaultValue={initial?.description ?? ''}
          rows={3}
          placeholder="Qué debe lograr el estudiante en este tramo."
          className={TEXTAREA_CLASS}
        />
      </Field>

      <Field
        label="Tipo de contenido"
        help="Elige el formato por intención, no por costumbre. Esto ayuda a leer el mapa del curso de un vistazo."
      >
        <input type="hidden" name="contentType" value={contentType} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {(Object.keys(CONTENT_TYPE_LABEL) as ModuleContentType[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={contentType === option}
              onClick={() => setContentType(option)}
              className={cn(
                'min-h-[104px] cursor-pointer rounded-xl border px-4 py-3 text-left transition-all duration-150',
                contentType === option
                  ? 'border-[var(--color-brand-500)]/50 bg-[var(--color-brand-500)]/10'
                  : 'border-[var(--color-border)] bg-white/[0.02] hover:border-[var(--color-border-strong)] hover:bg-white/[0.04]',
              )}
            >
              <p className="text-sm font-medium text-[var(--color-fg)]">
                {CONTENT_TYPE_LABEL[option]}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-fg-muted)]">
                {CONTENT_TYPE_HELP[option]}
              </p>
            </button>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-end">
        <Field label="Peso (0–100)">
          <Input
            name="weight"
            type="number"
            min="0"
            max="100"
            defaultValue={initial?.weight ?? 0}
          />
        </Field>
        <Field label="Regla de finalización">
          <label className="flex min-h-[60px] cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-4 py-3 text-sm text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-white/[0.04]">
            <input
              type="checkbox"
              name="isRequired"
              defaultChecked={initial?.isRequired ?? true}
              className="h-4 w-4 shrink-0 rounded border-[var(--color-border)] bg-transparent"
            />
            <span>Este módulo es obligatorio para marcar el curso como completado.</span>
          </label>
        </Field>
      </div>

      {/* Material premium dentro de un curso abierto: el módulo pide su propia
          llave aunque el estudiante ya esté matriculado. */}
      <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--color-fg-muted)]">
          <input
            type="checkbox"
            checked={gated}
            onChange={(e) => setGated(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--color-border)] bg-transparent"
          />
          <span>
            <span className="block font-medium text-[var(--color-fg)]">
              Exigir una membresía propia para este módulo
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-fg-subtle)]">
              Para material premium dentro de un curso abierto. Sin esto, el módulo se abre con la
              matrícula del curso.
            </span>
          </span>
        </label>

        <input type="hidden" name="moduleGated" value={gated ? 'on' : ''} />

        {gated ? (
          <div className="grid gap-4 rounded-xl border border-[var(--color-brand-500)]/25 bg-[color-mix(in_oklab,var(--color-brand-500),transparent_95%)] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,200px)]">
            <div className="grid gap-2">
              <Label htmlFor="module-lock-address">Dirección del Lock</Label>
              <Input
                id="module-lock-address"
                name="lockAddress"
                value={lockAddress}
                onChange={(e) => setLockAddress(e.target.value)}
                placeholder="0x…"
                className="font-mono text-[13px]"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="module-lock-chain">Red</Label>
              <select
                id="module-lock-chain"
                name="lockChainId"
                value={lockChainId}
                onChange={(e) => setLockChainId(Number(e.target.value))}
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
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose} className="w-full sm:w-auto">
          Cancelar
        </Button>
        <Button type="submit" loading={pending} className="w-full sm:w-auto">
          {mode === 'create' ? 'Crear módulo' : 'Guardar módulo'}
        </Button>
      </div>
    </form>
  );
}

function TeachersTab({
  detail,
  teamMembers,
  currentUserId,
}: {
  detail: CourseDetail;
  teamMembers: TeamMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const courseId = detail.course.id;
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [memberRole, setMemberRole] = useState<AcademicMemberRole>('teacher');
  const [inviteEmail, setInviteEmail] = useState('');

  const memberLookup = useMemo(
    () => new Map(teamMembers.map((member) => [member.userId, member])),
    [teamMembers],
  );

  const assignableMembers = useMemo(
    () =>
      teamMembers
        .filter((member) => member.userId !== currentUserId)
        .filter((member) => member.memberRole === 'teacher' || member.memberRole === 'reviewer')
        .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, 'es')),
    [currentUserId, teamMembers],
  );
  const hasOnlyCurrentUser =
    teamMembers.length > 0 && teamMembers.every((m) => m.userId === currentUserId);

  const assignedByUserId = useMemo(
    () => new Map(detail.teachers.map((teacher) => [teacher.userId, teacher])),
    [detail.teachers],
  );

  const availableMembers = useMemo(
    () => assignableMembers.filter((member) => !assignedByUserId.has(member.userId)),
    [assignableMembers, assignedByUserId],
  );

  const [selectedUserId, setSelectedUserId] = useState<string>('');

  useEffect(() => {
    if (!selectedUserId) return;
    if (!availableMembers.some((member) => member.userId === selectedUserId)) {
      setSelectedUserId('');
    }
  }, [availableMembers, selectedUserId]);

  const selectedMember =
    availableMembers.find((member) => member.userId === selectedUserId) ?? null;
  const emailCandidate = inviteEmail.trim().toLowerCase();
  const matchedMember =
    emailCandidate.length > 0
      ? availableMembers.find((member) => member.email.toLowerCase() === emailCandidate) ?? null
      : null;
  const actionableMember = matchedMember ?? selectedMember;
  const actionableMemberRole = actionableMember?.memberRole as AcademicMemberRole | undefined;
  const effectiveMemberRole = memberRole;
  const effectiveAssignmentRole = effectiveMemberRole === 'reviewer' ? 'assistant' : 'owner';
  const isAssigningExistingMember = Boolean(actionableMember);

  function selectTeamMember(member: TeamMember) {
    setSelectedUserId(member.userId);
    setInviteEmail(member.email);
    setMemberRole(member.memberRole as AcademicMemberRole);
    setFeedback(null);
  }

  function updateEmail(value: string) {
    setInviteEmail(value);
    const normalized = value.trim().toLowerCase();
    const match = availableMembers.find((member) => member.email.toLowerCase() === normalized);
    if (match) {
      setSelectedUserId(match.userId);
      setMemberRole(match.memberRole as AcademicMemberRole);
    } else if (selectedMember && selectedMember.email.toLowerCase() !== normalized) {
      setSelectedUserId('');
    }
  }

  function submitPersonnel(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail && !actionableMember) return;
    start(async () => {
      const res = actionableMember
        ? await assignCourseTeacherAction(courseId, actionableMember.userId, effectiveAssignmentRole)
        : await (async () => {
            const form = new FormData();
            form.set('email', normalizedEmail);
            form.set('memberRole', memberRole);
            form.set('courseId', courseId);
            return inviteTeamMemberAction(form);
          })();
      if (res.ok) {
        setInviteEmail('');
        setSelectedUserId('');
        setFeedback({
          tone: 'success',
          message: actionableMember
            ? 'Personal asignado al curso.'
            : 'Invitación enviada. Se asignará al curso cuando la acepte.',
        });
        router.refresh();
      } else {
        setFeedback({
          tone: 'error',
          message:
            res.error ??
            (actionableMember ? 'No se pudo asignar.' : 'No se pudo enviar la invitación.'),
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
        <Panel
          eyebrow="Equipo elegible"
          title={`${assignableMembers.length} miembros del equipo`}
          description="Toca a una persona disponible o escribe su email en el panel de docente o revisor. Tu propia cuenta no aparece en esta asignación."
        >
          {assignableMembers.length === 0 ? (
            <EmptyHint
              icon={Users}
              title="Sin miembros disponibles"
              description={
                hasOnlyCurrentUser
                  ? 'Invita a otra persona para asignarla como personal del curso.'
                  : 'Invita docentes o revisores al equipo institucional para asignarlos.'
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[rgba(9,12,26,0.5)]">
              {assignableMembers.map((member) => {
                const assigned = assignedByUserId.get(member.userId);
                const isSelected = selectedUserId === member.userId;
                const initials = (member.name ?? member.email)
                  .split(/\s+/)
                  .map((s) => s[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                return (
                  <li key={member.userId}>
                    <button
                      type="button"
                      disabled={Boolean(assigned)}
                      onClick={() => selectTeamMember(member)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 disabled:cursor-default',
                        assigned
                          ? 'bg-emerald-500/[0.04]'
                          : isSelected
                            ? 'bg-[var(--color-brand-500)]/[0.10]'
                            : 'hover:bg-white/[0.03]',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide',
                          assigned
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : isSelected
                              ? 'bg-[var(--color-brand-500)]/20 text-[var(--color-brand-200)]'
                              : 'bg-white/[0.06] text-[var(--color-fg-muted)]',
                        )}
                      >
                        {initials || '?'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                          {member.name ?? member.email}
                        </p>
                        <p className="truncate text-xs text-[var(--color-fg-subtle)]">
                          {member.email} ·{' '}
                          {ACADEMIC_MEMBER_ROLE_LABEL[member.memberRole as AcademicMemberRole] ??
                            member.memberRole}
                        </p>
                      </div>
                      {assigned ? (
                        <Badge variant="success">
                          {COURSE_ASSIGNMENT_ROLE_LABEL[assigned.assignmentRole]}
                        </Badge>
                      ) : isSelected ? (
                        <Badge variant="brand">Seleccionado</Badge>
                      ) : (
                        <span className="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                          Disponible
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel eyebrow="Agregar personal" title="Docente o revisor" compact>
          <form onSubmit={submitPersonnel} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teacherInviteEmail">Email *</Label>
              <Input
                id="teacherInviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(event) => updateEmail(event.target.value)}
                placeholder="persona@institucion.edu"
                required
              />
              <p className="text-xs leading-5 text-[var(--color-fg-muted)]">
                Si el email coincide con el equipo elegible, se asigna al curso. Si no existe,
                se envía una invitación.
              </p>
            </div>

            {actionableMember ? (
              <div className={cn(SUBPANEL_CLASS, 'p-3')}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                      {actionableMember.name ?? actionableMember.email}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--color-fg-subtle)]">
                      {actionableMember.email}
                    </p>
                  </div>
                  <Badge variant="brand">
                    {ACADEMIC_MEMBER_ROLE_LABEL[actionableMemberRole ?? 'teacher']}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--color-fg-muted)]">
                  Esta persona ya pertenece al equipo como{' '}
                  {ACADEMIC_MEMBER_ROLE_LABEL[actionableMemberRole ?? 'teacher']}. El rol elegido
                  abajo aplica sólo para este curso.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                Rol
              </Label>
              <div
                role="radiogroup"
                className="flex rounded-xl border border-[var(--color-border)] bg-[rgba(9,12,26,0.6)] p-1"
              >
                {(['teacher', 'reviewer'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    role="radio"
                    aria-checked={effectiveMemberRole === role}
                    onClick={() => setMemberRole(role)}
                    className={cn(
                      'flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      effectiveMemberRole === role
                        ? 'bg-[var(--color-brand-500)]/20 text-[var(--color-fg)]'
                        : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
                    )}
                  >
                    {role === 'teacher' ? 'Docente' : 'Revisor'}
                  </button>
                ))}
              </div>
              <p className="text-xs leading-5 text-[var(--color-fg-muted)]">
                {effectiveMemberRole === 'reviewer'
                  ? 'En este curso podrá revisar y acompañar sin cambiar su rol institucional.'
                  : 'En este curso quedará como responsable académico sin cambiar su rol institucional.'}
              </p>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={pending || (!inviteEmail.trim() && !actionableMember)}
              className="w-full"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isAssigningExistingMember ? 'Asignar al curso' : 'Enviar invitación'}
            </Button>
          </form>
        </Panel>
      </div>

      {feedback ? <InlineFeedback feedback={feedback} /> : null}

      <Panel
        eyebrow="Dotación activa"
        title="Personal del curso"
        description="Esta lista muestra con claridad quién opera el curso hoy y con qué rol dentro del flujo académico."
      >
        {detail.teachers.length === 0 ? (
          <EmptyHint
            icon={Users}
            title="Sin personal asignado todavía"
            description="Selecciona una persona registrada del equipo o envía una invitación para empezar a operar el curso."
          />
        ) : (
          <div className="grid gap-3">
            {detail.teachers.map((teacher) => {
              const member = memberLookup.get(teacher.userId);
              return (
                <div
                  key={teacher.id}
                  className={cn(
                    SUBPANEL_CLASS,
                    'flex flex-col gap-4 p-4 sm:flex-row sm:items-center',
                  )}
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-brand-500)]/12 text-[var(--color-brand-200)]">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[var(--color-fg)]">
                        {teacher.name ?? teacher.email}
                      </p>
                      <Badge variant={teacher.assignmentRole === 'owner' ? 'success' : 'brand'}>
                        Curso: {COURSE_ASSIGNMENT_ROLE_LABEL[teacher.assignmentRole]}
                      </Badge>
                      {member ? (
                        <Badge variant="default">
                          Equipo:{' '}
                          {ACADEMIC_MEMBER_ROLE_LABEL[member.memberRole as AcademicMemberRole] ??
                            member.memberRole}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">{teacher.email}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!confirm('¿Quitar a esta persona del curso?')) return;
                      setFeedback(null);
                      start(async () => {
                        const res = await unassignCourseTeacherAction(courseId, teacher.id);
                        if (res.ok) {
                          setFeedback({ tone: 'success', message: 'Docente removido del curso.' });
                          router.refresh();
                        } else {
                          setFeedback({
                            tone: 'error',
                            message: res.error ?? 'No se pudo remover.',
                          });
                        }
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function StudentsTab({
  courseId,
  enrollments,
}: {
  courseId: string;
  enrollments: CourseEnrollmentList;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [openEnrollment, setOpenEnrollment] = useState<CourseEnrollment | null>(null);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStrip
          title="Inscripciones"
          body={`${enrollments.totals.enrollments} estudiante(s) activos en este curso.`}
        />
        <SummaryStrip
          title="Módulos totales"
          body={`${enrollments.totals.totalModules} paso(s) en el recorrido actual.`}
        />
        <SummaryStrip
          title="Requeridos"
          body={`${enrollments.totals.requiredModules} paso(s) cuentan para cerrar el curso.`}
        />
      </div>

      <Panel
        eyebrow="Alta manual"
        title="Inscribir estudiante"
        description="Puedes cargar alumnado por correo sin salir del workspace institucional."
      >
        <form
          action={(fd) => {
            setFeedback(null);
            start(async () => {
              const res = await enrollStudentAction(courseId, fd);
              if (res.ok) {
                setFeedback({ tone: 'success', message: 'Estudiante inscrito.' });
                router.refresh();
              } else {
                setFeedback({ tone: 'error', message: res.error ?? 'No se pudo inscribir.' });
              }
            });
          }}
          className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
        >
          <Field label="Email">
            <Input name="email" type="email" placeholder="estudiante@institucion.com" required />
          </Field>
          <Button type="submit" loading={pending}>
            <Plus className="h-4 w-4" /> Inscribir
          </Button>
        </form>
        {feedback ? <InlineFeedback feedback={feedback} /> : null}
      </Panel>

      <Panel
        eyebrow="Seguimiento"
        title="Estado del alumnado"
        description="Cada fila resume progreso, score y estado. El drawer abre el timeline por módulo con controles rápidos."
      >
        {enrollments.data.length === 0 ? (
          <EmptyHint
            icon={GraduationCap}
            title="Aún no hay estudiantes inscritos"
            description="Cuando empieces a enrolar alumnos, aquí verás el avance por persona y el score del recorrido."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[rgba(12,16,32,0.82)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Estudiante</th>
                    <th className="px-5 py-3 font-medium">Avance</th>
                    <th className="px-5 py-3 font-medium">Score</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 font-medium">Fuente</th>
                    <th className="px-5 py-3 font-medium text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {enrollments.data.map((enrollment) => {
                    const total = enrollments.totals.totalModules || 1;
                    const pct = Math.round((enrollment.completedModules / total) * 100);
                    return (
                      <tr key={enrollment.id} className="transition-colors hover:bg-white/[0.03]">
                        <td className="px-5 py-4 align-top">
                          <p className="font-medium text-[var(--color-fg)]">
                            {enrollment.studentName ??
                              enrollment.name ??
                              enrollment.studentEmail ??
                              enrollment.email}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
                            {enrollment.studentEmail ?? enrollment.email}
                          </p>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="space-y-2">
                            <div className="h-2 w-36 overflow-hidden rounded-full bg-white/[0.06]">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-brand-400),#22c55e)]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-xs text-[var(--color-fg-muted)] tabular-nums">
                              {enrollment.completedModules}/{enrollments.totals.totalModules}{' '}
                              completos · {enrollment.inProgressModules} en curso
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top font-mono text-[var(--color-fg)]">
                          {enrollment.finalScore != null ? `${enrollment.finalScore}%` : '—'}
                        </td>
                        <td className="px-5 py-4 align-top">
                          {enrollment.completedAt ? (
                            <Badge variant="success">Completado</Badge>
                          ) : enrollment.startedAt ? (
                            <Badge variant="warning">En curso</Badge>
                          ) : (
                            <Badge variant="default">Sin empezar</Badge>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <Badge variant="default">{enrollment.source}</Badge>
                        </td>
                        <td className="px-5 py-4 text-right align-top">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setOpenEnrollment(enrollment)}
                          >
                            <GitBranch className="h-3.5 w-3.5" /> Ver avance
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      {openEnrollment ? (
        <ProgressDrawer
          courseId={courseId}
          enrollment={openEnrollment}
          onClose={() => setOpenEnrollment(null)}
        />
      ) : null}
    </div>
  );
}

function ProgressDrawer({
  courseId,
  enrollment,
  onClose,
}: {
  courseId: string;
  enrollment: CourseEnrollment;
  onClose: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<EnrollmentProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [gradeConfirmation, setGradeConfirmation] = useState<{
    moduleId: string;
    moduleTitle: string;
    score: number;
    note?: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFeedback(null);

    getEnrollmentProgressAction(courseId, enrollment.id)
      .then((res) => {
        if (!alive) return;
        if (res.ok) {
          setData(res.data);
        } else {
          setFeedback({ tone: 'error', message: res.error ?? 'No se pudo cargar el avance.' });
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [courseId, enrollment.id]);

  const refresh = () => {
    getEnrollmentProgressAction(courseId, enrollment.id).then((res) => {
      if (res.ok) setData(res.data);
    });
  };

  const updateStatus = (
    moduleId: string,
    status: ModuleProgressStatus,
    score?: number,
    note?: string,
  ) => {
    setFeedback(null);
    start(async () => {
      const res = await setModuleProgressAction(
        courseId,
        enrollment.id,
        moduleId,
        status,
        score,
        note,
      );
      if (res.ok) {
        setFeedback({ tone: 'success', message: 'Avance actualizado.' });
        refresh();
        router.refresh();
      } else {
        setFeedback({ tone: 'error', message: res.error ?? 'No se pudo actualizar el módulo.' });
      }
    });
  };

  const saveModuleGrade = (
    module: EnrollmentProgress['modules'][number],
    score: number,
    note?: string,
  ) => {
    const currentNote = (module.note ?? '').trim();
    const nextNote = (note ?? '').trim();
    const hasExistingGrade = module.score != null || currentNote.length > 0;
    const changesExistingGrade =
      hasExistingGrade && (module.score !== score || currentNote !== nextNote);

    if (changesExistingGrade) {
      setGradeConfirmation({
        moduleId: module.moduleId,
        moduleTitle: module.title,
        score,
        note,
      });
      return;
    }

    updateStatus(module.moduleId, 'completed', score, note);
  };

  const completedCount =
    data?.modules.filter((module) => (module.status ?? 'not_started') === 'completed').length ?? 0;
  const inProgressCount =
    data?.modules.filter((module) => (module.status ?? 'not_started') === 'in_progress').length ??
    0;

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-[rgba(3,5,12,0.72)] backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-full overflow-y-auto border-l border-[var(--color-border)] bg-[linear-gradient(180deg,#0c1020,#090d1a)] p-4 sm:max-w-3xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex w-full flex-col">
          <header className={cn(PANEL_CLASS, 'mb-5 p-5')}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                  Avance del estudiante
                </p>
                <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-[var(--color-fg)]">
                  {enrollment.studentName ?? enrollment.name ?? enrollment.email}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-fg-subtle)]">
                  {enrollment.studentEmail ?? enrollment.email}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--color-border)] p-2 text-[var(--color-fg-subtle)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <SummaryStrip
                title="Avance"
                body={`${completedCount} cerrado(s) · ${inProgressCount} en curso.`}
              />
              <SummaryStrip
                title="Score final"
                body={
                  enrollment.finalScore != null
                    ? `${enrollment.finalScore}% actual.`
                    : 'Todavía sin consolidar.'
                }
              />
              <SummaryStrip
                title="Estado general"
                body={
                  enrollment.completedAt
                    ? 'Curso completado.'
                    : enrollment.startedAt
                      ? 'Recorrido activo.'
                      : 'Sin iniciar aún.'
                }
              />
            </div>
          </header>

          {loading ? (
            <p className="text-sm text-[var(--color-fg-muted)]">Cargando avance…</p>
          ) : null}
          {feedback ? <InlineFeedback feedback={feedback} /> : null}

          {data ? (
            <div className="relative pl-8">
              <div className="absolute left-3 top-3 bottom-3 w-px bg-gradient-to-b from-[var(--color-brand-400)]/45 via-[var(--color-border)] to-transparent" />
              <ol className="space-y-4">
                {data.modules.map((module, index) => {
                  const status = (module.status ?? 'not_started') as ModuleProgressStatus;
                  const Icon = STATUS_ICON[status];
                  const attemptsSummary = summarizeAssessmentAttempts(module);
                  return (
                    <li key={module.moduleId} className="relative">
                      <span
                        className={cn(
                          'absolute -left-[34px] top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 bg-[var(--color-bg)]',
                          status === 'completed'
                            ? 'border-emerald-400'
                            : status === 'in_progress'
                              ? 'border-amber-400'
                              : 'border-[var(--color-border-strong)]',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-3.5 w-3.5',
                            STATUS_COLOR[status],
                            status === 'in_progress' && 'animate-spin',
                          )}
                        />
                      </span>

                      <div className={cn(SUBPANEL_CLASS, 'p-4 sm:p-5')}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-[var(--color-fg-subtle)]">
                            #{String(index + 1).padStart(2, '0')}
                          </span>
                          <p className="text-base font-semibold text-[var(--color-fg)]">
                            {module.title}
                          </p>
                          <Badge variant="brand">{CONTENT_TYPE_LABEL[module.contentType]}</Badge>
                          <Badge variant={module.isRequired ? 'warning' : 'default'}>
                            {module.isRequired ? 'Obligatorio' : 'Opcional'}
                          </Badge>
                          <span className="ml-auto text-xs text-[var(--color-fg-subtle)]">
                            peso {module.weight}
                          </span>
                        </div>

                        <p className={cn('mt-2 text-xs leading-5', STATUS_COLOR[status])}>
                          {STATUS_LABEL[status]}
                          {module.score != null ? ` · score ${module.score}` : ''}
                          {module.completedAt
                            ? ` · ${new Date(module.completedAt).toLocaleDateString('es-PE')}`
                            : ''}
                        </p>

                        {attemptsSummary.total > 0 ? (
                          <>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-fg-subtle)]">
                              {attemptsSummary.started > 0 ? (
                                <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1">
                                  {attemptsSummary.started} iniciado(s)
                                </span>
                              ) : null}
                              {attemptsSummary.submitted > 0 ? (
                                <span className="rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-1 text-amber-200">
                                  {attemptsSummary.submitted} enviado(s) pendiente(s)
                                </span>
                              ) : null}
                              {attemptsSummary.graded > 0 ? (
                                <span className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-1 text-emerald-200">
                                  {attemptsSummary.graded} calificado(s)
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-3 space-y-2 rounded-xl border border-[var(--color-border)] bg-white/[0.03] p-3">
                              {module.assessments.map((assessment) => {
                                const latest = assessment.attempts[0];
                                if (!latest) return null;
                                const answerSummary = formatAttemptAnswers(latest.answers);
                                return (
                                  <div
                                    key={assessment.id}
                                    className="grid gap-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto]"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate font-medium text-[var(--color-fg)]">
                                        {assessment.title}
                                      </p>
                                      <p className="text-[var(--color-fg-subtle)]">
                                        Intento #{latest.attemptNumber}
                                        {latest.submittedAt
                                          ? ` · enviado ${new Date(latest.submittedAt).toLocaleDateString('es-PE')}`
                                          : ''}
                                      </p>
                                      {answerSummary && latest.status !== 'in_progress' ? (
                                        <p className="mt-1 line-clamp-2 text-[var(--color-fg-muted)]">
                                          Respuesta: {answerSummary}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant={
                                          latest.status === 'graded'
                                            ? 'success'
                                            : latest.status === 'submitted'
                                              ? 'warning'
                                              : 'default'
                                        }
                                      >
                                        {ATTEMPT_STATUS_LABEL[latest.status]}
                                      </Badge>
                                      {latest.score != null ? (
                                        <span className="font-mono text-[var(--color-fg-muted)]">
                                          {Math.round(latest.score)}%
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : null}

                        <ScoreInline
                          currentScore={module.score}
                          currentNote={module.note}
                          disabled={pending}
                          onSave={(score, note) => saveModuleGrade(module, score, note)}
                        />

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={status === 'in_progress' ? 'primary' : 'secondary'}
                            disabled={pending || status === 'in_progress'}
                            onClick={() => updateStatus(module.moduleId, 'in_progress')}
                          >
                            Iniciar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={status === 'completed' ? 'accent' : 'secondary'}
                            disabled={pending || status === 'completed' || module.score == null}
                            onClick={() =>
                              updateStatus(
                                module.moduleId,
                                'completed',
                                module.score ?? undefined,
                                module.note ?? undefined,
                              )
                            }
                          >
                            Completar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={pending || status === 'not_started'}
                            onClick={() => updateStatus(module.moduleId, 'not_started')}
                          >
                            Reiniciar
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-fg-subtle)]">
                <p>
                  {data.enrollment.completedAt
                    ? `Curso completado el ${new Date(data.enrollment.completedAt).toLocaleDateString('es-PE')}`
                    : data.enrollment.startedAt
                      ? `En curso desde ${new Date(data.enrollment.startedAt).toLocaleDateString('es-PE')}`
                      : 'Aún no inicia'}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!confirm('¿Cancelar la inscripción de este estudiante?')) return;
                    start(async () => {
                      const res = await removeEnrollmentAction(courseId, enrollment.id);
                      if (res.ok) {
                        onClose();
                        router.refresh();
                      } else {
                        setFeedback({
                          tone: 'error',
                          message: res.error ?? 'No se pudo cancelar la inscripción.',
                        });
                      }
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-400" /> Cancelar inscripción
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
      <GradeEditConfirmDialog
        open={Boolean(gradeConfirmation)}
        pending={pending}
        moduleTitle={gradeConfirmation?.moduleTitle ?? ''}
        onClose={() => setGradeConfirmation(null)}
        onConfirm={() => {
          if (!gradeConfirmation) return;
          const next = gradeConfirmation;
          setGradeConfirmation(null);
          updateStatus(next.moduleId, 'completed', next.score, next.note);
        }}
      />
    </div>
  );
}

function GradeEditConfirmDialog({
  open,
  pending,
  moduleTitle,
  onClose,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  moduleTitle: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="grade-edit-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,7,18,0.78)] p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border-strong)] bg-[linear-gradient(180deg,var(--color-bg-elevated),#0d1228)] p-5 shadow-[0_30px_100px_-54px_rgba(0,0,0,0.95)]">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-brand-500)]/15 text-[var(--color-brand-200)]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3
              id="grade-edit-confirm-title"
              className="text-lg font-semibold text-[var(--color-fg)]"
            >
              Confirmar edición de nota
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--color-fg-muted)]">
              Este módulo ya tenía una calificación guardada. Confirma que quieres reemplazarla.
            </p>
            {moduleTitle ? (
              <p className="mt-3 truncate rounded-xl border border-[var(--color-border)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)]">
                {moduleTitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" disabled={pending} onClick={onConfirm}>
            Guardar modificación
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScoreInline({
  currentScore,
  currentNote,
  disabled,
  onSave,
}: {
  currentScore: number | null;
  currentNote: string | null;
  disabled: boolean;
  onSave: (score: number, note?: string) => void;
}) {
  const [score, setScore] = useState<string>(currentScore != null ? String(currentScore) : '');
  const [note, setNote] = useState<string>(currentNote ?? '');

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-end">
      <div>
        <Label className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
          Score
        </Label>
        <Input
          type="number"
          min="0"
          max="100"
          value={score}
          onChange={(event) => setScore(event.target.value)}
          className="mt-1 h-10 text-sm"
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
          Nota operativa
        </Label>
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Observación opcional"
          className="mt-1 h-10 text-sm"
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled || !score}
        onClick={() => {
          const value = Number(score);
          if (!Number.isFinite(value)) return;
          onSave(Math.max(0, Math.min(100, Math.round(value))), note || undefined);
        }}
      >
        Guardar y completar
      </Button>
    </div>
  );
}

function DangerTab({ detail }: { detail: CourseDetail }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const canDelete = detail.metrics.enrollments === 0 && detail.metrics.certificatesIssued === 0;

  return (
    <div className="space-y-5">
      <Panel
        eyebrow="Riesgo controlado"
        title="Operaciones sensibles"
        description="Aquí sólo viven acciones irreversibles o de congelación operativa. El objetivo es evitar errores de administración."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <ActionCallout
            icon={Archive}
            tone="warning"
            title="Archivar curso"
            description="Congela nuevas operaciones pero conserva historial, docentes, estudiantes y certificados emitidos."
            action={
              <Button
                type="button"
                variant="secondary"
                disabled={pending || detail.course.status === 'archived'}
                onClick={() => {
                  if (!confirm('¿Archivar el curso?')) return;
                  setFeedback(null);
                  start(async () => {
                    const res = await archiveCourseAction(detail.course.id);
                    if (res.ok) {
                      setFeedback({ tone: 'success', message: 'Curso archivado.' });
                      router.refresh();
                    } else {
                      setFeedback({ tone: 'error', message: res.error ?? 'No se pudo archivar.' });
                    }
                  });
                }}
              >
                Archivar
              </Button>
            }
          />

          <ActionCallout
            icon={Trash2}
            tone="danger"
            title="Eliminar curso"
            description={
              canDelete
                ? 'Elimina definitivamente el curso y su estructura. Sólo se permite cuando no hay alumnos ni certificados ligados.'
                : 'Bloqueado porque aún existen estudiantes inscritos o certificados emitidos. En este caso debes archivar.'
            }
            action={
              <Button
                type="button"
                variant="danger"
                disabled={!canDelete || pending}
                onClick={() => {
                  if (!confirm('¿Eliminar permanentemente este curso?')) return;
                  setFeedback(null);
                  start(async () => {
                    const res = await deleteCourseAction(detail.course.id);
                    if (res.ok) {
                      router.push('/institution/courses');
                    } else {
                      setFeedback({ tone: 'error', message: res.error ?? 'No se pudo eliminar.' });
                    }
                  });
                }}
              >
                Eliminar
              </Button>
            }
          />
        </div>
        {feedback ? <InlineFeedback feedback={feedback} /> : null}
      </Panel>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  action,
  children,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={cn(PANEL_CLASS, compact ? 'p-5' : 'p-5 sm:p-6')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-[20px] font-semibold tracking-tight text-[var(--color-fg)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-6 text-[var(--color-fg-muted)]">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          {label}
        </Label>
        {help ? <p className="text-xs leading-5 text-[var(--color-fg-subtle)]">{help}</p> : null}
      </div>
      {children}
    </div>
  );
}

function SummaryStrip({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[rgba(9,12,26,0.6)] px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-6 text-[var(--color-fg-muted)]">{body}</p>
    </div>
  );
}

function ToggleCard({
  title,
  description,
  active,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition-all duration-150',
        active
          ? 'border-[var(--color-brand-500)]/50 bg-[var(--color-brand-500)]/10'
          : 'border-[var(--color-border)] bg-white/[0.02] hover:border-[var(--color-border-strong)] hover:bg-white/[0.04]',
      )}
    >
      <p className="font-medium text-[var(--color-fg)]">{title}</p>
      <p className="mt-1.5 text-xs leading-5 text-[var(--color-fg-muted)]">{description}</p>
    </button>
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
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs',
        tone === 'success'
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
          : tone === 'brand'
            ? 'border-[var(--color-brand-500)]/30 bg-[var(--color-brand-500)]/10 text-[var(--color-brand-200)]'
            : 'border-[var(--color-border)] bg-white/[0.03] text-[var(--color-fg-muted)]',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

function EmptyHint({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white/[0.02] px-5 py-10 text-center">
      <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-200)]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-[var(--color-fg)]">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-[54ch] text-sm leading-6 text-[var(--color-fg-muted)]">
        {description}
      </p>
    </div>
  );
}

function InlineFeedback({ feedback }: { feedback: FeedbackState }) {
  if (!feedback) return null;
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm',
        feedback.tone === 'success'
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
          : 'border-red-500/25 bg-red-500/10 text-red-200',
      )}
    >
      {feedback.message}
    </div>
  );
}

function ActionCallout({
  icon: Icon,
  tone,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  tone: 'warning' | 'danger';
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-5',
        tone === 'warning'
          ? 'border-amber-500/25 bg-amber-500/7'
          : 'border-red-500/25 bg-red-500/7',
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div
          className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-2xl border',
            tone === 'warning'
              ? 'border-amber-500/25 bg-amber-500/12 text-amber-200'
              : 'border-red-500/25 bg-red-500/12 text-red-200',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--color-fg)]">{title}</p>
          <p className="mt-1.5 text-sm leading-6 text-[var(--color-fg-muted)]">{description}</p>
        </div>
        <div className="flex items-center">{action}</div>
      </div>
    </div>
  );
}
