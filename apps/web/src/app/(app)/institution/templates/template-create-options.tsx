'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as pdfjs from 'pdfjs-dist';
import { AlertCircle, Pencil, Upload } from 'lucide-react';
import { createTemplateAction } from '../actions';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const TARGET_LONG_EDGE = 1500;
const PDF_ANNOTATION_MODE_DISABLE = 0;
const TESSERA_LAYOUT_MARKER = 'TESSERA_LAYOUT_V1';

let workerConfigured = false;
function ensurePdfWorker() {
  if (workerConfigured) return;
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  workerConfigured = true;
}

type ImportedTemplate = {
  id: string;
  name: string;
  backgroundUrl: string;
  paperId: 'a4-l' | 'a4-p';
  layout: Record<string, unknown>;
};

type RenderedTemplateSource = {
  dataUrl: string;
  width: number;
  height: number;
  fields?: PdfTemplateField[];
  layout?: Record<string, unknown>;
};

type PdfTemplateField = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export function TemplateFileUpload({
  onCreated,
  compact = false,
}: {
  onCreated?: (template: ImportedTemplate) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleFile(file?: File) {
    if (!file || pending) return;
    setMessage(null);

    if (file.size > MAX_FILE_SIZE) {
      setMessage({ ok: false, text: 'El archivo supera el máximo de 10 MB.' });
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      setMessage({ ok: false, text: 'Sube un PDF o una imagen PNG/JPG/WebP.' });
      return;
    }

    setPending(true);
    try {
      const rendered = isPdf ? await renderPdfFirstPage(file) : await renderImage(file);
      const name = file.name.replace(/\.[^.]+$/, '').trim() || 'Plantilla importada';
      const paperId = rendered.width >= rendered.height ? 'a4-l' : 'a4-p';
      const blocks = isPdf ? (pdfFieldBlocks(rendered.fields ?? [], paperId) ?? []) : [];
      const layout = rendered.layout ?? {
          name,
          pages: [
            {
              id: 'p1',
              name: 'Página 1',
              paletteId: 'royal',
              paperId,
              bgUrl: rendered.dataUrl,
              bgGradient: null,
              bgSolid: null,
            },
          ],
          blocks,
        };
      const form = new FormData();
      form.set('name', name);
      form.set('backgroundUrl', rendered.dataUrl);
      form.set('layout', JSON.stringify(layout));

      const res = await createTemplateAction(form);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }

      onCreated?.({
        id: res.data!.id,
        name,
        backgroundUrl: rendered.dataUrl,
        paperId,
        layout,
      });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: 'No se pudo importar el archivo.' });
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className={compact ? 'h-full' : ''}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className={`group flex h-full w-full cursor-pointer flex-col gap-3 rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-white/[0.015] text-left transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-500)]/60 hover:bg-white/[0.03] disabled:cursor-wait disabled:opacity-70 ${compact ? 'items-center justify-center p-8 text-center' : 'items-start p-6'}`}
        >
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white/[0.04] text-[var(--color-brand-300)]">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[var(--color-fg)]">
              Subir desde tu equipo
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
              {pending
                ? 'Importando archivo y preparando la plantilla...'
                : 'Sube un PDF o imagen (PNG/JPG/WebP) para crear una plantilla editable con ese diseño como fondo.'}
            </p>
            <p className="mt-2 text-[11px] text-[var(--color-fg-subtle)]">
              Formatos: <code className="font-mono">.pdf</code>,{' '}
              <code className="font-mono">.png</code>, <code className="font-mono">.jpg</code> ·
              máx 10 MB
            </p>
          </div>
        </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {message && !message.ok && (
        <div
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          {message.text}
        </div>
      )}
    </div>
  );
}

export function TemplateCreateOptions() {
  return (
    <section>
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        Crear una plantilla
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <TemplateFileUpload />
        <Link href="/institution/templates/editor" className="block">
          <div className="group flex h-full flex-col items-start gap-3 rounded-2xl border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-500)]/[0.05] p-6 transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-500)] hover:bg-[var(--color-brand-500)]/[0.08]">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/15 text-[var(--color-brand-300)]">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[var(--color-fg)]">Diseñar en el editor interno</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
                Empieza desde un lienzo A4 con bloques de texto, firma, sello, QR y variables vinculables a tus columnas. Todo desde el navegador.
              </p>
              <p className="mt-2 text-[11px] text-[var(--color-fg-subtle)]">
                Variables: {`{{nombre}}`}, {`{{curso}}`}, {`{{fecha}}`}...
              </p>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}

async function renderImage(file: File): Promise<RenderedTemplateSource> {
  const bitmap = await createImageBitmap(file);
  try {
    return bitmapToDataUrl(bitmap);
  } finally {
    bitmap.close();
  }
}

async function renderPdfFirstPage(file: File): Promise<RenderedTemplateSource> {
  ensurePdfWorker();
  const data = await file.arrayBuffer();
  const embeddedLayout = extractEmbeddedTesseraLayout(new Uint8Array(data));
  const loadingTask = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    disableAutoFetch: true,
    disableStream: true,
  });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(1);
    try {
      const base = page.getViewport({ scale: 1 });
      const annotations = await page.getAnnotations({ intent: 'display' });
      const fields = annotations
        .filter((annotation): annotation is { fieldName: string; rect: number[] } => {
          const candidate = annotation as { subtype?: string; fieldName?: unknown; rect?: unknown };
          return (
            candidate.subtype === 'Widget' &&
            typeof candidate.fieldName === 'string' &&
            Array.isArray(candidate.rect) &&
            candidate.rect.length === 4
          );
        })
        .map((field) => pdfRectToField(field.fieldName, field.rect, base.width, base.height));
      const scale = Math.min(2.5, TARGET_LONG_EDGE / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas no disponible');
      await page.render({
        canvasContext: ctx,
        viewport,
        annotationMode: PDF_ANNOTATION_MODE_DISABLE,
      }).promise;
      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.88),
        width: canvas.width,
        height: canvas.height,
        fields,
        ...(embeddedLayout ? { layout: embeddedLayout } : {}),
      };
    } finally {
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
}

function bitmapToDataUrl(bitmap: ImageBitmap): RenderedTemplateSource {
  const scale = Math.min(1, TARGET_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    width: canvas.width,
    height: canvas.height,
  };
}

function pdfRectToField(name: string, rect: number[], pageWidth: number, pageHeight: number) {
  const safePageWidth = finiteNumber(pageWidth, 1);
  const safePageHeight = finiteNumber(pageHeight, 1);
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = rect;
  const left = Math.min(finiteNumber(x1, 0), finiteNumber(x2, 0));
  const right = Math.max(finiteNumber(x1, 0), finiteNumber(x2, 0));
  const bottom = Math.min(finiteNumber(y1, 0), finiteNumber(y2, 0));
  const top = Math.max(finiteNumber(y1, 0), finiteNumber(y2, 0));
  return {
    name,
    x: clampNumber(((left + right) / 2 / safePageWidth) * 100, 2, 98),
    y: clampNumber((1 - (bottom + top) / 2 / safePageHeight) * 100, 2, 98),
    w: clampNumber(((right - left) / safePageWidth) * 900, 80, 620),
    h: clampNumber(((top - bottom) / safePageHeight) * 620, 24, 120),
  };
}

function pdfFieldBlocks(fields: PdfTemplateField[], paperId: 'a4-l' | 'a4-p') {
  if (!fields.length) return null;
  return fields.map((field, index) => ({
    id: `pdf-field-${index + 1}`,
    pageId: 'p1',
    kind: 'text',
    content: tokenForPdfField(field.name),
    label: field.name,
    x: field.x,
    y: field.y,
    w: field.w,
    h: field.h,
    size: paperId === 'a4-p' ? 15 : 16,
    color: '#ffffff',
    align: 'center',
    fontFamily: 'sans',
    textShadow: true,
  }));
}

function tokenForPdfField(name: string) {
  const normalized = normalizeFieldName(name);
  if (/(nombre|name|alumno|student|estudiante)/.test(normalized)) return '{{nombre}}';
  if (/(curso|course|programa|achievement|certificado)/.test(normalized)) return '{{curso}}';
  if (/(fecha|date|emision|issued|completed)/.test(normalized)) return '{{fecha}}';
  if (/(instructor|docente|teacher|profesor|firma)/.test(normalized)) return '{{instructor}}';
  if (/(puntaje|score|grade|nota)/.test(normalized)) return '{{puntaje}}';
  if (/(codigo|code|token|folio|serial)/.test(normalized)) return '{{tokenId}}';
  if (/(email|correo|mail)/.test(normalized)) return '{{email}}';
  if (/(wallet|billetera|address)/.test(normalized)) return '{{wallet}}';
  const fallback = normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `{{${fallback || 'campo'}}}`;
}

function normalizeFieldName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractEmbeddedTesseraLayout(bytes: Uint8Array): Record<string, unknown> | null {
  const header = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(bytes.length, 512_000)));
  const match = header.match(new RegExp(`%${TESSERA_LAYOUT_MARKER}:([A-Za-z0-9_-]+)`));
  if (!match?.[1]) return null;
  try {
    const json = decodeBase64UrlToText(match[1]);
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeBase64UrlToText(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function finiteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
