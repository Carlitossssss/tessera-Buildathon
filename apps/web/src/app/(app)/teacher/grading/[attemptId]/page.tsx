import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { meApi } from '@/lib/api/endpoints/me';
import { requireSession, safeFetch, formatDateTime, relativeTime } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ attemptId: string }>;
}

function renderAnswer(value: unknown, kind: string) {
  if (value == null || value === '') {
    return <p className="text-[12.5px] italic text-[var(--color-fg-subtle)]">Sin respuesta</p>;
  }
  if (kind === 'text') {
    return (
      <pre className="whitespace-pre-wrap rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-4 py-3 font-sans text-[13.5px] leading-relaxed text-[var(--color-fg)]">
        {String(value)}
      </pre>
    );
  }
  if (kind === 'boolean') {
    const truthy = value === true || value === 'true';
    return <Badge variant={truthy ? 'success' : 'warning'}>{truthy ? 'Verdadero' : 'Falso'}</Badge>;
  }
  if (kind === 'single') {
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((v, i) => (
            <Badge key={i} variant="brand">
              {String(v)}
            </Badge>
          ))}
        </div>
      );
    }
    return <Badge variant="brand">{String(value)}</Badge>;
  }
  return (
    <code className="block rounded-lg bg-white/[0.04] px-2 py-1 text-[12.5px] text-[var(--color-fg)]">
      {JSON.stringify(value)}
    </code>
  );
}

function renderCorrect(value: unknown, kind: string) {
  if (value == null) return null;
  return (
    <div className="mt-3 space-y-1">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        Respuesta correcta
      </p>
      <div className="text-[12.5px] text-[var(--color-fg-muted)]">
        {kind === 'boolean' ? (
          <Badge variant="success">{value ? 'Verdadero' : 'Falso'}</Badge>
        ) : Array.isArray(value) ? (
          <div className="flex flex-wrap gap-2">
            {value.map((v, i) => (
              <Badge key={i} variant="success">
                {String(v)}
              </Badge>
            ))}
          </div>
        ) : (
          <Badge variant="success">{String(value)}</Badge>
        )}
      </div>
    </div>
  );
}

export default async function TeacherAttemptDetailPage({ params }: PageProps) {
  const { attemptId } = await params;
  const { token } = await requireSession();
  const res = await safeFetch(() => meApi.teacherAttempt(token, attemptId));
  if (!res) notFound();
  const d = res.data;

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/teacher/grading"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a la cola
        </Link>
      </div>

      <header className="grid gap-8 lg:grid-cols-[2fr_1fr] lg:items-start">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">{d.assessment.type}</Badge>
            <Badge
              variant={
                d.attempt.status === 'graded'
                  ? 'success'
                  : d.attempt.status === 'submitted'
                    ? 'warning'
                    : 'default'
              }
            >
              {d.attempt.status}
            </Badge>
            <span className="text-[12px] text-[var(--color-fg-subtle)]">
              intento #{d.attempt.attemptNumber}
            </span>
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]">
            {d.assessment.title}
          </h1>
          <p className="text-[13.5px] text-[var(--color-fg-muted)]">
            {d.module.title} · {d.course?.title ?? '—'}
          </p>
          {d.assessment.description ? (
            <p className="max-w-2xl whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--color-fg-muted)]">
              {d.assessment.description}
            </p>
          ) : null}
        </div>

        <aside className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
              Estudiante
            </p>
            <p className="text-[14px] font-medium text-[var(--color-fg)]">
              {d.enrollment?.name ?? d.enrollment?.email ?? 'Estudiante'}
            </p>
            {d.enrollment?.email ? (
              <p className="text-[12px] text-[var(--color-fg-muted)]">{d.enrollment.email}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-3 text-[12.5px]">
            <div>
              <p className="text-[10.5px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                Enviado
              </p>
              <p className="text-[var(--color-fg)]">{formatDateTime(d.attempt.submittedAt)}</p>
              <p className="text-[var(--color-fg-subtle)]">{relativeTime(d.attempt.submittedAt)}</p>
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                Calificado
              </p>
              <p className="text-[var(--color-fg)]">
                {d.attempt.gradedAt ? formatDateTime(d.attempt.gradedAt) : '—'}
              </p>
              <p className="text-[var(--color-fg-subtle)]">
                {d.attempt.gradedAt ? relativeTime(d.attempt.gradedAt) : ''}
              </p>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)] pt-3 text-[12.5px]">
            <p className="text-[10.5px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              Configuración
            </p>
            <p className="text-[var(--color-fg-muted)]">
              Máx. {d.assessment.maxScore} · aprobación {d.assessment.passingScore} · peso{' '}
              {d.assessment.weight}
            </p>
          </div>
        </aside>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {/* Preguntas + respuestas */}
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[var(--color-brand-300)]" />
            <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
              Respuestas del estudiante
            </h2>
            <span className="text-[12px] text-[var(--color-fg-subtle)]">
              · {d.questions.length} pregunta{d.questions.length === 1 ? '' : 's'}
            </span>
          </div>
          {d.questions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white/[0.015] px-5 py-8 text-center text-[13px] text-[var(--color-fg-muted)]">
              Esta evaluación no tiene preguntas registradas.
            </p>
          ) : (
            <ol className="space-y-4">
              {d.questions
                .slice()
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((q, idx) => (
                  <li
                    key={q.id}
                    className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-white/[0.015] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                          Pregunta {idx + 1} · {q.kind} · {q.points} pt
                          {q.points === 1 ? '' : 's'}
                        </p>
                        <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-fg)]">
                          {q.prompt}
                        </p>
                      </div>
                    </div>
                    {q.options?.length ? (
                      <ul className="grid gap-1.5 text-[12.5px] text-[var(--color-fg-muted)]">
                        {q.options.map((opt, i) => (
                          <li
                            key={opt.id ?? i}
                            className="rounded-md border border-[var(--color-border)] bg-white/[0.02] px-2.5 py-1.5"
                          >
                            <span className="mr-2 text-[var(--color-fg-subtle)]">{i + 1}.</span>
                            {opt.label}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div>
                      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                        Respuesta del estudiante
                      </p>
                      <div className="mt-1.5">{renderAnswer(q.studentAnswer, q.kind)}</div>
                    </div>
                    {renderCorrect(q.correctAnswer, q.kind)}
                  </li>
                ))}
            </ol>
          )}
        </section>

        {/* Panel de lectura + historial */}
        <aside className="space-y-6 lg:sticky lg:top-6">
          <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
            <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
              Calificación institucional
            </h3>
            <p className="mt-1 text-[12.5px] text-[var(--color-fg-muted)]">
              Sólo la institución puede editar notas. Desde este panel docente la entrega queda en
              modo lectura.
            </p>
            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-4 text-sm text-[var(--color-fg-muted)]">
              <p>
                Nota actual:{' '}
                <span className="font-mono text-[var(--color-fg)]">
                  {d.attempt.score != null ? `${d.attempt.score} / ${d.assessment.maxScore}` : '—'}
                </span>
              </p>
              {d.attempt.feedback ? (
                <p className="mt-2 text-[12.5px]">Retroalimentación: {d.attempt.feedback}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
            <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
              Historial de intentos
            </h3>
            <ul className="mt-3 space-y-2">
              {d.history.map((h) => (
                <li
                  key={h.id}
                  className={
                    'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[12.5px] ' +
                    (h.id === d.attempt.id
                      ? 'border-[var(--color-brand-400)]/50 bg-[var(--color-brand-500)]/10'
                      : 'border-[var(--color-border)] bg-white/[0.015]')
                  }
                >
                  <span className="font-medium text-[var(--color-fg)]">
                    Intento #{h.attemptNumber}
                  </span>
                  <span className="text-[var(--color-fg-muted)]">
                    {h.status === 'graded' && h.score != null
                      ? `${h.score} / ${d.assessment.maxScore}`
                      : h.status}
                  </span>
                  <span className="text-[var(--color-fg-subtle)]">
                    {relativeTime(h.gradedAt ?? h.submittedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
