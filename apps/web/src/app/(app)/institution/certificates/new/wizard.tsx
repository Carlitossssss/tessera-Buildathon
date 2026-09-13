'use client';

import {
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDot,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Layout,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EditableColumnHeader, TabularFieldInput } from '@/components/forms/tabular-field-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  inferTabularFieldKind,
  validateCertificateRows,
} from '@/lib/validation/tabular-fields';
import type {
  CertTemplateRow,
  CourseEnrollment,
  CourseRow,
  IssueCertificatePayload,
} from '@/lib/api/endpoints/me';
import { issueCertificatesAction } from '../../actions';
import { TemplateFileUpload } from '../../templates/template-create-options';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type StepId = 1 | 2 | 3 | 4;
type DataSource = 'csv' | 'manual' | 'paste';
type IssueMode = 'one' | 'batch';
type TemplateOption = {
  id: string;
  name: string;
  palette: string;
  backgroundUrl?: string | null;
  paperId: 'a4-l' | 'a4-p';
  layout?: Record<string, unknown> | null;
};

interface FieldDef {
  id: string;
  label: string;
  hint: string;
  /** porcentaje sobre el lienzo A4 horizontal */
  x: number;
  y: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const FIELDS: FieldDef[] = [
  {
    id: 'studentName',
    label: 'Nombre del estudiante',
    hint: 'Texto principal',
    x: 50,
    y: 42,
    size: 'xl',
  },
  {
    id: 'courseName',
    label: 'Curso',
    hint: 'Subtítulo bajo el nombre',
    x: 50,
    y: 56,
    size: 'lg',
  },
  {
    id: 'issuedDate',
    label: 'Fecha de emisión',
    hint: 'Pie izquierdo',
    x: 22,
    y: 80,
    size: 'sm',
  },
  {
    id: 'certCode',
    label: 'Código / Token',
    hint: 'Pie derecho',
    x: 78,
    y: 80,
    size: 'sm',
  },
  {
    id: 'instructor',
    label: 'Instructor',
    hint: 'Firma derecha',
    x: 78,
    y: 70,
    size: 'md',
  },
];

const RECIPIENT_FIELDS: FieldDef[] = [
  { id: 'studentEmail', label: 'Email del estudiante', hint: 'Requerido para emitir', x: 0, y: 0 },
];
const MAPPING_FIELDS = [...RECIPIENT_FIELDS, ...FIELDS];
const DEFAULT_COLUMNS = ['email', 'nombre', 'curso', 'puntaje'];

const MOCK_CSV_ROWS: Record<string, string>[] = [
  {
    nombre: 'Ana García',
    email: 'ana.garcia@uni.pe',
    curso: 'Solidity Avanzado',
    puntaje: '95',
  },
  {
    nombre: 'Luis Pérez',
    email: 'luis.perez@uni.pe',
    curso: 'Solidity Avanzado',
    puntaje: '88',
  },
  {
    nombre: 'Marta Ruiz',
    email: 'marta.r@uni.pe',
    curso: 'Solidity Avanzado',
    puntaje: '92',
  },
  {
    nombre: 'Carlos Vega',
    email: 'cvega@uni.pe',
    curso: 'Solidity Avanzado',
    puntaje: '78',
  },
  {
    nombre: 'Sofía Quispe',
    email: 'squispe@uni.pe',
    curso: 'Solidity Avanzado',
    puntaje: '99',
  },
  {
    nombre: 'Diego Torres',
    email: 'dtorres@uni.pe',
    curso: 'Solidity Avanzado',
    puntaje: '83',
  },
];

// Plantillas de respaldo si no hay reales
const FALLBACK_TEMPLATES = [
  {
    id: 'tpl-classic',
    name: 'Clásico institucional',
    backgroundUrl: null,
    palette: 'from-[#172033] via-[#6366f1] to-[#080d1a]',
    paperId: 'a4-l' as const,
  },
  {
    id: 'tpl-modern',
    name: 'Moderno minimal',
    backgroundUrl: null,
    palette: 'from-[#080d1a] via-[#101827] to-[#172033]',
    paperId: 'a4-l' as const,
  },
  {
    id: 'tpl-elegant',
    name: 'Elegante dorado',
    backgroundUrl: null,
    palette: 'from-[#172033] via-[#101827] to-[#080d1a]',
    paperId: 'a4-l' as const,
  },
];

// ─── Componente ────────────────────────────────────────────────────────────────

interface Props {
  templates: CertTemplateRow[];
  courses: CourseRow[];
  courseStudents: Array<{ courseId: string; students: CourseEnrollment[] }>;
  institutionWallet: string;
  tscPerCertificate: number;
  initialTemplateId?: string;
}

function templatePaperId(layout: Record<string, unknown> | null): 'a4-l' | 'a4-p' {
  if (!layout || !Array.isArray(layout.pages)) return 'a4-l';
  const firstPage = layout.pages[0];
  return firstPage &&
    typeof firstPage === 'object' &&
    'paperId' in firstPage &&
    firstPage.paperId === 'a4-p'
    ? 'a4-p'
    : 'a4-l';
}

export function CertificateWizard({
  templates,
  courses,
  courseStudents,
  institutionWallet,
  tscPerCertificate,
  initialTemplateId,
}: Props) {
  const router = useRouter();
  const initialTemplate = templates.find((template) => template.id === initialTemplateId);
  const [step, setStep] = useState<StepId>(1);
  const [templateId, setTemplateId] = useState<string | null>(initialTemplate?.id ?? null);
  const [templatePalette, setTemplatePalette] = useState<string>(FALLBACK_TEMPLATES[0]!.palette);
  const [templateName, setTemplateName] = useState<string>(
    initialTemplate?.name ?? FALLBACK_TEMPLATES[0]!.name,
  );
  const [templateBackgroundUrl, setTemplateBackgroundUrl] = useState<string | null>(
    initialTemplate?.backgroundUrl ?? null,
  );
  const [templateLayout, setTemplateLayout] = useState<Record<string, unknown> | null>(
    initialTemplate?.layout ?? null,
  );
  const [fieldPositions, setFieldPositions] = useState<Record<string, { x: number; y: number }>>(
    () => positionsFromLayout(initialTemplate?.layout),
  );
  const [importedTemplates, setImportedTemplates] = useState<TemplateOption[]>([]);

  const [source, setSource] = useState<DataSource>('csv');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [linkedStudentEmails, setLinkedStudentEmails] = useState<Record<number, string>>({});
  const [pasteText, setPasteText] = useState('');

  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [activeField, setActiveField] = useState<string | null>(null);

  const [previewIndex, setPreviewIndex] = useState(0);
  const [issueMode, setIssueMode] = useState<IssueMode>('batch');
  const [courseId, setCourseId] = useState<string>('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentSuggestions = useMemo(
    () => buildStudentSuggestions(courseStudents, courses),
    [courseStudents, courses],
  );

  const allTemplates = useMemo(() => {
    if (templates.length) {
      const persisted = templates.map((t) => ({
        id: t.id,
        name: t.name,
        backgroundUrl: t.backgroundUrl,
        palette: FALLBACK_TEMPLATES[0]!.palette,
        paperId: templatePaperId(t.layout),
        layout: t.layout,
      }));
      return [
        ...persisted,
        ...importedTemplates.filter(
          (imported) => !persisted.some((item) => item.id === imported.id),
        ),
      ];
    }
    return [...FALLBACK_TEMPLATES, ...importedTemplates];
  }, [templates, importedTemplates]);

  const totalRows = rows.length;
  const manualErrors = source === 'manual' ? validateCertificateRows(rows, columns) : {};
  const filledColumns = useMemo(
    () => columns.filter((column) => rows.some((row) => (row[column] ?? '').trim().length > 0)),
    [columns, rows],
  );
  const resolvedMappings = useMemo(
    () =>
      Object.fromEntries(
        Object.entries({ ...autoMapColumns(columns), ...mappings }).filter(([, column]) =>
          filledColumns.includes(column),
        ),
      ),
    [columns, filledColumns, mappings],
  );
  const mappedFieldIds = useMemo(
    () => MAPPING_FIELDS.filter((field) => resolvedMappings[field.id]).map((field) => field.id),
    [resolvedMappings],
  );
  const isMappingComplete = Boolean(resolvedMappings.studentName && resolvedMappings.studentEmail);
  const canNext =
    (step === 1 && !!templateId) ||
    (step === 2 && totalRows > 0 && Object.keys(manualErrors).length === 0) ||
    (step === 3 && isMappingComplete) ||
    step === 4;

  function pickTemplate(t: TemplateOption) {
    setTemplateId(t.id);
    setTemplateName(t.name);
    setTemplatePalette(t.palette);
    setTemplateBackgroundUrl(t.backgroundUrl ?? null);
    setTemplateLayout(t.layout ?? null);
    setFieldPositions(positionsFromLayout(t.layout));
  }

  function loadMockCsv() {
    setRows(
      MOCK_CSV_ROWS.map((row) =>
        Object.fromEntries(DEFAULT_COLUMNS.map((column) => [column, row[column] ?? ''])),
      ),
    );
    setLinkedStudentEmails({});
    setColumns(DEFAULT_COLUMNS);
    // Auto-mapeo razonable
    setMappings({
      studentName: 'nombre',
      studentEmail: 'email',
      walletAddress: 'wallet',
      courseName: 'curso',
      certCode: 'puntaje',
      instructor: 'instructor',
    });
  }

  async function loadCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFeedback({ tone: 'error', message: 'Por ahora la carga directa acepta archivos CSV.' });
      return;
    }
    const text = await file.text();
    const parsed = parseDelimitedText(text);
    if (parsed.rows.length === 0) {
      setFeedback({ tone: 'error', message: 'No se detectaron filas en el archivo.' });
      return;
    }
    setColumns(parsed.columns);
    setRows(parsed.rows);
    setLinkedStudentEmails({});
    setMappings(autoMapColumns(parsed.columns));
    setFeedback({ tone: 'success', message: `${parsed.rows.length} fila(s) cargadas.` });
  }

  function parsePaste() {
    const parsed = parseDelimitedText(pasteText);
    if (parsed.rows.length < 1) return;
    setColumns(parsed.columns);
    setRows(parsed.rows);
    setLinkedStudentEmails({});
    setMappings((current) => ({ ...autoMapColumns(parsed.columns), ...current }));
  }

  function addManualRow() {
    if (columns.length === 0) {
      setColumns(DEFAULT_COLUMNS);
      setMappings((current) => ({ ...autoMapColumns(DEFAULT_COLUMNS), ...current }));
    }
    setRows((r) => [
      ...r,
      Object.fromEntries(
        (columns.length ? columns : DEFAULT_COLUMNS).map((c) => [
          c,
          inferTabularFieldKind(c) === 'wallet' ? institutionWallet : '',
        ]),
      ),
    ]);
  }

  function updateManualCell(rowIdx: number, col: string, value: string) {
    if (inferTabularFieldKind(col) === 'email') {
      const exactMatch = studentSuggestions.find((student) => student.email === value);
      if (!exactMatch) {
        setLinkedStudentEmails((current) => {
          const next = { ...current };
          delete next[rowIdx];
          return next;
        });
        if (!value.trim()) {
          setRows((current) =>
            current.map((row, index) =>
              index === rowIdx ? fillWalletFallback(row, columns, institutionWallet) : row,
            ),
          );
        }
      }
    }
    setRows((r) => r.map((row, i) => (i === rowIdx ? { ...row, [col]: value } : row)));
  }

  function applyStudentSuggestion(rowIdx: number, suggestion: StudentSuggestion) {
    setLinkedStudentEmails((current) => ({ ...current, [rowIdx]: suggestion.email }));
    setRows((current) =>
      current.map((row, index) =>
        index === rowIdx
          ? fillStudentRow(row, columns, suggestion, institutionWallet)
          : row,
      ),
    );
  }

  function removeManualRow(rowIdx: number) {
    setRows((current) => current.filter((_, index) => index !== rowIdx));
    setLinkedStudentEmails((current) =>
      Object.fromEntries(
        Object.entries(current)
          .map(([index, email]) => [Number(index), email] as const)
          .filter(([index]) => index !== rowIdx)
          .map(([index, email]) => [String(index > rowIdx ? index - 1 : index), email]),
      ),
    );
    setPreviewIndex((current) => Math.max(0, Math.min(current, rows.length - 2)));
  }

  function addColumn() {
    let index = columns.length + 1;
    let name = `columna_${index}`;
    while (columns.includes(name)) name = `columna_${++index}`;
    setColumns((current) => {
      const next = [...current, name];
      setMappings((existing) => ({ ...autoMapColumns(next), ...existing }));
      return next;
    });
    setRows((current) => current.map((row) => ({ ...row, [name]: '' })));
  }

  function renameColumn(currentName: string, requestedName: string) {
    const nextName = requestedName.trim();
    if (!nextName || nextName === currentName || columns.includes(nextName)) return;
    setColumns((current) => current.map((column) => (column === currentName ? nextName : column)));
    setRows((current) =>
      current.map((row) => {
        const next = { ...row, [nextName]: row[currentName] ?? '' };
        delete next[currentName];
        return next;
      }),
    );
    setMappings((current) =>
      Object.fromEntries(
        Object.entries(current).map(([field, column]) => [
          field,
          column === currentName ? nextName : column,
        ]),
      ),
    );
  }

  function removeColumn(name: string) {
    setColumns((current) => current.filter((column) => column !== name));
    setRows((current) =>
      current.map((row) => {
        const next = { ...row };
        delete next[name];
        return next;
      }),
    );
    setMappings((current) =>
      Object.fromEntries(Object.entries(current).filter(([, column]) => column !== name)),
    );
  }

  function assignColumnToField(field: string, col: string) {
    setMappings((m) => ({ ...m, [field]: col }));
    setActiveField(null);
  }

  function clearField(field: string) {
    setMappings((m) => {
      const next = { ...m };
      delete next[field];
      return next;
    });
  }

  function valueFor(field: string, rowIdx = previewIndex): string {
    const col = resolvedMappings[field];
    if (!col) return `{{${field}}}`;
    return rows[rowIdx]?.[col] ?? `{{${col}}}`;
  }

  function buildPayloads(): IssueCertificatePayload[] {
    const selectedRows = issueMode === 'one' ? rows.slice(previewIndex, previewIndex + 1) : rows;
    return selectedRows.map((row, index) => {
      const read = (field: string) => {
        const col = resolvedMappings[field];
        return col ? (row[col] ?? '').trim() : '';
      };
      const studentName = read('studentName');
      const studentEmail = read('studentEmail').toLowerCase();
      const walletAddress = read('walletAddress');
      const achievementName =
        read('courseName') ||
        courses.find((c) => c.id === courseId)?.title ||
        'Certificado Tessera';
      const gradeRaw = read('certCode');
      const grade = Number(gradeRaw);
      const completedAt = new Date();
      return {
        student: {
          email: studentEmail,
          name: studentName,
          ...(walletAddress ? { walletAddress } : {}),
          externalId: studentEmail,
        },
        achievement: {
          name: achievementName,
          completedAt: Number.isNaN(completedAt.getTime())
            ? new Date().toISOString()
            : completedAt.toISOString(),
          ...(Number.isFinite(grade)
            ? { grade: Math.max(0, Math.min(100, Math.round(grade))) }
            : {}),
          ...(courseId ? { courseId } : {}),
        },
        ...(templateId ? { templateId } : {}),
        idempotencyKey: `panel:${templateId ?? 'no-template'}:${studentEmail}:${Date.now()}:${index}`,
      };
    });
  }

  function issueCertificates() {
    setFeedback(null);
    const payloads = buildPayloads();
    const invalid = payloads.find(
      (payload) =>
        !payload.student.name ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.student.email) ||
        (payload.student.walletAddress !== undefined &&
          !/^0x[a-fA-F0-9]{40}$/.test(payload.student.walletAddress)),
    );
    if (invalid) {
      setFeedback({
        tone: 'error',
        message: 'Revisa nombre, email y wallet. La wallet debe ser una dirección 0x válida.',
      });
      return;
    }
    startTransition(async () => {
      const res = await issueCertificatesAction(payloads);
      if (res.ok) {
        setFeedback({
          tone: 'success',
          message: `${res.data?.count ?? payloads.length} certificado(s) encolado(s).`,
        });
        router.push('/institution/certificates');
      } else {
        setFeedback({ tone: 'error', message: res.error });
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Header & Stepper */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <Link
            href="/institution/certificates"
            className="inline-flex items-center gap-1 text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a certificados
          </Link>
          <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]">
            Emitir certificados
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-fg-muted)]">
            Conecta una fuente de datos (CSV, Excel o manual), mapea las columnas a la plantilla y
            emite uno o varios certificados on-chain.
          </p>
        </div>
        <Stepper step={step} />
      </header>

      {/* Contenido del paso */}
      <main>
        {step === 1 && (
          <StepTemplate
            templates={allTemplates}
            selected={templateId}
            onPick={pickTemplate}
            onImported={(template) => {
              setImportedTemplates((current) => [...current, template]);
              pickTemplate(template);
              const returnTo = `/institution/certificates/new?templateId=${template.id}`;
              router.push(
                `/institution/templates/editor?templateId=${template.id}&returnTo=${encodeURIComponent(returnTo)}`,
              );
            }}
          />
        )}

        {step === 2 && (
          <StepData
            source={source}
            setSource={setSource}
            rows={rows}
            columns={columns}
            onLoadSample={loadMockCsv}
            onLoadFile={loadCsvFile}
            onAddManualRow={addManualRow}
            onUpdateCell={updateManualCell}
            onApplyStudentSuggestion={applyStudentSuggestion}
            onRemoveRow={removeManualRow}
            onAddColumn={addColumn}
            onRenameColumn={renameColumn}
            onRemoveColumn={removeColumn}
            studentSuggestions={studentSuggestions}
            linkedStudentEmails={linkedStudentEmails}
            validationErrors={manualErrors}
            pasteText={pasteText}
            setPasteText={setPasteText}
            onParsePaste={parsePaste}
            triggerFile={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef}
          />
        )}

        {step === 3 && (
          <StepMapping
            templateName={templateName}
            templatePalette={templatePalette}
            templateBackgroundUrl={templateBackgroundUrl}
            templateLayout={templateLayout}
            fieldPositions={fieldPositions}
            onMoveField={(id, position) =>
              setFieldPositions((current) => ({ ...current, [id]: position }))
            }
            columns={filledColumns}
            mappings={resolvedMappings}
            mappedFieldIds={mappedFieldIds}
            activeField={activeField}
            onSelectField={(f) => setActiveField((cur) => (cur === f ? null : f))}
            onAssign={assignColumnToField}
            onClear={clearField}
            previewRow={rows[previewIndex] ?? null}
          />
        )}

        {step === 4 && (
          <StepReview
            templateName={templateName}
            templatePalette={templatePalette}
            templateBackgroundUrl={templateBackgroundUrl}
            templateLayout={templateLayout}
            fieldPositions={fieldPositions}
            rows={rows}
            previewIndex={previewIndex}
            setPreviewIndex={setPreviewIndex}
            valueFor={valueFor}
            mappedFieldIds={mappedFieldIds}
            issueMode={issueMode}
            setIssueMode={setIssueMode}
            courses={courses}
            courseId={courseId}
            setCourseId={setCourseId}
            tscPerCertificate={tscPerCertificate}
          />
        )}
      </main>

      {/* Footer nav */}
      <footer className="sticky bottom-4 z-20 flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[rgba(10,13,26,0.9)] px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3 text-[12px] text-[var(--color-fg-subtle)]">
          <CircleDot className="h-3.5 w-3.5 text-[var(--color-brand-300)]" />
          {step === 1 &&
            (templateId ? `Plantilla: ${templateName}` : 'Selecciona una plantilla para continuar')}
          {step === 2 &&
            (totalRows > 0
              ? `${totalRows} filas listas · ${columns.length} columnas`
              : 'Carga datos para continuar')}
          {step === 3 &&
            (isMappingComplete
              ? 'Mapeo automático listo'
              : 'Falta completar nombre y email para emitir')}
          {step === 4 &&
            (issueMode === 'batch' ? `Lote de ${totalRows} certificados` : 'Emitir 1 certificado')}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => Math.max(1, s - 1) as StepId)}
            disabled={step === 1}
          >
            <ArrowLeft className="h-4 w-4" /> Atrás
          </Button>
          {step < 4 ? (
            <Button
              size="sm"
              onClick={() => setStep((s) => Math.min(4, s + 1) as StepId)}
              disabled={!canNext}
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={issueCertificates} loading={pending}>
                <Send className="h-4 w-4" />
                {issueMode === 'batch' ? `Emitir lote (${totalRows})` : 'Emitir 1'}
              </Button>
            </>
          )}
        </div>
      </footer>
      {feedback ? (
        <div
          className={cn(
            'fixed bottom-24 right-4 z-30 max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-2xl',
            feedback.tone === 'success'
              ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-100'
              : 'border-red-500/25 bg-red-500/15 text-red-100',
          )}
        >
          {feedback.message}
        </div>
      ) : null}
    </div>
  );
}

// ─── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: StepId }) {
  const items = [
    { id: 1, label: 'Plantilla', icon: Layout },
    { id: 2, label: 'Datos', icon: Database },
    { id: 3, label: 'Mapeo', icon: Pencil },
    { id: 4, label: 'Revisar', icon: Eye },
  ] as const;
  return (
    <ol className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white/[0.02] p-1 text-[12px]">
      {items.map((it, i) => {
        const active = step === it.id;
        const done = step > it.id;
        return (
          <li key={it.id} className="flex items-center">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors',
                active && 'bg-[var(--color-brand-500)] text-white',
                done && 'text-[var(--color-fg)]',
                !active && !done && 'text-[var(--color-fg-subtle)]',
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5 text-[var(--color-accent-400)]" />
              ) : (
                <it.icon className="h-3.5 w-3.5" />
              )}
              <span className="font-medium">{it.label}</span>
            </span>
            {i < items.length - 1 && <span className="mx-0.5 h-px w-3 bg-[var(--color-border)]" />}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Paso 1: Plantilla ─────────────────────────────────────────────────────────

function StepTemplate({
  templates,
  selected,
  onPick,
  onImported,
}: {
  templates: TemplateOption[];
  selected: string | null;
  onPick: (t: TemplateOption) => void;
  onImported: (t: TemplateOption) => void;
}) {
  return (
    <section className="space-y-5">
      <SectionTitle
        title="Elige una plantilla"
        subtitle="O sube un PDF propio. Podrás ajustar el diseño en el mapeo."
      />
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
      >
        {templates.map((t) => {
          const isActive = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t)}
              className={cn(
                'group relative overflow-hidden rounded-2xl border text-left transition-all',
                isActive
                  ? 'border-[var(--color-brand-500)] ring-2 ring-[var(--color-brand-500)]/40'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
              )}
            >
              <div
                className={cn(
                  'relative w-full overflow-hidden bg-gradient-to-br',
                  t.paperId === 'a4-p' ? 'aspect-[210/297]' : 'aspect-[297/210]',
                  t.palette,
                )}
              >
                {t.backgroundUrl ? (
                  <img
                    src={t.backgroundUrl}
                    alt={`Miniatura de ${t.name}`}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                ) : null}
                {!t.backgroundUrl ? (
                  <div className="absolute inset-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-center backdrop-blur-sm">
                    <div className="text-[8px] uppercase tracking-[0.3em] text-white/50">
                      Certifica que
                    </div>
                    <div className="font-serif text-[15px] text-white">{`{{nombre}}`}</div>
                    <div className="text-[9px] text-white/60">ha completado</div>
                    <div className="font-serif text-[11px] text-white/90">{`{{curso}}`}</div>
                  </div>
                ) : null}
                {isActive && (
                  <div className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-500)] text-white">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">{t.name}</p>
                  <p className="text-[11px] text-[var(--color-fg-subtle)]">
                    {t.paperId === 'a4-p' ? 'A4 · 210×297 mm' : 'A4 · 297×210 mm'}
                  </p>
                </div>
                <Layout className="h-4 w-4 text-[var(--color-fg-subtle)]" />
              </div>
            </button>
          );
        })}

        <TemplateFileUpload
          compact
          onCreated={(template) => {
            const option: TemplateOption = {
              ...template,
              palette: FALLBACK_TEMPLATES[0]!.palette,
            };
            onImported(option);
          }}
        />
        <UploadTile
          icon={Pencil}
          title="Diseñar desde cero"
          subtitle="Editor interno con bloques y firma"
          href="/institution/templates/editor"
          returnTo="/institution/certificates/new?templateId={templateId}"
        />
      </div>
    </section>
  );
}

function UploadTile({
  icon: Icon,
  title,
  subtitle,
  href,
  returnTo,
}: {
  icon: typeof Upload;
  title: string;
  subtitle: string;
  href?: string;
  returnTo?: string;
}) {
  const inner = (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-white/[0.015] p-8 text-center transition-colors hover:border-[var(--color-brand-500)]/60 hover:bg-white/[0.03]">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--color-fg)]">{title}</p>
        <p className="mt-1 text-[12px] leading-snug text-[var(--color-fg-muted)]">{subtitle}</p>
      </div>
    </div>
  );
  if (href) {
    const destination = returnTo ? `${href}?returnTo=${encodeURIComponent(returnTo)}` : href;
    return <Link href={destination}>{inner}</Link>;
  }

  return (
    <label className="cursor-pointer">
      {inner}
      <input type="file" accept="application/pdf,image/*" className="hidden" />
    </label>
  );
}

// ─── Paso 2: Datos ─────────────────────────────────────────────────────────────

function StepData({
  source,
  setSource,
  rows,
  columns,
  onLoadSample,
  onLoadFile,
  onAddManualRow,
  onUpdateCell,
  onApplyStudentSuggestion,
  onRemoveRow,
  onAddColumn,
  onRenameColumn,
  onRemoveColumn,
  studentSuggestions,
  linkedStudentEmails,
  validationErrors,
  pasteText,
  setPasteText,
  onParsePaste,
  triggerFile,
  fileInputRef,
}: {
  source: DataSource;
  setSource: (s: DataSource) => void;
  rows: Record<string, string>[];
  columns: string[];
  onLoadSample: () => void;
  onLoadFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddManualRow: () => void;
  onUpdateCell: (i: number, col: string, val: string) => void;
  onApplyStudentSuggestion: (i: number, suggestion: StudentSuggestion) => void;
  onRemoveRow: (i: number) => void;
  onAddColumn: () => void;
  onRenameColumn: (currentName: string, nextName: string) => void;
  onRemoveColumn: (name: string) => void;
  studentSuggestions: StudentSuggestion[];
  linkedStudentEmails: Record<number, string>;
  validationErrors: Record<string, string>;
  pasteText: string;
  setPasteText: (s: string) => void;
  onParsePaste: () => void;
  triggerFile: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <section className="space-y-5">
      <SectionTitle
        title="Conecta tu fuente de datos"
        subtitle="Una fila = un certificado. Detectamos automáticamente las columnas."
      />

      <Tabs
        items={[
          { id: 'csv', label: 'CSV', icon: FileSpreadsheet },
          { id: 'manual', label: 'Formulario manual', icon: Pencil },
          { id: 'paste', label: 'Pegar tabla', icon: FileText },
        ]}
        active={source}
        onChange={(v) => setSource(v as DataSource)}
      />

      {source === 'csv' && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div
            onClick={() => {
              triggerFile();
            }}
            className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-white/[0.015] p-8 text-center transition-colors hover:border-[var(--color-brand-500)]/60 hover:bg-white/[0.03]"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--color-fg)]">Arrastra tu CSV aquí</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
                Formato aceptado: <code className="font-mono">.csv</code> · máx 10 MB · 5 000 filas
                por lote
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onLoadSample();
              }}
            >
              <Download className="h-4 w-4" /> Cargar ejemplo CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={onLoadFile}
            />
          </div>

          <aside className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">Columnas recomendadas</h3>
            <p className="mt-1 text-[12px] text-[var(--color-fg-muted)]">
              No es obligatorio respetar los nombres; podrás mapearlos en el siguiente paso.
            </p>
            <ul className="mt-4 space-y-2 text-[12.5px] text-[var(--color-fg-muted)]">
              {[
                ['email', 'Email del estudiante, obligatorio'],
                ['nombre', 'Nombre completo del estudiante'],
                ['curso', 'Nombre del curso o logro'],
                ['puntaje', 'Nota final, opcional'],
                ['wallet', 'Visible para pruebas; se completa desde el estudiante o la institución'],
              ].map(([k, v]) => (
                <li key={k} className="flex items-start gap-2">
                  <code className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-brand-300)]">
                    {k}
                  </code>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}

      {source === 'manual' && (
        <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-[var(--color-fg-muted)]">
              Captura uno o varios estudiantes a mano. Ideal para entregas puntuales.
            </p>
            <div className="flex gap-2">
              {rows.length > 0 ? (
                <Button size="sm" variant="secondary" onClick={onAddColumn}>
                  <Plus className="h-4 w-4" /> Agregar columna
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={onAddManualRow}>
                <Plus className="h-4 w-4" /> Agregar fila
              </Button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white/[0.015] p-8 text-center text-[12.5px] text-[var(--color-fg-subtle)]">
              Aún no hay filas. Pulsa <strong>Agregar fila</strong> para empezar.
            </div>
          ) : (
            <div className="min-h-[368px] overflow-x-auto overflow-y-visible rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                  <tr>
                    {columns.map((c) => (
                      <th key={c} className="min-w-48 px-2 py-2 align-middle font-medium">
                        <EditableColumnHeader
                          name={c}
                          onRename={onRenameColumn}
                          onRemove={onRemoveColumn}
                          required={isRequiredIssueColumn(c)}
                        />
                      </th>
                    ))}
                    <th className="w-12 px-2 py-2 text-center align-middle font-medium">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const linked = Boolean(linkedStudentEmails[idx]);
                    return (
                      <tr key={idx} className="border-t border-[var(--color-border)]">
                        {columns.map((c) => {
                          const kind = inferTabularFieldKind(c);
                          return (
                            <td key={c} className="min-w-48 p-1.5 align-top">
                              {kind === 'email' ? (
                                <StudentEmailSearchInput
                                  value={row[c] ?? ''}
                                  suggestions={studentSuggestions}
                                  onChange={(value) => onUpdateCell(idx, c, value)}
                                  onPick={(suggestion) => onApplyStudentSuggestion(idx, suggestion)}
                                  error={validationErrors[`${idx}:${c}`]}
                                />
                              ) : kind === 'text' && isCourseColumn(c) ? (
                                <CourseComboboxInput
                                  value={row[c] ?? ''}
                                  suggestions={studentSuggestions}
                                  linkedEmail={linkedStudentEmails[idx] ?? null}
                                  onChange={(value) => onUpdateCell(idx, c, value)}
                                />
                              ) : (
                                <TabularFieldInput
                                  column={c}
                                  value={row[c] ?? ''}
                                  onChange={(value) => onUpdateCell(idx, c, value)}
                                  error={validationErrors[`${idx}:${c}`]}
                                  readOnly={
                                    kind === 'wallet' || (linked && isNameColumn(c))
                                  }
                                />
                              )}
                              {validationErrors[`${idx}:${c}`] &&
                              !isRequiredValidationMessage(validationErrors[`${idx}:${c}`]) ? (
                                <p className="px-1 pt-1 text-[10px] normal-case tracking-normal text-red-300">
                                  {validationErrors[`${idx}:${c}`]}
                                </p>
                              ) : null}
                            </td>
                          );
                        })}
                        <td className="p-1.5 text-center align-top">
                          <button
                            type="button"
                            onClick={() => onRemoveRow(idx)}
                            title="Eliminar fila"
                            aria-label={`Eliminar fila ${idx + 1}`}
                            className="inline-grid h-8 w-8 place-items-center rounded-md text-[var(--color-fg-subtle)] transition hover:bg-red-500/10 hover:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {Object.entries(validationErrors).some(([key]) => key.startsWith('form:')) ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {Object.entries(validationErrors)
                .filter(([key]) => key.startsWith('form:'))
                .map(([key, message]) => (
                  <p key={key}>{message}</p>
                ))}
            </div>
          ) : null}
        </div>
      )}

      {source === 'paste' && (
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
          <Label htmlFor="paste">Pega tu tabla (CSV, TSV o copia desde Excel/Google Sheets)</Label>
          <textarea
            id="paste"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={10}
            placeholder={'email,nombre,curso,puntaje\nana@uni.pe,Ana García,Solidity,95'}
            className="w-full rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-3 font-mono text-[12.5px] text-[var(--color-fg)] focus:border-[var(--color-brand-500)] focus:outline-none"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={onParsePaste}>
              <Sparkles className="h-4 w-4" /> Detectar columnas
            </Button>
          </div>
        </div>
      )}

    </section>
  );
}

interface StudentSuggestion {
  key: string;
  email: string;
  name: string;
  walletAddress: string | null;
  courseTitle: string;
  finalScore: number | null;
}

function buildStudentSuggestions(
  courseStudents: Array<{ courseId: string; students: CourseEnrollment[] }>,
  courses: CourseRow[],
): StudentSuggestion[] {
  const suggestions: StudentSuggestion[] = [];
  for (const { courseId, students } of courseStudents) {
    const course = courses.find((item) => item.id === courseId);
    for (const student of students) {
      const email = (student.studentEmail ?? student.email ?? '').trim().toLowerCase();
      if (!email) continue;
      suggestions.push({
        key: `${courseId}:${student.id}`,
        email,
        name: student.studentName ?? student.name ?? email,
        walletAddress: student.walletAddress ?? null,
        courseTitle: course?.title ?? '',
        finalScore: student.finalScore,
      });
    }
  }
  return suggestions.sort((a, b) =>
    `${a.email} ${a.courseTitle}`.localeCompare(`${b.email} ${b.courseTitle}`, 'es'),
  );
}

function fillStudentRow(
  row: Record<string, string>,
  columns: string[],
  suggestion: StudentSuggestion,
  institutionWallet: string,
) {
  const next = { ...row };
  for (const column of columns) {
    const normalized = normalizeColumn(column);
    if (normalized.includes('email') || normalized.includes('correo')) {
      next[column] = suggestion.email;
    } else if (normalized.includes('nombre') || normalized.includes('name')) {
      next[column] = suggestion.name;
    } else if (normalized.includes('curso') || normalized.includes('course')) {
      next[column] = suggestion.courseTitle;
    } else if (
      normalized.includes('puntaje') ||
      normalized.includes('nota') ||
      normalized.includes('score') ||
      normalized.includes('grade')
    ) {
      next[column] = suggestion.finalScore == null ? '' : String(suggestion.finalScore);
    } else if (normalized.includes('wallet') || normalized.includes('billetera')) {
      next[column] = suggestion.walletAddress ?? institutionWallet;
    }
  }
  return next;
}

function fillWalletFallback(
  row: Record<string, string>,
  columns: string[],
  institutionWallet: string,
) {
  const next = { ...row };
  for (const column of columns) {
    if (inferTabularFieldKind(column) === 'wallet') next[column] = institutionWallet;
  }
  return next;
}

function isNameColumn(column: string) {
  const normalized = normalizeColumn(column);
  return normalized.includes('nombre') || normalized.includes('name') || normalized.includes('estudiante');
}

function isCourseColumn(column: string) {
  const normalized = normalizeColumn(column);
  return normalized.includes('curso') || normalized.includes('course') || normalized.includes('achievement');
}

function isRequiredIssueColumn(column: string) {
  return inferTabularFieldKind(column) === 'email' || isNameColumn(column);
}

function isRequiredValidationMessage(message: string | undefined) {
  return Boolean(message?.toLowerCase().includes('obligatorio'));
}

function StudentEmailSearchInput({
  value,
  suggestions,
  onChange,
  onPick,
  error,
}: {
  value: string;
  suggestions: StudentSuggestion[];
  onChange: (value: string) => void;
  onPick: (suggestion: StudentSuggestion) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const query = value.trim().toLowerCase();
  const emailSuggestions = useMemo(() => {
    const byEmail = new Map<string, StudentSuggestion>();
    for (const suggestion of suggestions) {
      const existing = byEmail.get(suggestion.email);
      if (!existing) {
        byEmail.set(suggestion.email, suggestion);
        continue;
      }
      if (!existing.walletAddress && suggestion.walletAddress) {
        byEmail.set(suggestion.email, { ...existing, walletAddress: suggestion.walletAddress });
      }
    }
    return Array.from(byEmail.values());
  }, [suggestions]);
  const matches = useMemo(() => {
    if (!query) return emailSuggestions.slice(0, 8);
    return emailSuggestions
      .filter((student) =>
        `${student.email} ${student.name} ${student.courseTitle}`.toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [emailSuggestions, query]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
      <Input
        value={value}
        type="email"
        invalid={Boolean(error)}
        title={error}
        autoComplete="off"
        spellCheck={false}
        placeholder="estudiante@institucion.edu"
        className="h-8 pl-8 text-[13px]"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          const nextValue = event.target.value.trim().toLowerCase();
          onChange(nextValue);
          const exactMatch = emailSuggestions.find((student) => student.email === nextValue);
          if (exactMatch) onPick(exactMatch);
          setOpen(true);
        }}
      />
      {open && matches.length > 0 ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-96 w-max min-w-full max-w-[420px] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[#0b1022] p-1 shadow-2xl">
          {matches.map((student) => (
            <button
              key={student.key}
              type="button"
              className="flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onPick(student);
                setOpen(false);
              }}
            >
              <span className="text-[12.5px] font-medium text-[var(--color-fg)]">
                {student.email}
              </span>
              <span className="mt-0.5 text-[11px] text-[var(--color-fg-subtle)]">
                {student.name}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CourseComboboxInput({
  value,
  suggestions,
  linkedEmail,
  onChange,
}: {
  value: string;
  suggestions: StudentSuggestion[];
  linkedEmail: string | null;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const courseOptions = useMemo(
    () =>
      Array.from(
        new Set(
          suggestions
            .filter((student) => !linkedEmail || student.email === linkedEmail)
            .map((student) => student.courseTitle)
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [linkedEmail, suggestions],
  );
  const query = value.trim().toLowerCase();
  const matches = courseOptions
    .filter((course) => !query || course.toLowerCase().includes(query))
    .slice(0, 6);

  return (
    <div className="relative">
      <Input
        value={value}
        type="text"
        autoComplete="off"
        placeholder="Escribe o elige un curso"
        className="h-8 text-[13px]"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
      />
      {open && matches.length > 0 ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-96 w-max min-w-full max-w-[420px] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[#0b1022] p-1 shadow-2xl">
          {matches.map((course) => (
            <button
              key={course}
              type="button"
              className="flex w-full rounded-lg px-3 py-2 text-left text-[12.5px] text-[var(--color-fg)] transition-colors hover:bg-white/[0.06]"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(course);
                setOpen(false);
              }}
            >
              {course}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Paso 3: Mapeo ─────────────────────────────────────────────────────────────

function StepMapping({
  templateName,
  templatePalette,
  templateBackgroundUrl,
  templateLayout,
  fieldPositions,
  onMoveField,
  columns,
  mappings,
  mappedFieldIds,
  activeField,
  onSelectField,
  onAssign,
  onClear,
  previewRow,
}: {
  templateName: string;
  templatePalette: string;
  templateBackgroundUrl: string | null;
  templateLayout: Record<string, unknown> | null;
  fieldPositions: Record<string, { x: number; y: number }>;
  onMoveField: (id: string, position: { x: number; y: number }) => void;
  columns: string[];
  mappings: Record<string, string>;
  mappedFieldIds: string[];
  activeField: string | null;
  onSelectField: (id: string) => void;
  onAssign: (field: string, col: string) => void;
  onClear: (id: string) => void;
  previewRow: Record<string, string> | null;
}) {
  const mappedFields = MAPPING_FIELDS.filter((field) => mappedFieldIds.includes(field.id));
  const mappedFieldSet = new Set(mappedFieldIds);

  return (
    <section className="space-y-5">
      <SectionTitle
        title="Mapea columnas a la plantilla"
        subtitle={`Plantilla: ${templateName}. Toca un campo del lienzo y luego una columna para enlazarlos.`}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        {/* Panel izquierdo: campos + columnas */}
        <aside className="space-y-5">
          <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
              Campos del certificado
            </h3>
            {mappedFields.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {mappedFields.map((f) => {
                  const mapped = mappings[f.id];
                  const active = activeField === f.id;
                  return (
                    <li key={f.id}>
                      {f.id === 'studentEmail' || f.id === 'studentName' ? (
                        <p
                          className={cn(
                            'mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]',
                            f.id === 'studentName' && 'mt-4',
                          )}
                        >
                          {f.id === 'studentEmail'
                            ? 'Datos del destinatario'
                            : 'Campos originales del certificado'}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onSelectField(f.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors',
                          active
                            ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10'
                            : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                        )}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--color-fg)]">{f.label}</p>
                          <p className="text-[11px] text-[var(--color-fg-subtle)]">{f.hint}</p>
                        </div>
                        {mapped ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-[var(--color-brand-500)]/10 px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-brand-300)]"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClear(f.id);
                            }}
                            role="button"
                            aria-label="Quitar mapeo"
                          >
                            {mapped}
                            <Trash2 className="h-3 w-3" />
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                            Sin mapear
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-3 py-2 text-[12px] text-[var(--color-fg-muted)]">
                Completa al menos una columna en el paso anterior para ver campos disponibles.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
              Columnas detectadas
            </h3>
            <p className="mt-1 text-[12px] text-[var(--color-fg-muted)]">
              {activeField
                ? 'Toca una columna para enlazarla al campo seleccionado.'
                : 'Selecciona un campo arriba para asignarlo.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {columns.map((c) => {
                const used = Object.values(mappings).includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    disabled={!activeField}
                    onClick={() => activeField && onAssign(activeField, c)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[12px] transition-colors',
                      activeField
                        ? 'border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/5 text-[var(--color-brand-300)] hover:bg-[var(--color-brand-500)]/15'
                        : 'border-[var(--color-border)] text-[var(--color-fg-muted)]',
                      !activeField && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    {c}
                    {used && <Check className="h-3 w-3 text-[var(--color-accent-400)]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Lienzo del certificado */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
          <CertificateCanvas
            palette={templatePalette}
            templateName={templateName}
            backgroundUrl={templateBackgroundUrl}
            layout={templateLayout}
            positions={fieldPositions}
            editable
            onMoveField={onMoveField}
            fieldFilter={(field) => mappedFieldSet.has(field.id)}
            renderField={(f) => {
              const mapped = mappings[f.id];
              const value = mapped ? (previewRow?.[mapped] ?? `{{${mapped}}}`) : `{{${f.label}}}`;
              return (
                <button
                  type="button"
                  onClick={() => onSelectField(f.id)}
                  className={cn(
                    'group inline-flex flex-col items-center gap-0.5 rounded-md border-2 border-dashed px-2.5 py-1 transition-all',
                    activeField === f.id
                      ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/15'
                      : mapped
                        ? 'border-transparent bg-white/[0.05] hover:border-white/30'
                        : 'border-white/30 bg-black/30 hover:border-white/60',
                  )}
                >
                  <span className={cn(textSizeClass(f.size), 'font-serif text-white drop-shadow')}>
                    {value}
                  </span>
                  <span className="text-[8px] uppercase tracking-widest text-white/40">
                    {f.label}
                  </span>
                </button>
              );
            }}
          />
        </div>
      </div>
    </section>
  );
}

// ─── Paso 4: Revisar & Emitir ──────────────────────────────────────────────────

function StepReview({
  templateName,
  templatePalette,
  templateBackgroundUrl,
  templateLayout,
  fieldPositions,
  rows,
  previewIndex,
  setPreviewIndex,
  valueFor,
  mappedFieldIds,
  issueMode,
  setIssueMode,
  courses,
  courseId,
  setCourseId,
  tscPerCertificate,
}: {
  templateName: string;
  templatePalette: string;
  templateBackgroundUrl: string | null;
  templateLayout: Record<string, unknown> | null;
  fieldPositions: Record<string, { x: number; y: number }>;
  rows: Record<string, string>[];
  previewIndex: number;
  setPreviewIndex: (n: number) => void;
  valueFor: (field: string, idx?: number) => string;
  mappedFieldIds: string[];
  issueMode: IssueMode;
  setIssueMode: (m: IssueMode) => void;
  courses: CourseRow[];
  courseId: string;
  setCourseId: (id: string) => void;
  tscPerCertificate: number;
}) {
  const mappedFieldSet = new Set(mappedFieldIds);
  const currentRowCourse = valueFor('courseName', previewIndex);
  const hasMappedCourse =
    currentRowCourse.trim().length > 0 && !currentRowCourse.trim().startsWith('{{');
  const selectedCourse = courses.find((course) => course.id === courseId) ?? null;
  const displayedCourseName = hasMappedCourse
    ? currentRowCourse
    : (selectedCourse?.title ?? 'Sin curso vinculado');
  const certificateCount = issueMode === 'batch' ? rows.length : 1;
  const estimatedTsc = certificateCount * tscPerCertificate;

  return (
    <section className="space-y-5">
      <SectionTitle
        title="Revisa y emite"
        subtitle="Comprueba los datos antes de mandar la transacción on-chain."
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Preview grande */}
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">
              Vista previa ({previewIndex + 1} de {rows.length})
            </h3>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                disabled={previewIndex === 0}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPreviewIndex(Math.min(rows.length - 1, previewIndex + 1))}
                disabled={previewIndex >= rows.length - 1}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <CertificateCanvas
            palette={templatePalette}
            templateName={templateName}
            backgroundUrl={templateBackgroundUrl}
            layout={templateLayout}
            positions={fieldPositions}
            fieldFilter={(field) => mappedFieldSet.has(field.id)}
            renderField={(f) => (
              <span className={cn(textSizeClass(f.size), 'font-serif text-white drop-shadow')}>
                {valueFor(f.id, previewIndex)}
              </span>
            )}
          />
        </div>

        {/* Panel emisión */}
        <aside className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">Modo de emisión</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ModeButton
                active={issueMode === 'one'}
                onClick={() => setIssueMode('one')}
                title="Uno a uno"
                hint="Solo el actual"
                icon={Send}
              />
              <ModeButton
                active={issueMode === 'batch'}
                onClick={() => setIssueMode('batch')}
                title="Lote"
                hint={`${rows.length} certificados`}
                icon={Users}
              />
            </div>
          </div>

          {hasMappedCourse ? (
            <Stat label="Curso" value={displayedCourseName} hint="Tomado de los datos cargados" />
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="course">Curso (opcional)</Label>
              <Select
                id="course"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="h-10 px-3 py-2 text-[13px]"
              >
                <option value="">— Sin curso vinculado —</option>
                {[...courses]
                  .sort((a, b) => a.title.localeCompare(b.title, 'es'))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
              </Select>
            </div>
          )}

          <Stat
            label="TSC estimados"
            value={`${formatNumber(estimatedTsc)} TSC`}
            hint={`${formatNumber(tscPerCertificate)} TSC por certificado`}
          />
          <Stat
            label="Tiempo estimado"
            value={issueMode === 'batch' ? `${Math.ceil(rows.length * 1.2)}s` : '≈ 2s'}
            hint="Confirmación on-chain"
          />

          <div className="rounded-lg border border-[var(--color-border)] bg-white/[0.015] p-3 text-[11.5px] leading-relaxed text-[var(--color-fg-muted)]">
            Los certificados se firman con la wallet emisora y se anclan en Polygon. Recibirás un
            webhook cuando cada token esté emitido.
          </div>
        </aside>
      </div>

      {/* Lista de filas */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
        <div className="border-b border-[var(--color-border)] bg-white/[0.03] px-4 py-2.5 text-[12px] text-[var(--color-fg-subtle)]">
          Cola de emisión
        </div>
        <table className="w-full text-left text-[13px]">
          <thead className="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Estudiante</th>
              <th className="px-4 py-2 font-medium hidden sm:table-cell">Curso</th>
              <th className="px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
            {rows.slice(0, 8).map((_, i) => (
              <tr
                key={i}
                className={cn(
                  'hover:bg-white/[0.02] cursor-pointer',
                  i === previewIndex && 'bg-[var(--color-brand-500)]/5',
                )}
                onClick={() => setPreviewIndex(i)}
              >
                <td className="px-4 py-2 font-mono text-[11px] text-[var(--color-fg-subtle)]">
                  {i + 1}
                </td>
                <td className="px-4 py-2 text-[var(--color-fg)]">{valueFor('studentName', i)}</td>
                <td className="px-4 py-2 hidden sm:table-cell">{valueFor('courseName', i)}</td>
                <td className="px-4 py-2">
                  <Badge variant="warning">Pendiente</Badge>
                </td>
              </tr>
            ))}
            {rows.length > 8 && (
              <tr>
                <td colSpan={4} className="px-4 py-2 text-[11px] text-[var(--color-fg-subtle)]">
                  … {rows.length - 8} fila(s) más
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Auxiliares ────────────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">{title}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">{subtitle}</p>
    </div>
  );
}

function parseDelimitedText(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return { columns: [], rows: [] };
  const delimiter = detectDelimiter(cleaned);
  const matrix = parseRows(cleaned, delimiter).filter((row) => row.some((cell) => cell.trim()));
  const columns = (matrix[0] ?? []).map((header, index) => header.trim() || `columna_${index + 1}`);
  const rows = matrix.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    columns.forEach((column, index) => {
      row[column] = cells[index]?.trim() ?? '';
    });
    return row;
  });
  return { columns, rows };
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const candidates = [',', ';', '\t'];
  return candidates.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0]!;
}

function parseRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function autoMapColumns(columns: string[]) {
  const normalized = new Map(columns.map((column) => [normalizeColumn(column), column]));
  const find = (...names: string[]) => {
    for (const name of names) {
      const exact = normalized.get(normalizeColumn(name));
      if (exact) return exact;
      const partial = columns.find((column) =>
        normalizeColumn(column).includes(normalizeColumn(name)),
      );
      if (partial) return partial;
    }
    return undefined;
  };
  const mappings: Record<string, string> = {};
  const pairs: Array<[string, string | undefined]> = [
    ['studentName', find('nombre', 'student name', 'estudiante')],
    ['studentEmail', find('email', 'correo', 'mail')],
    ['walletAddress', find('wallet', 'wallet address', 'billetera')],
    ['courseName', find('curso', 'course', 'achievement')],
    ['certCode', find('puntaje', 'grade', 'score', 'nota')],
    ['instructor', find('instructor', 'docente', 'teacher')],
  ];
  for (const [field, column] of pairs) {
    if (column) mappings[field] = column;
  }
  return mappings;
}

function normalizeColumn(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function Tabs<T extends string>({
  items,
  active,
  onChange,
}: {
  items: { id: T; label: string; icon: typeof Plus }[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex gap-1 rounded-full border border-[var(--color-border)] bg-white/[0.02] p-1">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] transition-colors',
            active === it.id
              ? 'bg-[var(--color-brand-500)] text-white'
              : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
          )}
        >
          <it.icon className="h-3.5 w-3.5" />
          {it.label}
        </button>
      ))}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  title,
  hint,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
  icon: typeof Send;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors',
        active
          ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
      )}
    >
      <Icon className="h-4 w-4 text-[var(--color-brand-300)]" />
      <span className="text-[13px] font-semibold text-[var(--color-fg)]">{title}</span>
      <span className="text-[11px] text-[var(--color-fg-subtle)]">{hint}</span>
    </button>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white/[0.02] p-3">
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">{label}</p>
      <p className="mt-1 font-mono text-[15px] font-semibold text-[var(--color-fg)]">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[var(--color-fg-subtle)]">{hint}</p>}
    </div>
  );
}

function textSizeClass(size: FieldDef['size']) {
  switch (size) {
    case 'xl':
      return 'text-[22px]';
    case 'lg':
      return 'text-[15px]';
    case 'md':
      return 'text-[12px]';
    default:
      return 'text-[10px]';
  }
}

function CertificateCanvas({
  palette,
  templateName,
  backgroundUrl,
  layout,
  positions,
  editable = false,
  onMoveField,
  fieldFilter,
  renderField,
}: {
  palette: string;
  templateName: string;
  backgroundUrl?: string | null;
  layout?: Record<string, unknown> | null;
  positions: Record<string, { x: number; y: number }>;
  editable?: boolean;
  onMoveField?: (id: string, position: { x: number; y: number }) => void;
  fieldFilter?: (field: FieldDef) => boolean;
  renderField: (f: FieldDef) => ReactNode;
}) {
  const serialized = parseTemplateLayout(layout);
  const page = serialized?.pages[0];
  const blocks =
    serialized?.blocks.filter((block) => block.pageId === (page?.id ?? 'p1') && !block.hidden) ??
    [];
  const usesEditableLayout = Boolean(page && serialized);
  const aspectRatio = paperRatio(page?.paperId);
  const layoutFields = Array.from(
    new Map(
      blocks
        .map((block) => fieldForBlock(block))
        .filter((field): field is FieldDef => Boolean(field))
        .map((field) => [field.id, field]),
    ).values(),
  );
  const visibleFields = (usesEditableLayout ? layoutFields : FIELDS).filter((field) =>
    fieldFilter ? fieldFilter(field) : true,
  );

  return (
    <div
      data-certificate-canvas
      className={cn(
        'relative w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br shadow-2xl',
        usesEditableLayout ? layoutPalette(page?.paletteId) : palette,
      )}
      style={{
        aspectRatio,
        ...(page?.bgUrl
          ? {
              backgroundImage: `url(${page.bgUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : page?.bgGradient
            ? {
                backgroundImage: `linear-gradient(135deg, ${page.bgGradient.from}, ${page.bgGradient.to})`,
              }
            : page?.bgSolid
              ? { backgroundColor: page.bgSolid }
              : {}),
      }}
    >
      {!usesEditableLayout && backgroundUrl ? (
        <img src={backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
      ) : null}
      {!usesEditableLayout && !backgroundUrl ? (
        <>
          <div className="absolute inset-6 rounded-lg border border-white/15" />
          <div className="absolute inset-8 rounded-md border border-white/10" />
        </>
      ) : null}

      {!usesEditableLayout ? (
        <div className="absolute left-0 right-0 top-8 flex flex-col items-center text-center">
          <div className="text-[8px] uppercase tracking-[0.4em] text-white/50">
            Tessera · {templateName}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.3em] text-white/70">
            Certificado de finalización
          </div>
        </div>
      ) : null}

      {blocks.map((block) => (
        <TemplateBlock
          key={block.id}
          block={block}
          aspectRatio={aspectRatio}
          hideContent={Boolean(fieldForBlock(block))}
        />
      ))}

      {visibleFields.map((f) => {
        const position = positions[f.id] ?? { x: f.x, y: f.y };
        return (
          <div
            key={f.id}
            className={cn(
              'absolute z-20 -translate-x-1/2 -translate-y-1/2',
              editable && 'cursor-move touch-none',
            )}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            onPointerDown={(event) => {
              if (!editable || !onMoveField) return;
              event.preventDefault();
              const canvas = event.currentTarget.closest<HTMLElement>('[data-certificate-canvas]');
              if (!canvas) return;
              const move = (pointer: PointerEvent) => {
                const rect = canvas.getBoundingClientRect();
                onMoveField(f.id, {
                  x: Math.max(2, Math.min(98, ((pointer.clientX - rect.left) / rect.width) * 100)),
                  y: Math.max(2, Math.min(98, ((pointer.clientY - rect.top) / rect.height) * 100)),
                });
              };
              const stop = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', stop);
              };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', stop, { once: true });
            }}
          >
            {renderField(f)}
          </div>
        );
      })}

      {!usesEditableLayout ? (
        <div className="absolute bottom-6 left-1/2 inline-flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 text-white/50">
          <Sparkles className="h-5 w-5" />
        </div>
      ) : null}
    </div>
  );
}

type TemplatePage = {
  id: string;
  paperId?: string;
  paletteId?: string;
  bgUrl?: string | null;
  bgGradient?: { from: string; to: string } | null;
  bgSolid?: string | null;
};
type TemplateLayoutBlock = {
  id: string;
  pageId: string;
  kind: string;
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  color: string;
  opacity?: number;
  rotation?: number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  src?: string;
  fit?: 'contain' | 'cover' | 'fill';
  cropL?: number;
  cropR?: number;
  cropT?: number;
  cropB?: number;
  fontFamily?: string;
  letterSpacing?: number;
  textShadow?: boolean;
  hidden?: boolean;
};

function parseTemplateLayout(layout?: Record<string, unknown> | null) {
  if (!layout || !Array.isArray(layout.pages) || !Array.isArray(layout.blocks)) return null;
  return { pages: layout.pages as TemplatePage[], blocks: layout.blocks as TemplateLayoutBlock[] };
}

const FIELD_TOKENS: Record<string, string[]> = {
  studentName: ['{{nombre}}'],
  courseName: ['{{curso}}'],
  issuedDate: ['{{fecha}}'],
  certCode: ['{{tokenId}}', '{{puntaje}}', '{{serie}}', '{{folio}}'],
  instructor: ['{{instructor}}'],
};

function fieldForBlock(block: TemplateLayoutBlock) {
  return FIELDS.find((field) =>
    FIELD_TOKENS[field.id]?.some((token) => block.content?.includes(token)),
  );
}

function positionsFromLayout(layout?: Record<string, unknown> | null) {
  const parsed = parseTemplateLayout(layout);
  return Object.fromEntries(
    FIELDS.map((field) => {
      const block = parsed?.blocks.find((candidate) => fieldForBlock(candidate)?.id === field.id);
      return [field.id, block ? { x: block.x, y: block.y } : { x: field.x, y: field.y }];
    }),
  );
}

function paperRatio(paperId?: string) {
  const portrait = paperId?.endsWith('-p');
  if (paperId?.startsWith('a3')) return portrait ? 297 / 420 : 420 / 297;
  if (paperId?.startsWith('a5')) return portrait ? 148 / 210 : 210 / 148;
  if (paperId?.startsWith('letter')) return portrait ? 216 / 279 : 279 / 216;
  if (paperId?.startsWith('legal')) return portrait ? 216 / 356 : 356 / 216;
  return portrait ? 210 / 297 : 297 / 210;
}

function layoutPalette(paletteId?: string) {
  const palettes: Record<string, string> = {
    royal: 'from-[#142046] via-[#1d2f64] to-[#0b0f1f]',
    gold: 'from-[#1f1710] via-[#3a2a18] to-[#0c0d15]',
    forest: 'from-[#0e2019] via-[#1a4234] to-[#0b111a]',
    platinum: 'from-[#1a1e2b] via-[#2a3144] to-[#10131d]',
    paper: 'from-[#f5f3ee] via-[#ece7da] to-[#dad4c2]',
    ocean: 'from-[#03253d] via-[#0a4f72] to-[#021624]',
    crimson: 'from-[#2a0a14] via-[#5b1530] to-[#160508]',
    violet: 'from-[#1a0f2e] via-[#3a1f6b] to-[#0a0716]',
    graphite: 'from-[#1a1a1a] via-[#2c2c2c] to-[#0a0a0a]',
  };
  return palettes[paletteId ?? 'royal'] ?? palettes.royal;
}

function TemplateBlock({
  block,
  aspectRatio,
  hideContent,
}: {
  block: TemplateLayoutBlock;
  aspectRatio: number;
  hideContent: boolean;
}) {
  const referenceWidth = aspectRatio < 1 ? 780 : 1100;
  const referenceHeight = referenceWidth / aspectRatio;
  const style: React.CSSProperties = {
    left: `${block.x}%`,
    top: `${block.y}%`,
    width: `${(block.w / referenceWidth) * 100}%`,
    height: `${(block.h / referenceHeight) * 100}%`,
    color: block.color,
    opacity: block.opacity ?? 1,
    transform: `translate(-50%, -50%) rotate(${block.rotation ?? 0}deg)`,
    textAlign: block.align ?? 'center',
    fontSize: `${Math.max(7, block.size * 0.65)}px`,
    fontWeight: block.bold ? 700 : 400,
    fontStyle: block.italic ? 'italic' : 'normal',
    textDecoration: block.underline ? 'underline' : 'none',
    fontFamily: templateFontStack(block.fontFamily),
    letterSpacing: `${block.letterSpacing ?? 0}px`,
    textShadow: block.textShadow ? '0 2px 12px rgba(0,0,0,0.55)' : undefined,
    borderColor: block.borderColor,
    borderWidth: block.borderWidth,
    borderRadius: block.borderRadius,
  };
  if (block.kind === 'image' && block.src) {
    const cropL = block.cropL ?? 0;
    const cropR = block.cropR ?? 0;
    const cropT = block.cropT ?? 0;
    const cropB = block.cropB ?? 0;
    const visibleWidth = Math.max(0.05, 1 - cropL - cropR);
    const visibleHeight = Math.max(0.05, 1 - cropT - cropB);
    return (
      <div className="absolute overflow-hidden" style={style}>
        <img
          src={block.src}
          alt=""
          className="absolute"
          style={{
            width: `${100 / visibleWidth}%`,
            height: `${100 / visibleHeight}%`,
            left: `${(-100 * cropL) / visibleWidth}%`,
            top: `${(-100 * cropT) / visibleHeight}%`,
            objectFit: block.fit ?? 'fill',
          }}
        />
      </div>
    );
  }
  if (block.kind === 'divider' || block.kind === 'line') {
    return (
      <div
        className="absolute"
        style={{ ...style, height: Math.max(1, block.h), backgroundColor: block.color }}
      />
    );
  }
  if (block.kind === 'rect' || block.kind === 'circle') {
    return (
      <div
        className="absolute border-solid"
        style={{
          ...style,
          borderStyle: 'solid',
          backgroundColor: block.bgColor,
          borderRadius: block.kind === 'circle' ? '50%' : block.borderRadius,
        }}
      />
    );
  }
  if (block.kind === 'triangle' || block.kind === 'star' || block.kind === 'arrow') {
    const points =
      block.kind === 'triangle'
        ? '50,5 95,95 5,95'
        : '50,5 61,38 96,38 67,58 78,92 50,72 22,92 33,58 4,38 39,38';
    return (
      <svg
        className="absolute"
        viewBox={block.kind === 'arrow' ? '0 0 100 20' : '0 0 100 100'}
        preserveAspectRatio="none"
        style={style}
      >
        {block.kind === 'arrow' ? (
          <>
            <line
              x1="0"
              y1="10"
              x2="92"
              y2="10"
              stroke={block.bgColor ?? block.color}
              strokeWidth="2"
            />
            <polygon points="92,2 100,10 92,18" fill={block.bgColor ?? block.color} />
          </>
        ) : (
          <polygon
            points={points}
            fill={block.bgColor ?? block.color}
            stroke={block.borderColor}
            strokeWidth={block.borderWidth ?? 0}
          />
        )}
      </svg>
    );
  }
  if (block.kind === 'qr') {
    return (
      <div
        className="absolute rounded-md border border-slate-200 bg-white p-1 shadow-lg"
        style={style}
      >
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              'linear-gradient(45deg,#000 25%,transparent 25%),linear-gradient(-45deg,#000 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#000 75%),linear-gradient(-45deg,transparent 75%,#000 75%)',
            backgroundSize: '6px 6px',
            backgroundPosition: '0 0,0 3px,3px -3px,-3px 0',
          }}
        />
      </div>
    );
  }
  if (block.kind === 'seal') {
    return (
      <div
        className="absolute grid place-items-center rounded-full border-2 border-blue-100/45 font-bold"
        style={style}
      >
        {hideContent ? null : block.content}
      </div>
    );
  }
  if (block.kind === 'signature') {
    return (
      <div className="absolute flex flex-col items-end justify-center gap-1" style={style}>
        <div className="h-px w-full bg-current opacity-40" />
        {hideContent ? null : <span className="whitespace-nowrap">{block.content}</span>}
      </div>
    );
  }
  if (hideContent) return null;
  return (
    <div className="absolute flex items-center justify-center whitespace-nowrap" style={style}>
      {block.content}
    </div>
  );
}

function templateFontStack(font?: string) {
  const fonts: Record<string, string> = {
    serif: 'Georgia, "Times New Roman", serif',
    sans: 'Inter, system-ui, sans-serif',
    mono: '"JetBrains Mono", monospace',
    display: '"Playfair Display", Georgia, serif',
    script: '"Brush Script MT", "Lucida Handwriting", cursive',
    modern: '"Helvetica Neue", "Arial Black", sans-serif',
  };
  return fonts[font ?? 'sans'] ?? fonts.sans;
}
