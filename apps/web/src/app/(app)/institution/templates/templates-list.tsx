'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, Eye, Layout, Pencil, Trash2 } from 'lucide-react';
import type { CertTemplateRow } from '@/lib/api/endpoints/me';
import { formatDate, formatNumber } from '@/lib/format';
import { deleteTemplateAction } from '../actions';

export function TemplatesList({ templates }: { templates: CertTemplateRow[] }) {
  const [preview, setPreview] = useState<CertTemplateRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CertTemplateRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteTemplateAction(deleteTarget.id);
      if (result.ok) {
        setDeleteTarget(null);
        return;
      }
      setDeleteError(result.error);
    });
  }

  return (
    <>
      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        {templates.map((template) => (
          <article
            key={template.id}
            className="group grid grid-cols-[156px_minmax(0,1fr)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white/[0.02] transition hover:border-[var(--color-brand-500)]/50 hover:bg-white/[0.035]"
          >
            <button
              type="button"
              onClick={() => setPreview(template)}
              className="relative h-32 w-[156px] bg-[#071024] p-2 text-left"
              aria-label={`Vista previa de ${template.name}`}
            >
              {template.backgroundUrl ? (
                <Image
                  src={template.backgroundUrl}
                  alt={template.name}
                  fill
                  sizes="156px"
                  className="object-contain p-2 transition group-hover:scale-[1.02]"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Layout className="h-8 w-8 text-[var(--color-fg-subtle)]" />
                </div>
              )}
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                <Eye className="h-3 w-3" /> Preview
              </span>
            </button>
            <div className="flex min-w-0 flex-col justify-between gap-3 p-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-[var(--color-fg)]">
                  {template.name}
                </h3>
                <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
                  {formatDate(template.createdAt)}
                </p>
                <p className="mt-2 inline-flex items-center rounded-md border border-[var(--color-border)] bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-[var(--color-brand-300)]">
                  {formatNumber(template.usage)} usos
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreview(template)}
                  className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-[var(--color-fg-muted)] transition hover:bg-white/[0.08] hover:text-[var(--color-fg)]"
                >
                  <Eye className="h-3 w-3" /> Vista previa
                </button>
                <Link
                  href={`/institution/templates/editor?templateId=${template.id}`}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--color-brand-500)]/12 px-2 py-1 text-[11px] text-[var(--color-brand-200)] transition hover:bg-[var(--color-brand-500)]/18 hover:text-[var(--color-fg)]"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(template);
                    setDeleteError(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] text-red-200 transition hover:bg-red-500/15 hover:text-red-100"
                >
                  <Trash2 className="h-3 w-3" /> Eliminar
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712]/80 p-6 backdrop-blur-md"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-blue-300/[0.16] bg-[#081127] shadow-[0_32px_120px_rgba(0,0,0,0.58)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-blue-300/[0.12] px-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-fg)]">
                  {preview.name}
                </p>
                <p className="text-[11px] text-[var(--color-fg-subtle)]">
                  Creada {formatDate(preview.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/institution/templates/editor?templateId=${preview.id}`}
                  className="rounded-lg border border-blue-300/[0.14] bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--color-fg-muted)] hover:bg-white/[0.08] hover:text-[var(--color-fg)]"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-lg border border-blue-300/[0.14] bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--color-fg-muted)] hover:bg-white/[0.08] hover:text-[var(--color-fg)]"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top,#142553_0%,#060b18_58%)] p-8">
              {preview.backgroundUrl ? (
                <Image
                  src={preview.backgroundUrl}
                  alt={preview.name}
                  width={1200}
                  height={850}
                  className="mx-auto max-h-full w-auto max-w-full rounded-lg object-contain shadow-[0_28px_100px_rgba(0,0,0,0.45)]"
                  unoptimized
                />
              ) : (
                <div className="flex min-h-80 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white/[0.02]">
                  <Layout className="h-10 w-10 text-[var(--color-fg-subtle)]" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712]/80 p-6 backdrop-blur-md"
          onClick={() => (pending ? null : setDeleteTarget(null))}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-red-400/20 bg-[#081127] p-5 shadow-[0_32px_120px_rgba(0,0,0,0.58)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-400/25 bg-red-500/10 text-red-200">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[var(--color-fg)]">
                  Eliminar plantilla
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                  Vas a eliminar <strong className="text-[var(--color-fg)]">{deleteTarget.name}</strong>.
                  Esta acción no se puede deshacer.
                </p>
                {deleteTarget.usage > 0 ? (
                  <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    Esta plantilla tiene {formatNumber(deleteTarget.usage)} certificados emitidos.
                    Por seguridad, el sistema no permite eliminar plantillas ya usadas.
                  </p>
                ) : null}
              </div>
            </div>

            {deleteError ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {deleteError}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-blue-300/[0.14] bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--color-fg-muted)] hover:bg-white/[0.08] hover:text-[var(--color-fg)] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending || deleteTarget.usage > 0}
                onClick={confirmDelete}
                className="rounded-lg border border-red-400/25 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {pending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
