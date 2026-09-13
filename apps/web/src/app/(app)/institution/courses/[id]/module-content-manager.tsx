'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Paperclip,
  FileVideo,
  Image as ImageIcon,
  Lock,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type {
  AssessmentRow,
  AssessmentQuestionRow,
  AssessmentType,
  TopicRow,
} from '@/lib/api/endpoints/me';
import {
  createAssessmentAction,
  createQuestionAction,
  createTopicAction,
  deleteAssessmentAction,
  deleteQuestionAction,
  deleteTopicAction,
  deleteTopicMaterialAction,
  updateAssessmentAction,
  updateTopicAction,
  uploadTopicMaterialAction,
} from '../../actions';

const TEXTAREA =
  'w-full rounded-xl border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-brand-400)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-brand-500),transparent_60%)]';

const ASSESSMENT_TYPE_LABEL: Record<AssessmentType, string> = {
  multiple_choice: 'Selección múltiple',
  true_false: 'Verdadero / Falso',
  essay: 'Ensayo (manual)',
};

const ASSESSMENT_TYPE_HELP: Record<AssessmentType, string> = {
  multiple_choice: 'Una opción correcta. Se autocalifica al instante.',
  true_false: 'Una afirmación, respuesta verdadero o falso. Autocalifica.',
  essay: 'Respuesta abierta. Requiere calificación manual del docente.',
};

const ASSESSMENT_FORM_META: Record<
  AssessmentType,
  { title: string; description: string; titlePlaceholder: string; descriptionPlaceholder: string }
> = {
  multiple_choice: {
    title: 'Quiz de selección múltiple',
    description:
      'Configura la evaluación autocalificable. Después agrega preguntas con opciones y marca la respuesta correcta.',
    titlePlaceholder: 'Ej. Quiz de conceptos clave',
    descriptionPlaceholder: 'Instrucciones, criterios y tiempo sugerido para responder.',
  },
  true_false: {
    title: 'Evaluación verdadero / falso',
    description:
      'Pensada para validaciones rápidas. Después agrega afirmaciones y define si cada una es verdadera o falsa.',
    titlePlaceholder: 'Ej. Verificación rápida del módulo',
    descriptionPlaceholder: 'Instrucciones breves para responder las afirmaciones.',
  },
  essay: {
    title: 'Ensayo o entrega manual',
    description:
      'Úsalo para respuestas abiertas, evidencias o entregables revisados por un docente. No se autocalifica.',
    titlePlaceholder: 'Ej. Ensayo final o entrega práctica',
    descriptionPlaceholder: 'Consigna, formato de entrega y criterios de revisión.',
  },
};

interface Props {
  courseId: string;
  moduleId: string;
  topics: TopicRow[];
  assessments: AssessmentRow[];
  questionsByAssessment: Record<string, AssessmentQuestionRow[]>;
  accessMode?: 'institution' | 'teacher';
}

type Feedback = { tone: 'success' | 'error'; message: string } | null;

export function ModuleContentManager({
  courseId,
  moduleId,
  topics,
  assessments,
  questionsByAssessment,
  accessMode = 'institution',
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  /** Temario cuyo panel de material está abierto. Uno a la vez: son formularios
   *  con archivos y tener varios abiertos invita a subir en el equivocado. */
  const [materialTopicId, setMaterialTopicId] = useState<string | null>(null);
  const [creatingAssessmentType, setCreatingAssessmentType] = useState<AssessmentType | null>(null);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [openAssessmentId, setOpenAssessmentId] = useState<string | null>(null);
  const canManageStructure = accessMode === 'institution';

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setFeedback(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setFeedback({ tone: 'success', message: success });
        router.refresh();
      } else {
        setFeedback({ tone: 'error', message: res.error ?? 'Operación fallida.' });
      }
    });
  };

  return (
    <div className="border-t border-[var(--color-border)] bg-[rgba(8,11,22,0.55)] px-5 py-5 space-y-6">
      {feedback ? (
        <div
          className={cn(
            'rounded-xl border px-3 py-2 text-xs',
            feedback.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200',
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {/* Temarios */}
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-fg)]">Temarios</h4>
            <p className="text-xs text-[var(--color-fg-subtle)]">
              Divide el módulo en secciones de contenido. Cada temario se muestra al estudiante en
              orden.
            </p>
          </div>
          {canManageStructure ? (
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => setCreatingTopic((v) => !v)}
            >
              <Plus className="h-3.5 w-3.5" />
              {creatingTopic ? 'Cerrar' : 'Nuevo temario'}
            </Button>
          ) : null}
        </header>

        {creatingTopic && canManageStructure ? (
          <TopicForm
            mode="create"
            onCancel={() => setCreatingTopic(false)}
            onSubmit={(fd) =>
              run(async () => {
                const res = await createTopicAction(courseId, moduleId, fd);
                if (res.ok) setCreatingTopic(false);
                return res;
              }, 'Temario creado.')
            }
            pending={pending}
          />
        ) : null}

        {topics.length === 0 && !creatingTopic ? (
          <p className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-4 text-xs text-[var(--color-fg-subtle)]">
            {canManageStructure
              ? 'Aún no hay temarios. Crea al menos uno para organizar el contenido del módulo.'
              : 'Aún no hay temarios definidos por la institución para este módulo.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {topics.map((topic, idx) => {
              const isEditing = editingTopicId === topic.id;
              const text = (topic.content as { text?: string } | null)?.text;
              return (
                <li
                  key={topic.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.7)]"
                >
                  {isEditing ? (
                    <div className="p-3">
                      <TopicForm
                        mode="edit"
                        initial={topic}
                        onCancel={() => setEditingTopicId(null)}
                        onSubmit={(fd) =>
                          run(async () => {
                            const res = await updateTopicAction(courseId, topic.id, fd);
                            if (res.ok) setEditingTopicId(null);
                            return res;
                          }, 'Temario actualizado.')
                        }
                        pending={pending}
                      />
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-brand-500)]/10 font-mono text-[10px] text-[var(--color-brand-200)]">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                          {topic.title}
                        </p>
                        {topic.description ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-fg-muted)]">
                            {topic.description}
                          </p>
                        ) : null}
                        {text ? (
                          <p className="mt-1 line-clamp-2 text-xs text-[var(--color-fg-subtle)]">
                            {text}
                          </p>
                        ) : null}
                      </div>
                      {canManageStructure ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() =>
                              setMaterialTopicId((v) => (v === topic.id ? null : topic.id))
                            }
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Material
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => setEditingTopicId(topic.id)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => {
                              if (!confirm('¿Eliminar este temario?')) return;
                              run(
                                () => deleteTopicAction(courseId, topic.id),
                                'Temario eliminado.',
                              );
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* El material vive bajo su temario, desplegable: es donde
                      se sube el vídeo de la clase y la portada que ve quien
                      todavía no tiene la membresía. */}
                  {materialTopicId === topic.id && canManageStructure ? (
                    <TopicMaterialPanel
                      topic={topic}
                      pending={pending}
                      onUpload={(fd) =>
                        run(
                          async () => {
                            const res = await uploadTopicMaterialAction(courseId, topic.id, fd);
                            if (res.ok) setMaterialTopicId(null);
                            return res;
                          },
                          'Material subido.',
                        )
                      }
                      onRemove={() =>
                        run(
                          () => deleteTopicMaterialAction(courseId, topic.id),
                          'Material quitado.',
                        )
                      }
                      onClose={() => setMaterialTopicId(null)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Evaluaciones */}
      <section className="space-y-3">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-fg)]">Evaluaciones</h4>
            <p className="text-xs text-[var(--color-fg-subtle)]">
              Crea evaluaciones por temario o para todo el módulo. Las de selección múltiple y
              verdadero/falso se autocalifican.
            </p>
          </div>
        </header>

        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(ASSESSMENT_TYPE_LABEL) as AssessmentType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setCreatingAssessmentType(type)}
              className={cn(
                'rounded-xl border px-3 py-2.5 text-left transition-colors',
                creatingAssessmentType === type
                  ? 'border-[var(--color-brand-500)]/60 bg-[var(--color-brand-500)]/10'
                  : 'border-[var(--color-border)] bg-white/[0.02] hover:border-[var(--color-border-strong)]',
              )}
            >
              <p className="text-xs font-medium text-[var(--color-fg)]">
                {ASSESSMENT_TYPE_LABEL[type]}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-[var(--color-fg-muted)]">
                {ASSESSMENT_TYPE_HELP[type]}
              </p>
            </button>
          ))}
        </div>

        {creatingAssessmentType ? (
          <AssessmentForm
            mode="create"
            type={creatingAssessmentType}
            topics={topics}
            onCancel={() => setCreatingAssessmentType(null)}
            onSubmit={(fd) =>
              run(async () => {
                const res = await createAssessmentAction(courseId, moduleId, fd);
                if (res.ok) setCreatingAssessmentType(null);
                return res;
              }, 'Evaluación creada.')
            }
            pending={pending}
          />
        ) : null}

        {assessments.length === 0 && !creatingAssessmentType ? (
          <p className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-4 text-xs text-[var(--color-fg-subtle)]">
            Aún no hay evaluaciones. Selecciona un tipo arriba para crear la primera.
          </p>
        ) : (
          <ul className="space-y-2">
            {assessments.map((a) => {
              const isEditing = editingAssessmentId === a.id;
              const isOpen = openAssessmentId === a.id;
              const questions = questionsByAssessment[a.id] ?? [];
              const linkedTopic = a.topicId ? topics.find((t) => t.id === a.topicId) : null;
              return (
                <li
                  key={a.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.7)]"
                >
                  {isEditing ? (
                    <div className="p-3">
                      <AssessmentForm
                        mode="edit"
                        type={a.type}
                        topics={topics}
                        initial={a}
                        onCancel={() => setEditingAssessmentId(null)}
                        onSubmit={(fd) =>
                          run(async () => {
                            const res = await updateAssessmentAction(courseId, a.id, fd);
                            if (res.ok) setEditingAssessmentId(null);
                            return res;
                          }, 'Evaluación actualizada.')
                        }
                        pending={pending}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 p-3">
                        <button
                          type="button"
                          onClick={() => setOpenAssessmentId(isOpen ? null : a.id)}
                          className="mt-0.5 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
                          aria-label={isOpen ? 'Colapsar' : 'Expandir'}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                              {a.title}
                            </p>
                            <Badge variant="brand">{ASSESSMENT_TYPE_LABEL[a.type]}</Badge>
                            <Badge variant="default">Peso {a.weight}</Badge>
                            <Badge variant="default">Aprueba {a.passingScore}%</Badge>
                            {linkedTopic ? (
                              <span className="text-[11px] text-[var(--color-fg-subtle)]">
                                · Temario: {linkedTopic.title}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[var(--color-fg-subtle)]">
                                · Alcance: módulo
                              </span>
                            )}
                          </div>
                          {a.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-[var(--color-fg-muted)]">
                              {a.description}
                            </p>
                          ) : null}
                          {a.type !== 'essay' ? (
                            <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)] tabular-nums">
                              {questions.length} pregunta(s)
                            </p>
                          ) : null}
                        </div>
                        {canManageStructure ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              onClick={() => setEditingAssessmentId(a.id)}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              onClick={() => {
                                if (!confirm('¿Eliminar esta evaluación y todos sus intentos?'))
                                  return;
                                run(
                                  () => deleteAssessmentAction(courseId, a.id),
                                  'Evaluación eliminada.',
                                );
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {isOpen && a.type !== 'essay' ? (
                        <QuestionsEditor
                          courseId={courseId}
                          assessment={a}
                          questions={questions}
                          onMutated={() => router.refresh()}
                          run={run}
                          pending={pending}
                          canDeleteQuestions={canManageStructure}
                        />
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Material de un temario: el archivo de la clase y su portada.
 *
 * Hasta ahora la API aceptaba material y ninguna pantalla podía enviarlo: el
 * formulario de temario sólo ofrecía texto. Sin subida no hay portada, sin
 * portada no hay muro de pago, y la previsualización del material bloqueado
 * —lo que decide una compra— quedaba inalcanzable.
 *
 * La portada se pide junto al archivo y no después, porque es lo único que ve
 * quien todavía no tiene llave: un temario con vídeo y sin portada aparece
 * vacío en el curso. Para un PDF es opcional de verdad, porque el servidor la
 * deriva de su primera página.
 */
function TopicMaterialPanel({
  topic,
  pending,
  onUpload,
  onRemove,
  onClose,
}: {
  topic: TopicRow;
  pending: boolean;
  onUpload: (fd: FormData) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [material, setMaterial] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasMaterial = Boolean(topic.assetKey ?? topic.hasMaterial);
  const hasCover = Boolean(topic.coverKey ?? topic.hasCover);

  // Un PDF no necesita portada: el servidor la saca de su primera página. Un
  // vídeo o un audio sí, y avisarlo aquí evita una subida que el servidor
  // rechazaría después de transferir los megas.
  const isDocument = material?.type === 'application/pdf';
  const needsCover = Boolean(material) && !isDocument && !cover;

  function submit(fd: FormData) {
    if (!material) {
      setError('Elegí el archivo del material.');
      return;
    }
    if (needsCover) {
      setError('Subí una portada: es lo único que ve quien todavía no tiene la membresía.');
      return;
    }
    setError(null);
    onUpload(fd);
  }

  return (
    <form
      action={submit}
      className="space-y-3 border-t border-[var(--color-border)] bg-[rgba(10,14,28,0.6)] p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-fg)]">
          <Paperclip className="h-3.5 w-3.5 text-[var(--color-brand-300)]" />
          Material del temario
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--color-border)] p-1.5 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Estado actual: sin esto, el creador no sabe si ya subió algo y
          acabaría subiéndolo dos veces. */}
      {hasMaterial ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-accent-500)]/25 bg-[var(--color-accent-500)]/[0.06] px-3 py-2">
          <FileVideo className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent-400)]" />
          <span className="text-[11.5px] text-[var(--color-fg-muted)]">
            Ya tiene material{hasCover ? ' y portada' : ' — sin portada'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            className="ml-auto"
            onClick={() => {
              if (!confirm('¿Quitar el material de este temario?')) return;
              onRemove();
            }}
          >
            Quitar
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="text-[11px] text-[var(--color-fg-subtle)]">
            Archivo · vídeo, audio o PDF
          </label>
          <input
            type="file"
            name="material"
            accept="video/*,audio/*,application/pdf"
            required
            onChange={(e) => {
              setMaterial(e.target.files?.[0] ?? null);
              setError(null);
            }}
            className={FILE_INPUT}
          />
        </div>

        <div className="grid gap-1.5">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-subtle)]">
            <ImageIcon className="h-3 w-3" />
            Portada {isDocument ? '· opcional en un PDF' : ''}
          </label>
          <input
            type="file"
            name="cover"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => {
              setCover(e.target.files?.[0] ?? null);
              setError(null);
            }}
            className={FILE_INPUT}
          />
        </div>
      </div>

      <div className="grid gap-1.5 sm:max-w-[220px]">
        <label className="text-[11px] text-[var(--color-fg-subtle)]">
          Duración en segundos (opcional)
        </label>
        <Input name="durationSeconds" type="number" min={1} placeholder="760" />
      </div>

      {/* Por qué se pide la portada. Sin esta línea parece un trámite más. */}
      <p className="flex items-start gap-1.5 rounded-xl border border-[var(--color-border)] bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" />
        La portada se guarda en dos versiones: nítida para quien tiene la membresía y difuminada en
        el servidor para quien no. El archivo completo nunca sale sin permiso.
      </p>

      {error ? <p className="text-[11.5px] text-[var(--color-danger-500)]">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pending || !material}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Subir material
        </Button>
      </div>
    </form>
  );
}

const FILE_INPUT =
  'w-full rounded-xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[11.5px] text-[var(--color-fg-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-brand-500)]/15 file:px-3 file:py-1.5 file:text-[11.5px] file:font-medium file:text-[var(--color-brand-200)] hover:file:bg-[var(--color-brand-500)]/25';

function TopicForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  pending,
}: {
  mode: 'create' | 'edit';
  initial?: TopicRow;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const text = (initial?.content as { text?: string } | null)?.text ?? '';
  return (
    <form
      action={onSubmit}
      className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[rgba(12,16,32,0.78)] p-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--color-fg)]">
          {mode === 'create' ? 'Nuevo temario' : 'Editar temario'}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--color-border)] p-1.5 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <Input
        name="title"
        placeholder="Título del temario"
        defaultValue={initial?.title ?? ''}
        required
        minLength={2}
      />
      <Input
        name="description"
        placeholder="Descripción corta (opcional)"
        defaultValue={initial?.description ?? ''}
      />
      <textarea
        name="content"
        placeholder="Contenido del temario (texto, instrucciones, links…)"
        defaultValue={text}
        rows={4}
        className={TEXTAREA}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          {mode === 'create' ? 'Crear' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}

function AssessmentForm({
  mode,
  type,
  topics,
  initial,
  onSubmit,
  onCancel,
  pending,
}: {
  mode: 'create' | 'edit';
  type: AssessmentType;
  topics: TopicRow[];
  initial?: AssessmentRow;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [topicId, setTopicId] = useState<string>(initial?.topicId ?? '');
  const meta = ASSESSMENT_FORM_META[type];
  const isAutoGraded = type !== 'essay';
  return (
    <form
      action={onSubmit}
      className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[rgba(12,16,32,0.78)] p-3"
    >
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="topicId" value={topicId} />
      {!isAutoGraded ? (
        <input type="hidden" name="passingScore" value={initial?.passingScore ?? 60} />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--color-fg)]">
            {mode === 'create' ? meta.title : `Editar · ${ASSESSMENT_TYPE_LABEL[type]}`}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--color-fg-subtle)]">
            {meta.description}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-lg border border-[var(--color-border)] p-1.5 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
        <Input
          name="title"
          placeholder={meta.titlePlaceholder}
          defaultValue={initial?.title ?? ''}
          required
          minLength={2}
        />
        <label className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
          Peso módulo
          <Input
            name="weight"
            type="number"
            min="0"
            max="100"
            defaultValue={initial?.weight ?? 0}
          />
        </label>
      </div>
      <textarea
        name="description"
        placeholder={meta.descriptionPlaceholder}
        defaultValue={initial?.description ?? ''}
        rows={type === 'essay' ? 4 : 3}
        className={TEXTAREA}
      />

      {mode === 'create' ? (
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
            Alcance
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTopicId('')}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs',
                topicId === ''
                  ? 'border-[var(--color-brand-500)]/60 bg-[var(--color-brand-500)]/10 text-[var(--color-fg)]'
                  : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]',
              )}
            >
              Todo el módulo
            </button>
            {topics.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopicId(t.id)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs',
                  topicId === t.id
                    ? 'border-[var(--color-brand-500)]/60 bg-[var(--color-brand-500)]/10 text-[var(--color-fg)]'
                    : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]',
                )}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'grid gap-3',
          isAutoGraded ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3',
        )}
      >
        <label className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
          Puntaje máximo
          <Input
            name="maxScore"
            type="number"
            min="1"
            max="1000"
            defaultValue={initial?.maxScore ?? 100}
          />
        </label>
        {isAutoGraded ? (
          <label className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
            Aprueba (%)
            <Input
              name="passingScore"
              type="number"
              min="0"
              max="100"
              defaultValue={initial?.passingScore ?? 60}
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
          Intentos permitidos
          <Input
            name="attemptsAllowed"
            type="number"
            min="1"
            max="10"
            defaultValue={initial?.attemptsAllowed ?? 1}
          />
        </label>
        {isAutoGraded ? (
          <label className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
            Tiempo límite (min)
            <Input
              name="timeLimitMin"
              type="number"
              min="1"
              max="600"
              placeholder="Sin límite"
              defaultValue={initial?.timeLimitMin ?? ''}
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
            Entrega
            <span className="flex min-h-10 items-center rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-3 text-xs text-[var(--color-fg-subtle)]">
              Revisión manual
            </span>
          </label>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] pt-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          {mode === 'create' ? 'Crear evaluación' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}

function QuestionsEditor({
  courseId,
  assessment,
  questions,
  run,
  pending,
  canDeleteQuestions,
}: {
  courseId: string;
  assessment: AssessmentRow;
  questions: AssessmentQuestionRow[];
  onMutated: () => void;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => void;
  pending: boolean;
  canDeleteQuestions: boolean;
}) {
  const isMC = assessment.type === 'multiple_choice';
  const [adding, setAdding] = useState(false);
  return (
    <div className="border-t border-[var(--color-border)] bg-[rgba(8,11,22,0.4)] px-3 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--color-fg)]">Preguntas</p>
        <Button size="sm" variant="secondary" type="button" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
          {adding ? 'Cerrar' : 'Añadir'}
        </Button>
      </div>

      {adding ? (
        <QuestionForm
          isMC={isMC}
          onCancel={() => setAdding(false)}
          onSubmit={(payload) =>
            run(async () => {
              const res = await createQuestionAction(courseId, assessment.id, payload);
              if (res.ok) setAdding(false);
              return res;
            }, 'Pregunta creada.')
          }
          pending={pending}
        />
      ) : null}

      {questions.length === 0 && !adding ? (
        <p className="text-[11px] text-[var(--color-fg-subtle)]">
          Esta evaluación no tiene preguntas todavía. Sin preguntas no se puede autocalificar.
        </p>
      ) : (
        <ul className="space-y-2">
          {questions.map((q, idx) => (
            <li
              key={q.id}
              className="rounded-lg border border-[var(--color-border)] bg-[rgba(14,18,36,0.55)] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono text-[var(--color-fg-subtle)]">
                    P{idx + 1} · {q.points} pts
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-fg)]">{q.prompt}</p>
                  {q.kind === 'single' && q.options ? (
                    <ul className="mt-2 space-y-1 text-xs">
                      {q.options.map((opt) => (
                        <li
                          key={opt.id}
                          className={cn(
                            'flex items-center gap-2 rounded px-2 py-1',
                            opt.id === q.correctAnswer
                              ? 'bg-emerald-500/10 text-emerald-200'
                              : 'text-[var(--color-fg-muted)]',
                          )}
                        >
                          <span className="font-mono">{opt.id}.</span>
                          <span>{opt.label}</span>
                          {opt.id === q.correctAnswer ? (
                            <span className="ml-auto text-[10px]">correcta</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {q.kind === 'boolean' ? (
                    <p className="mt-1 text-xs text-emerald-200">
                      Respuesta correcta:{' '}
                      {String(q.correctAnswer) === 'true' ? 'Verdadero' : 'Falso'}
                    </p>
                  ) : null}
                </div>
                {canDeleteQuestions ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      if (!confirm('¿Eliminar esta pregunta?')) return;
                      run(() => deleteQuestionAction(courseId, q.id), 'Pregunta eliminada.');
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionForm({
  isMC,
  onSubmit,
  onCancel,
  pending,
}: {
  isMC: boolean;
  onSubmit: (payload: {
    prompt: string;
    kind: 'single' | 'boolean';
    options?: Array<{ id: string; label: string }>;
    correctAnswer?: unknown;
    points: number;
  }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [prompt, setPrompt] = useState('');
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([
    { id: 'a', label: '' },
    { id: 'b', label: '' },
  ]);
  const [correct, setCorrect] = useState<string>('a');
  const [boolAnswer, setBoolAnswer] = useState<'true' | 'false'>('true');

  const updateOption = (idx: number, label: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, label } : o)));
  };
  const addOption = () => {
    const nextLetter = String.fromCharCode(97 + options.length);
    setOptions((prev) => [...prev, { id: nextLetter, label: '' }]);
  };
  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length < 2) return;
    if (isMC) {
      const cleaned = options
        .map((o) => ({ id: o.id, label: o.label.trim() }))
        .filter((o) => o.label.length > 0);
      if (cleaned.length < 2) return;
      const correctOption = cleaned.find((o) => o.id === correct) ?? cleaned[0];
      onSubmit({
        prompt: prompt.trim(),
        kind: 'single',
        options: cleaned,
        correctAnswer: correctOption?.id ?? cleaned[0]?.id,
        points,
      });
    } else {
      onSubmit({
        prompt: prompt.trim(),
        kind: 'boolean',
        correctAnswer: boolAnswer === 'true',
        points,
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[rgba(12,16,32,0.78)] p-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--color-fg)]">Nueva pregunta</p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--color-border)] p-1.5 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enunciado de la pregunta"
        rows={2}
        className={TEXTAREA}
        required
      />

      {isMC ? (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
            Opciones
          </p>
          {options.map((opt, idx) => (
            <div key={opt.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCorrect(opt.id)}
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-full border text-xs font-mono',
                  correct === opt.id
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-[var(--color-border)] text-[var(--color-fg-subtle)] hover:border-[var(--color-border-strong)]',
                )}
                title={correct === opt.id ? 'Correcta' : 'Marcar como correcta'}
              >
                {opt.id}
              </button>
              <Input
                value={opt.label}
                onChange={(e) => updateOption(idx, e.target.value)}
                placeholder={`Opción ${opt.id.toUpperCase()}`}
              />
              <Button
                size="sm"
                variant="ghost"
                type="button"
                disabled={options.length <= 2}
                onClick={() => removeOption(idx)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" type="button" onClick={addOption}>
            <Plus className="h-3.5 w-3.5" /> Agregar opción
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          {(['true', 'false'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setBoolAnswer(v)}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs',
                boolAnswer === v
                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                  : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]',
              )}
            >
              {v === 'true' ? 'Verdadero' : 'Falso'}
            </button>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
        Puntos
        <Input
          type="number"
          min={1}
          max={100}
          value={points}
          onChange={(e) => setPoints(Math.max(1, Number(e.target.value) || 1))}
          className="w-24"
        />
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          Crear pregunta
        </Button>
      </div>
    </form>
  );
}
