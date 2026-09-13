'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toJpeg, toPng } from 'html-to-image';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpToLine,
  ArrowDownToLine,
  Bold,
  Circle,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  Grid3x3,
  Image as ImageIcon,
  Italic,
  Layers,
  Layout as LayoutIcon,
  Link2,
  Lock,
  LockOpen,
  Maximize2,
  Minus,
  Palette,
  Pencil,
  Plus,
  Printer,
  Redo2,
  RotateCw,
  Ruler,
  Save,
  Scissors,
  Square,
  Stamp,
  Star,
  Trash2,
  Triangle,
  Type,
  Underline,
  Undo2,
  Upload,
  Variable,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';
import { createTemplateAction, updateTemplateAction } from '../../actions';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type RibbonTab = 'archivo' | 'insertar' | 'diseno' | 'datos' | 'vista';
type SideTool = 'select' | 'layers' | 'data' | 'pages';
type BlockKind =
  | 'text'
  | 'placeholder'
  | 'signature'
  | 'qr'
  | 'seal'
  | 'divider'
  | 'rect'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'star'
  | 'triangle'
  | 'image';
type ShapeFill = 'solid' | 'outline' | 'glass';
type FontId = 'serif' | 'sans' | 'mono' | 'display' | 'script' | 'modern';
type SaveState = 'saved' | 'saving' | 'dirty';
type TemplateStatus = 'draft' | 'saving' | 'saved';
type PaperId =
  | 'a4-l'
  | 'a4-p'
  | 'a3-l'
  | 'a3-p'
  | 'a5-l'
  | 'a5-p'
  | 'letter-l'
  | 'letter-p'
  | 'legal-l'
  | 'legal-p'
  | 'tabloid-l'
  | 'tabloid-p'
  | 'b5-l'
  | 'b5-p'
  | 'executive-l'
  | 'executive-p';

interface PaperSize {
  id: PaperId;
  name: string;
  w: number; // mm
  h: number; // mm
  ratio: number; // w/h
  px: number; // ancho de referencia en px
}

interface Block {
  id: string;
  kind: BlockKind;
  label: string;
  content: string;
  x: number; // %
  y: number; // %
  w: number; // px
  h: number; // px
  rotation: number; // deg
  opacity: number; // 0..1
  size: number; // px tipografía
  align: 'left' | 'center' | 'right';
  color: string;
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  src?: string; // dataURL para imágenes
  fit?: 'contain' | 'cover' | 'fill';
  // Recorte de imagen en fracciones (0..1) desde cada lado
  cropL?: number;
  cropR?: number;
  cropT?: number;
  cropB?: number;
  // Dimensiones naturales de la imagen para preservar proporciones reales
  naturalW?: number;
  naturalH?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  letterSpacing?: number;
  textShadow?: boolean;
  fontFamily?: FontId;
  shapeFill?: ShapeFill;
  locked?: boolean;
  hidden?: boolean;
  pageId: string;
}

interface Page {
  id: string;
  name: string;
  paletteId: string;
  paperId: PaperId;
  bgUrl?: string | null;
  bgGradient?: { from: string; to: string } | null;
  bgSolid?: string | null;
}

interface Palette {
  id: string;
  name: string;
  className: string;
  swatch: [string, string];
}

const PALETTES: Palette[] = [
  {
    id: 'royal',
    name: 'Royal Navy',
    className: 'from-[#142046] via-[#1d2f64] to-[#0b0f1f]',
    swatch: ['#142046', '#1d2f64'],
  },
  {
    id: 'gold',
    name: 'Old Gold',
    className: 'from-[#1f1710] via-[#3a2a18] to-[#0c0d15]',
    swatch: ['#3a2a18', '#1f1710'],
  },
  {
    id: 'forest',
    name: 'Forest',
    className: 'from-[#0e2019] via-[#1a4234] to-[#0b111a]',
    swatch: ['#0e2019', '#1a4234'],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    className: 'from-[#1a1e2b] via-[#2a3144] to-[#10131d]',
    swatch: ['#1a1e2b', '#2a3144'],
  },
  {
    id: 'paper',
    name: 'Paper',
    className: 'from-[#f5f3ee] via-[#ece7da] to-[#dad4c2]',
    swatch: ['#f5f3ee', '#dad4c2'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    className: 'from-[#03253d] via-[#0a4f72] to-[#021624]',
    swatch: ['#0a4f72', '#03253d'],
  },
  {
    id: 'crimson',
    name: 'Crimson',
    className: 'from-[#2a0a14] via-[#5b1530] to-[#160508]',
    swatch: ['#5b1530', '#2a0a14'],
  },
  {
    id: 'violet',
    name: 'Violet',
    className: 'from-[#1a0f2e] via-[#3a1f6b] to-[#0a0716]',
    swatch: ['#3a1f6b', '#1a0f2e'],
  },
  {
    id: 'sand',
    name: 'Sand',
    className: 'from-[#f4ead7] via-[#e0cda1] to-[#b89968]',
    swatch: ['#f4ead7', '#b89968'],
  },
  {
    id: 'graphite',
    name: 'Graphite',
    className: 'from-[#1a1a1a] via-[#2c2c2c] to-[#0a0a0a]',
    swatch: ['#2c2c2c', '#1a1a1a'],
  },
  {
    id: 'mint',
    name: 'Mint',
    className: 'from-[#0a2e26] via-[#127a5f] to-[#062019]',
    swatch: ['#127a5f', '#0a2e26'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    className: 'from-[#3d1a0a] via-[#a44a1a] to-[#1f0a04]',
    swatch: ['#a44a1a', '#3d1a0a'],
  },
];

const FONT_FAMILIES: { id: FontId; label: string; value: string }[] = [
  { id: 'serif', label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { id: 'sans', label: 'Sans', value: '"Inter", system-ui, sans-serif' },
  { id: 'mono', label: 'Mono', value: '"JetBrains Mono", monospace' },
  { id: 'display', label: 'Display', value: '"Playfair Display", Georgia, serif' },
  { id: 'script', label: 'Script', value: '"Brush Script MT", "Lucida Handwriting", cursive' },
  { id: 'modern', label: 'Modern', value: '"Helvetica Neue", "Arial Black", sans-serif' },
];

const COLOR_SWATCHES = [
  '#ffffff',
  '#f5f5f5',
  '#cbd5e1',
  '#94a3b8',
  '#475569',
  '#1e293b',
  '#0a0a0a',
  '#fef3c7',
  '#fde047',
  '#facc15',
  '#f59e0b',
  '#d97706',
  '#92400e',
  '#fecaca',
  '#f87171',
  '#ef4444',
  '#dc2626',
  '#991b1b',
  '#dcfce7',
  '#86efac',
  '#22c55e',
  '#16a34a',
  '#15803d',
  '#dbeafe',
  '#60a5fa',
  '#3b82f6',
  '#1d4ed8',
  '#1e3a8a',
  '#e9d5ff',
  '#a855f7',
  '#7c3aed',
  '#5b21b6',
  '#fce7f3',
  '#f472b6',
  '#ec4899',
  '#be185d',
  '#cffafe',
  '#22d3ee',
  '#0891b2',
  '#155e75',
];

const VARIABLE_GROUPS: { label: string; tokens: string[] }[] = [
  { label: 'Estudiante', tokens: ['{{nombre}}', '{{wallet}}', '{{email}}'] },
  { label: 'Programa', tokens: ['{{curso}}', '{{instructor}}', '{{horas}}', '{{puntaje}}'] },
  { label: 'Institución', tokens: ['{{institucion}}', '{{ciudad}}', '{{rector}}'] },
  { label: 'Emisión', tokens: ['{{fecha}}', '{{tokenId}}', '{{serie}}', '{{folio}}'] },
];

const PAPER_SIZES: PaperSize[] = [
  { id: 'a4-l', name: 'A4 horizontal', w: 297, h: 210, ratio: 297 / 210, px: 1100 },
  { id: 'a4-p', name: 'A4 vertical', w: 210, h: 297, ratio: 210 / 297, px: 780 },
  { id: 'a3-l', name: 'A3 horizontal', w: 420, h: 297, ratio: 420 / 297, px: 1240 },
  { id: 'a3-p', name: 'A3 vertical', w: 297, h: 420, ratio: 297 / 420, px: 880 },
  { id: 'a5-l', name: 'A5 horizontal', w: 210, h: 148, ratio: 210 / 148, px: 920 },
  { id: 'a5-p', name: 'A5 vertical', w: 148, h: 210, ratio: 148 / 210, px: 660 },
  { id: 'b5-l', name: 'B5 horizontal', w: 250, h: 176, ratio: 250 / 176, px: 1000 },
  { id: 'b5-p', name: 'B5 vertical', w: 176, h: 250, ratio: 176 / 250, px: 720 },
  { id: 'letter-l', name: 'Letter horizontal', w: 279, h: 216, ratio: 279 / 216, px: 1080 },
  { id: 'letter-p', name: 'Letter vertical', w: 216, h: 279, ratio: 216 / 279, px: 820 },
  { id: 'legal-l', name: 'Legal horizontal', w: 356, h: 216, ratio: 356 / 216, px: 1180 },
  { id: 'legal-p', name: 'Legal vertical', w: 216, h: 356, ratio: 216 / 356, px: 760 },
  { id: 'tabloid-l', name: 'Tabloid horizontal', w: 432, h: 279, ratio: 432 / 279, px: 1280 },
  { id: 'tabloid-p', name: 'Tabloid vertical', w: 279, h: 432, ratio: 279 / 432, px: 860 },
  { id: 'executive-l', name: 'Executive horizontal', w: 267, h: 184, ratio: 267 / 184, px: 1040 },
  { id: 'executive-p', name: 'Executive vertical', w: 184, h: 267, ratio: 184 / 267, px: 760 },
];

const STARTER_PAGE: Page = { id: 'p1', name: 'Página 1', paletteId: 'royal', paperId: 'a4-l' };

const STARTER_BLOCKS: Block[] = [
  base('top-rule', 'divider', 'Ornamento superior', '', 50, 11, 1, 'center', '#8fb4ff', {
    w: 560,
    h: 1,
    opacity: 0.55,
  }),
  base('title', 'text', 'Título', 'CERTIFICADO DE FINALIZACIÓN', 50, 18, 16, 'center', '#edf4ff', {
    fontFamily: 'serif',
    bold: true,
    letterSpacing: 3,
  }),
  base('lead', 'text', 'Intro', 'Se otorga a', 50, 32, 12, 'center', '#bec7df', { italic: true }),
  base('name', 'placeholder', 'Nombre', '{{nombre}}', 50, 46, 36, 'center', '#ffffff', {
    fontFamily: 'display',
    bold: true,
    textShadow: true,
  }),
  base(
    'body',
    'text',
    'Cuerpo',
    'por completar satisfactoriamente el programa',
    50,
    60,
    12,
    'center',
    '#bec7df',
  ),
  base('course', 'placeholder', 'Curso', '{{curso}}', 50, 70, 20, 'center', '#f3f6ff', {
    fontFamily: 'serif',
    italic: true,
  }),
  base('divider', 'divider', 'Divisor', '', 50, 78, 1, 'center', '#9db5ff', {
    w: 320,
    h: 2,
  }),
  base('date', 'placeholder', 'Fecha', '{{fecha}}', 18, 88, 10, 'left', '#b0bad5'),
  base('signature', 'signature', 'Firma', 'Firma · {{instructor}}', 80, 88, 10, 'right', '#b0bad5'),
  base('bottom-rule', 'divider', 'Ornamento inferior', '', 50, 84, 1, 'center', '#8fb4ff', {
    w: 180,
    h: 1,
    opacity: 0.45,
  }),
  base('seal', 'seal', 'Sello', 'TSR', 12, 18, 12, 'center', '#ffffff', { w: 84, h: 84 }),
  base('qr', 'qr', 'QR', 'verify.tessera.io/{{tokenId}}', 88, 18, 8, 'center', '#ffffff', {
    w: 88,
    h: 88,
  }),
];

function base(
  id: string,
  kind: BlockKind,
  label: string,
  content: string,
  x: number,
  y: number,
  size: number,
  align: 'left' | 'center' | 'right',
  color: string,
  extra: Partial<Block> = {},
): Block {
  return {
    id,
    kind,
    label,
    content,
    x,
    y,
    w: 200,
    h: 40,
    rotation: 0,
    opacity: 1,
    size,
    align,
    color,
    pageId: 'p1',
    ...extra,
  };
}

interface TemplateEditorProps {
  initialTemplate?: {
    id: string;
    name: string;
    backgroundUrl: string | null;
    layout: Record<string, unknown> | null;
  } | null;
  returnTo?: string;
}

// ─── Componente ────────────────────────────────────────────────────────────────

export function TemplateEditor({ initialTemplate = null, returnTo }: TemplateEditorProps) {
  const router = useRouter();
  const [name, setName] = useState('Certificado institucional');
  const [tab, setTab] = useState<RibbonTab>('insertar');
  const [tool, setTool] = useState<SideTool>('select');
  const [pages, setPages] = useState<Page[]>([STARTER_PAGE]);
  const [activePageId, setActivePageId] = useState('p1');
  const [blocks, setBlocks] = useState<Block[]>(STARTER_BLOCKS);
  const [selectedId, setSelectedId] = useState<string>('name');
  const [zoom, setZoom] = useState(75);
  const [showRulers, setShowRulers] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [propPanelOpen, setPropPanelOpen] = useState(true);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [cropMode, setCropMode] = useState<string | null>(null); // id del bloque imagen en modo recorte
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [templateStatus, setTemplateStatus] = useState<TemplateStatus>(
    initialTemplate ? 'saved' : 'draft',
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Historia para undo/redo
  const historyRef = useRef<{ pages: Page[]; blocks: Block[] }[]>([]);
  const futureRef = useRef<{ pages: Page[]; blocks: Block[] }[]>([]);
  const skipNext = useRef(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const imgFileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const clipboardRef = useRef<Block | null>(null);
  const autosaveHydratedRef = useRef(false);
  const dragRef = useRef<{
    id: string;
    mode: 'move' | 'resize' | 'rotate' | 'crop';
    handle?: string;
    startX: number;
    startY: number;
    orig: Block;
  } | null>(null);

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) ?? pages[0]!,
    [pages, activePageId],
  );
  const palette = useMemo(
    () => PALETTES.find((p) => p.id === activePage.paletteId) ?? PALETTES[0]!,
    [activePage.paletteId],
  );
  const paper = useMemo(
    () => PAPER_SIZES.find((p) => p.id === activePage.paperId) ?? PAPER_SIZES[0]!,
    [activePage.paperId],
  );
  const pageBlocks = useMemo(
    () => blocks.filter((b) => b.pageId === activePageId && !b.hidden),
    [blocks, activePageId],
  );
  const selected = useMemo(
    () => blocks.find((b) => b.id === selectedId) ?? null,
    [blocks, selectedId],
  );
  const draftKey = initialTemplate
    ? `tessera.template-editor:${initialTemplate.id}`
    : 'tessera.template-editor';

  const saveLabel =
    saveState === 'saving'
      ? 'Guardando'
      : saveState === 'dirty'
        ? 'Cambios sin guardar'
        : lastSavedAt
          ? `Guardado ${lastSavedAt.toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : 'Guardado';

  const templateStatusLabel =
    templateStatus === 'saved'
      ? 'Guardado'
      : templateStatus === 'saving'
        ? 'Guardando'
        : 'Borrador';

  const serializeTemplate = useCallback(
    () => ({
      name,
      pages: pages.map((p) => ({
        ...p,
        bgUrl: p.bgUrl?.startsWith('data:') ? p.bgUrl : null,
      })),
      blocks,
    }),
    [name, pages, blocks],
  );

  // Snapshot de historia antes de cada cambio
  const pushHistory = useCallback(() => {
    historyRef.current.push({ pages: structuredClone(pages), blocks: structuredClone(blocks) });
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
  }, [pages, blocks]);

  function undo() {
    const prev = historyRef.current.pop();
    if (!prev) return;
    futureRef.current.push({ pages: structuredClone(pages), blocks: structuredClone(blocks) });
    skipNext.current = true;
    setPages(prev.pages);
    setBlocks(prev.blocks);
  }

  function redo() {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push({ pages: structuredClone(pages), blocks: structuredClone(blocks) });
    skipNext.current = true;
    setPages(next.pages);
    setBlocks(next.blocks);
  }

  // Atajos de teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selected) {
        e.preventDefault();
        duplicate();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selected) {
        e.preventDefault();
        clipboardRef.current = { ...selected };
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && selected) {
        e.preventDefault();
        clipboardRef.current = { ...selected };
        remove();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clipboardRef.current) {
        e.preventDefault();
        const src = clipboardRef.current;
        const id = `${src.kind}-${Date.now()}`;
        const dup: Block = {
          ...src,
          id,
          x: clamp(src.x + 4, 4, 96),
          y: clamp(src.y + 4, 4, 96),
          pageId: activePageId,
        };
        pushHistory();
        setBlocks((bs) => [...bs, dup]);
        setSelectedId(id);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        persist();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        setZoom((z) => Math.min(400, z + 10));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setZoom((z) => Math.max(20, z - 10));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoom(75);
        return;
      }
      if (e.key === 'Escape') {
        if (cropMode) setCropMode(null);
        else setSelectedId('');
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault();
        remove();
        return;
      }
      if (selected && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        nudge(dx, dy);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, blocks, pages, activePageId, cropMode]);

  // Wheel zoom (Ctrl + rueda / pinch trackpad)
  useEffect(() => {
    const node = canvasWrapperRef.current;
    if (!node) return;
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => clamp(z - Math.sign(e.deltaY) * 5, 20, 400));
    }
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  // Autosave en localStorage
  useEffect(() => {
    if (!autosaveHydratedRef.current) return;
    setSaveState('dirty');
    const t = setTimeout(() => {
      try {
        setSaveState('saving');
        localStorage.setItem(draftKey, JSON.stringify(serializeTemplate()));
        setLastSavedAt(new Date());
        setSaveState('saved');
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [name, pages, blocks, serializeTemplate, draftKey]);

  // Restaurar al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const data = JSON.parse(raw) as { name?: string; pages?: Page[]; blocks?: Block[] };
        if (data.pages?.length && data.blocks) {
          // Filtra imágenes corruptas (sin src o con blob URL caducada)
          const cleaned = data.blocks
            .filter(
              (b) =>
                b.id !== 'halo' && (b.kind !== 'image' || (b.src && b.src.startsWith('data:'))),
            )
            .map(normalizeBlock);
          setName(data.name ?? 'Certificado institucional');
          setPages(data.pages);
          setBlocks(cleaned);
          setActivePageId(data.pages[0]!.id);
          setSelectedId('');
        }
      } else if (initialTemplate?.layout && isSerializedTemplate(initialTemplate.layout)) {
        const cleaned = initialTemplate.layout.blocks
          .filter(
            (b) => b.id !== 'halo' && (b.kind !== 'image' || (b.src && b.src.startsWith('data:'))),
          )
          .map(normalizeBlock);
        setName(initialTemplate.layout.name ?? initialTemplate.name);
        setPages(initialTemplate.layout.pages);
        setBlocks(cleaned);
        setActivePageId(initialTemplate.layout.pages[0]?.id ?? STARTER_PAGE.id);
        setSelectedId('');
      } else if (initialTemplate) {
        setName(initialTemplate.name);
        setPages([
          {
            ...STARTER_PAGE,
            bgUrl: initialTemplate.backgroundUrl,
            bgGradient: null,
            bgSolid: null,
          },
        ]);
        setBlocks([]);
        setActivePageId(STARTER_PAGE.id);
        setSelectedId('');
      }
    } catch {}
    autosaveHydratedRef.current = true;
  }, [draftKey, initialTemplate]);

  function persist() {
    try {
      setSaveState('saving');
      localStorage.setItem(draftKey, JSON.stringify(serializeTemplate()));
      setLastSavedAt(new Date());
      setSaveState('saved');
    } catch {}
  }

  async function captureCertificate(
    format: 'jpeg' | 'png' = 'png',
    options: { pixelRatio?: number; quality?: number } = {},
  ) {
    const node = canvasRef.current;
    if (!node) throw new Error('No se encontró el certificado para exportar.');
    const previousSelectedId = selectedId;
    const previousCropMode = cropMode;
    const previousMaxWidth = node.style.maxWidth;

    setExporting(true);
    setSelectedId('');
    setCropMode(null);
    node.style.maxWidth = 'none';

    try {
      await nextFrame();
      await nextFrame();
      const pixelRatio = options.pixelRatio ?? 2;
      return format === 'jpeg'
        ? await toJpeg(node, {
            quality: options.quality ?? 0.95,
            pixelRatio,
            backgroundColor: '#081127',
            cacheBust: true,
          })
        : await toPng(node, {
            pixelRatio,
            backgroundColor: '#081127',
            cacheBust: true,
          });
    } finally {
      node.style.maxWidth = previousMaxWidth;
      setSelectedId(previousSelectedId);
      setCropMode(previousCropMode);
      setExporting(false);
    }
  }

  async function saveTemplateAndExit() {
    if (templateStatus === 'saving') return;
    setTemplateStatus('saving');
    setSaveState('saving');
    try {
      const thumbnail = await captureCertificate('jpeg', { pixelRatio: 0.55, quality: 0.82 });
      const form = new FormData();
      form.set('name', name.trim() || 'Certificado institucional');
      form.set('backgroundUrl', thumbnail);
      form.set('layout', JSON.stringify(serializeTemplate()));
      const res = initialTemplate
        ? await updateTemplateAction(initialTemplate.id, form)
        : await createTemplateAction(form);
      if (!res.ok) {
        setTemplateStatus('draft');
        setSaveState('dirty');
        alert(res.error);
        return;
      }
      localStorage.removeItem('tessera.template-editor');
      if (res.data?.id) localStorage.removeItem(`tessera.template-editor:${res.data.id}`);
      setTemplateStatus('saved');
      setSaveState('saved');
      setLastSavedAt(new Date());
      setPages([STARTER_PAGE]);
      setBlocks(STARTER_BLOCKS);
      setActivePageId(STARTER_PAGE.id);
      setSelectedId('name');
      const destination = returnTo
        ? returnTo.replace('{templateId}', encodeURIComponent(res.data!.id))
        : '/institution/templates';
      router.push(destination);
      router.refresh();
    } catch {
      setTemplateStatus('draft');
      setSaveState('dirty');
      alert('No se pudo guardar la plantilla.');
    }
  }

  async function previewCertificate() {
    try {
      setPreviewUrl(await captureCertificate('png'));
    } catch {
      alert('No se pudo generar la vista previa.');
    }
  }

  async function downloadPng() {
    try {
      const dataUrl = await captureCertificate('png');
      downloadDataUrl(dataUrl, `${slugify(name)}.png`);
    } catch {
      alert('No se pudo descargar la imagen.');
    }
  }

  async function downloadPdf() {
    try {
      const dataUrl = await captureCertificate('jpeg');
      const imageSize = await getImageSize(dataUrl);
      const pdf = buildJpegPdf(dataUrl, paper, imageSize, serializeTemplate());
      downloadBlob(new Blob([pdf], { type: 'application/pdf' }), `${slugify(name)}.pdf`);
    } catch {
      alert('No se pudo generar el PDF.');
    }
  }

  async function printCertificate() {
    try {
      const dataUrl = await captureCertificate('png');
      const frame = document.createElement('iframe');
      frame.title = 'Impresión del certificado';
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.style.border = '0';
      frame.style.opacity = '0';
      frame.srcdoc = `
        <!doctype html>
        <html>
          <head>
            <title>${escapeHtml(name)}</title>
            <style>
              @page { size: ${paper.w}mm ${paper.h}mm; margin: 0; }
              * { box-sizing: border-box; }
              html, body {
                width: ${paper.w}mm;
                height: ${paper.h}mm;
                margin: 0;
                background: #fff;
              }
              img {
                display: block;
                width: ${paper.w}mm;
                height: ${paper.h}mm;
              }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" alt="${escapeHtml(name)}" />
            <script>
              window.onload = () => {
                window.focus();
                window.print();
              };
            </script>
          </body>
        </html>
      `;
      const removeFrame = () => {
        setTimeout(() => frame.remove(), 250);
      };
      frame.onload = () => {
        const printWindow = frame.contentWindow;
        if (!printWindow) {
          removeFrame();
          return;
        }
        printWindow.onafterprint = removeFrame;
        printWindow.focus();
        printWindow.print();
        setTimeout(removeFrame, 3000);
      };
      document.body.appendChild(frame);
    } catch {
      alert('No se pudo preparar la impresión.');
    }
  }

  function commitColor(c: string) {
    setRecentColors((rc) => [c, ...rc.filter((x) => x !== c)].slice(0, 8));
  }

  function update(patch: Partial<Block>) {
    if (!selected) return;
    pushHistory();
    setBlocks((bs) => bs.map((b) => (b.id === selected.id ? { ...b, ...patch } : b)));
    if (patch.color) commitColor(patch.color);
    if (patch.bgColor) commitColor(patch.bgColor);
  }

  function updateBlockById(id: string, patch: Partial<Block>) {
    pushHistory();
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function addBlock(kind: BlockKind, opts: Partial<Block> = {}) {
    pushHistory();
    const id = `${kind}-${Date.now()}`;
    const defaults: Partial<Block> =
      kind === 'rect'
        ? {
            w: 180,
            h: 100,
            bgColor: '#ffffff20',
            borderColor: '#ffffff60',
            borderWidth: 1,
            shapeFill: 'glass',
          }
        : kind === 'circle'
          ? {
              w: 120,
              h: 120,
              bgColor: '#ffffff20',
              borderColor: '#ffffff60',
              borderWidth: 1,
              shapeFill: 'glass',
            }
          : kind === 'line'
            ? { w: 220, h: 2, bgColor: '#ffffff80' }
            : kind === 'arrow'
              ? { w: 220, h: 16, bgColor: '#ffffff80' }
              : kind === 'star'
                ? { w: 80, h: 80, bgColor: '#facc15' }
                : kind === 'triangle'
                  ? { w: 100, h: 90, bgColor: '#ffffff40', borderColor: '#ffffff', borderWidth: 1 }
                  : kind === 'qr'
                    ? { w: 88, h: 88 }
                    : kind === 'seal'
                      ? { w: 84, h: 84 }
                      : kind === 'divider'
                        ? { w: 280, h: 2 }
                        : {};
    const next: Block = {
      id,
      kind,
      label:
        kind === 'placeholder'
          ? 'Variable'
          : kind === 'signature'
            ? 'Firma'
            : kind === 'seal'
              ? 'Sello'
              : kind === 'qr'
                ? 'QR'
                : kind === 'divider'
                  ? 'Divisor'
                  : kind === 'rect'
                    ? 'Rectángulo'
                    : kind === 'circle'
                      ? 'Círculo'
                      : kind === 'line'
                        ? 'Línea'
                        : kind === 'arrow'
                          ? 'Flecha'
                          : kind === 'star'
                            ? 'Estrella'
                            : kind === 'triangle'
                              ? 'Triángulo'
                              : kind === 'image'
                                ? 'Imagen'
                                : 'Texto',
      content:
        kind === 'placeholder'
          ? '{{campo}}'
          : kind === 'signature'
            ? 'Firma · {{instructor}}'
            : kind === 'seal'
              ? 'TSR'
              : kind === 'qr'
                ? 'verify.tessera.io/{{tokenId}}'
                : kind === 'text'
                  ? 'Nuevo texto'
                  : '',
      x: 50,
      y: 50,
      w: 200,
      h: 40,
      rotation: 0,
      opacity: 1,
      size: kind === 'placeholder' ? 18 : 12,
      align: 'center',
      color: '#ffffff',
      pageId: activePageId,
      ...defaults,
      ...opts,
    };
    setBlocks((bs) => [...bs, next]);
    setSelectedId(id);
    setTool('select');
    setPropPanelOpen(true);
  }

  function duplicate() {
    if (!selected) return;
    pushHistory();
    const dup: Block = {
      ...selected,
      id: `${selected.id}-${Date.now()}`,
      x: clamp(selected.x + 4, 4, 96),
      y: clamp(selected.y + 4, 4, 96),
    };
    setBlocks((bs) => [...bs, dup]);
    setSelectedId(dup.id);
  }

  function remove() {
    if (!selected) return;
    pushHistory();
    const remaining = blocks.filter((b) => b.id !== selected.id);
    setBlocks(remaining);
    setSelectedId(remaining.find((b) => b.pageId === activePageId)?.id ?? '');
  }

  function nudge(dx: number, dy: number) {
    if (!selected) return;
    update({ x: clamp(selected.x + dx, 0, 100), y: clamp(selected.y + dy, 0, 100) });
  }

  function moveZ(delta: number | 'top' | 'bottom') {
    if (!selected) return;
    pushHistory();
    setBlocks((bs) => {
      const idx = bs.findIndex((b) => b.id === selected.id);
      if (idx < 0) return bs;
      const copy = [...bs];
      const [item] = copy.splice(idx, 1);
      if (delta === 'top') copy.push(item!);
      else if (delta === 'bottom') copy.unshift(item!);
      else copy.splice(clamp(idx + delta, 0, copy.length), 0, item!);
      return copy;
    });
  }

  function toggleLock(id: string) {
    updateBlockById(id, { locked: !blocks.find((b) => b.id === id)?.locked });
  }
  function toggleHide(id: string) {
    updateBlockById(id, { hidden: !blocks.find((b) => b.id === id)?.hidden });
  }

  function insertVariable(token: string) {
    if (selected && (selected.kind === 'text' || selected.kind === 'placeholder')) {
      update({
        content: `${selected.content}${selected.content ? ' ' : ''}${token}`,
        kind: 'placeholder',
      });
      return;
    }
    addBlock('placeholder', { content: token });
  }

  function setPalette(p: Palette) {
    pushHistory();
    setPages((ps) =>
      ps.map((pg) =>
        pg.id === activePageId
          ? { ...pg, paletteId: p.id, bgUrl: null, bgGradient: null, bgSolid: null }
          : pg,
      ),
    );
  }

  function setBgGradient(from: string, to: string) {
    pushHistory();
    setPages((ps) =>
      ps.map((pg) =>
        pg.id === activePageId
          ? { ...pg, bgGradient: { from, to }, bgUrl: null, bgSolid: null }
          : pg,
      ),
    );
  }

  function setBgSolid(c: string) {
    pushHistory();
    setPages((ps) =>
      ps.map((pg) =>
        pg.id === activePageId ? { ...pg, bgSolid: c, bgUrl: null, bgGradient: null } : pg,
      ),
    );
  }

  function handleBgUpload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Por ahora el fondo debe ser una imagen.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pushHistory();
      const url = reader.result as string;
      setPages((ps) =>
        ps.map((pg) =>
          pg.id === activePageId ? { ...pg, bgUrl: url, bgGradient: null, bgSolid: null } : pg,
        ),
      );
    };
    reader.readAsDataURL(file);
  }

  function handleImageUpload(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxW = 280;
        const ratio = img.width / img.height || 1;
        const w = Math.min(maxW, img.width);
        const h = w / ratio;
        addBlock('image', {
          src: dataUrl,
          w,
          h,
          fit: 'cover',
          label: file.name.split('.')[0] || 'Imagen',
          borderRadius: 0,
          naturalW: img.width,
          naturalH: img.height,
          cropL: 0,
          cropR: 0,
          cropT: 0,
          cropB: 0,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function resetCrop() {
    if (!selected || selected.kind !== 'image') return;
    pushHistory();
    setBlocks((bs) =>
      bs.map((b) => (b.id === selected.id ? { ...b, cropL: 0, cropR: 0, cropT: 0, cropB: 0 } : b)),
    );
  }

  function fitImageToNatural() {
    if (!selected || selected.kind !== 'image' || !selected.naturalW || !selected.naturalH) return;
    pushHistory();
    const visW = 1 - (selected.cropL ?? 0) - (selected.cropR ?? 0);
    const visH = 1 - (selected.cropT ?? 0) - (selected.cropB ?? 0);
    const ratio = (selected.naturalW * visW) / (selected.naturalH * visH);
    const newH = Math.round(selected.w / ratio);
    setBlocks((bs) => bs.map((b) => (b.id === selected.id ? { ...b, h: Math.max(20, newH) } : b)));
  }

  function setPaper(id: PaperId) {
    pushHistory();
    setPages((ps) => ps.map((pg) => (pg.id === activePageId ? { ...pg, paperId: id } : pg)));
  }

  function addPage() {
    pushHistory();
    const id = `p${Date.now()}`;
    setPages((ps) => [
      ...ps,
      { id, name: `Página ${ps.length + 1}`, paletteId: palette.id, paperId: paper.id },
    ]);
    setActivePageId(id);
  }

  function removePage(id: string) {
    if (pages.length <= 1) return;
    pushHistory();
    const remaining = pages.filter((p) => p.id !== id);
    setPages(remaining);
    setBlocks((bs) => bs.filter((b) => b.pageId !== id));
    if (activePageId === id) setActivePageId(remaining[0]!.id);
  }

  function fitToScreen() {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;
    const availableW = Math.max(320, wrapper.clientWidth - 96);
    const availableH = Math.max(240, wrapper.clientHeight - 96);
    const pageW = paper.px;
    const pageH = Math.round(paper.px / paper.ratio);
    const next = Math.floor(Math.min((availableW / pageW) * 100, (availableH / pageH) * 100));
    setZoom(clamp(next, 25, 200));
  }

  // Drag / resize / rotate
  function startInteraction(
    e: React.PointerEvent,
    id: string,
    mode: 'move' | 'resize' | 'rotate' | 'crop',
    handle?: string,
  ) {
    e.stopPropagation();
    const block = blocks.find((b) => b.id === id);
    if (!block || block.locked) return;
    setSelectedId(id);
    setPropPanelOpen(true);
    pushHistory();
    dragRef.current = {
      id,
      mode,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...block },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !canvasRef.current) return;
    const { id, mode, handle, startX, startY, orig } = dragRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const dxPx = e.clientX - startX;
    const dyPx = e.clientY - startY;
    const dxPct = (dxPx / rect.width) * 100;
    const dyPct = (dyPx / rect.height) * 100;
    const zoomScale = zoom / 100;
    const dxCanvas = zoomScale > 0 ? dxPx / zoomScale : dxPx;
    const dyCanvas = zoomScale > 0 ? dyPx / zoomScale : dyPx;

    if (mode === 'move') {
      let nx = clamp(orig.x + dxPct, 0, 100);
      let ny = clamp(orig.y + dyPct, 0, 100);
      if (snapToGrid) {
        nx = Math.round(nx / 5) * 5;
        ny = Math.round(ny / 5) * 5;
      }
      setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, x: nx, y: ny } : b)));
    } else if (mode === 'resize') {
      const sx = handle?.includes('e') ? 1 : handle?.includes('w') ? -1 : 0;
      const sy = handle?.includes('s') ? 1 : handle?.includes('n') ? -1 : 0;
      let nw = Math.max(20, orig.w + sx * dxCanvas);
      let nh = Math.max(8, orig.h + sy * dyCanvas);
      // Bloqueo de proporción: Shift en cualquier elemento, o siempre para imágenes desde esquina
      const corner = !!sx && !!sy;
      const lockAspect = e.shiftKey || (orig.kind === 'image' && corner && !e.altKey);
      if (lockAspect && orig.w > 0 && orig.h > 0) {
        const ratio = orig.w / orig.h;
        // usar la dimensión que más cambió en magnitud relativa
        const wChange = Math.abs(nw - orig.w) / orig.w;
        const hChange = Math.abs(nh - orig.h) / orig.h;
        if (wChange > hChange) nh = nw / ratio;
        else nw = nh * ratio;
      }
      setBlocks((bs) =>
        bs.map((b) =>
          b.id === id
            ? {
                ...b,
                w: Math.round(nw),
                h: Math.round(nh),
                ...(isTextLikeBlock(orig)
                  ? {
                      size: Math.round(
                        clamp(
                          orig.size *
                            Math.max(
                              sx ? nw / Math.max(1, orig.w) : 1,
                              sy ? nh / Math.max(1, orig.h) : 1,
                            ),
                          4,
                          120,
                        ),
                      ),
                    }
                  : {}),
                x: sx ? clamp(orig.x + dxPct / 2, 0, 100) : orig.x,
                y: sy ? clamp(orig.y + dyPct / 2, 0, 100) : orig.y,
              }
            : b,
        ),
      );
    } else if (mode === 'crop') {
      // handle: cropL | cropR | cropT | cropB (arrastra bordes para recortar)
      const fracX = dxPx / orig.w;
      const fracY = dyPx / orig.h;
      const cur = {
        cropL: orig.cropL ?? 0,
        cropR: orig.cropR ?? 0,
        cropT: orig.cropT ?? 0,
        cropB: orig.cropB ?? 0,
      };
      let { cropL, cropR, cropT, cropB } = cur;
      if (handle === 'cropL') cropL = clamp(cur.cropL + fracX, 0, 1 - cur.cropR - 0.05);
      if (handle === 'cropR') cropR = clamp(cur.cropR - fracX, 0, 1 - cur.cropL - 0.05);
      if (handle === 'cropT') cropT = clamp(cur.cropT + fracY, 0, 1 - cur.cropB - 0.05);
      if (handle === 'cropB') cropB = clamp(cur.cropB - fracY, 0, 1 - cur.cropT - 0.05);
      setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, cropL, cropR, cropT, cropB } : b)));
    } else if (mode === 'rotate') {
      const node = document.getElementById(`blk-${id}`);
      if (!node) return;
      const r = node.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
      setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, rotation: Math.round(angle) } : b)));
    }
  }

  function endInteraction() {
    dragRef.current = null;
  }

  return (
    <div className="flex h-screen flex-col bg-[#050a18] text-[var(--color-fg)]">
      {/* ── Titlebar ── */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-blue-400/[0.14] bg-[#070d21] px-4 text-[12px] shadow-[0_18px_54px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-3">
          <Link
            href="/institution/templates"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-300/[0.12] bg-blue-300/[0.04] text-[var(--color-fg-muted)] transition hover:border-blue-300/[0.25] hover:bg-blue-300/[0.08] hover:text-[var(--color-fg)]"
            title="Cerrar editor"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-accent-500))] text-[10px] font-bold text-[#08111f] shadow-[0_0_28px_rgba(43,217,154,0.22)]">
              T
            </div>
            <span className="font-semibold tracking-[-0.01em]">Tessera Editor</span>
          </div>
          <span className="text-[var(--color-fg-subtle)]">·</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-[260px] rounded-lg border border-blue-300/[0.10] bg-white/[0.025] px-2.5 py-1.5 text-[12px] text-[var(--color-fg)] transition hover:border-blue-300/[0.20] hover:bg-white/[0.04] focus:border-blue-400/70 focus:bg-white/[0.05] focus:outline-none"
          />
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
              templateStatus === 'saved'
                ? 'bg-emerald-500/10 text-emerald-300'
                : templateStatus === 'saving'
                  ? 'bg-blue-500/10 text-blue-300'
                  : 'bg-amber-500/15 text-amber-300',
            )}
          >
            {templateStatusLabel}
          </span>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
              saveState === 'saved'
                ? 'bg-emerald-500/10 text-emerald-300'
                : saveState === 'saving'
                  ? 'bg-blue-500/10 text-blue-300'
                  : 'bg-amber-500/10 text-amber-300',
            )}
          >
            {saveLabel}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <IconBtn
            icon={Undo2}
            title="Deshacer (Ctrl+Z)"
            onClick={undo}
            disabled={historyRef.current.length === 0}
          />
          <IconBtn
            icon={Redo2}
            title="Rehacer (Ctrl+Y)"
            onClick={redo}
            disabled={futureRef.current.length === 0}
          />
          <Sep />
          <IconBtn icon={Printer} title="Imprimir certificado" onClick={printCertificate} />
          <IconBtn icon={Download} title="Descargar PDF" onClick={downloadPdf} />
          <Sep />
          <IconBtn icon={Eye} title="Vista previa" onClick={previewCertificate} />
          <button
            type="button"
            onClick={saveTemplateAndExit}
            disabled={templateStatus === 'saving'}
            className="ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#2563eb,#4f46e5)] px-3.5 text-[12px] font-semibold text-white shadow-[0_0_28px_rgba(37,99,235,0.28)] transition hover:brightness-110"
          >
            <Save className="h-3.5 w-3.5" /> {templateStatus === 'saving' ? 'Guardando' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* ── Ribbon: tabs ── */}
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-blue-300/[0.10] bg-[#081127] px-3 text-[12px]">
        {(['archivo', 'insertar', 'diseno', 'datos', 'vista'] as RibbonTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-3 py-1.5 capitalize transition-colors',
              tab === t
                ? 'bg-white/[0.08] text-[var(--color-fg)] shadow-inner shadow-white/[0.03]'
                : 'text-[var(--color-fg-muted)] hover:bg-white/[0.04] hover:text-[var(--color-fg)]',
            )}
          >
            {t === 'diseno' ? 'Diseño' : t}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[var(--color-fg-subtle)]">
          <span>
            {paper.name} · {paper.w} × {paper.h} mm
          </span>
          <Sep />
          <button
            onClick={() => setPropPanelOpen((v) => !v)}
            className="rounded px-2 py-1 hover:bg-white/[0.05] hover:text-[var(--color-fg)]"
          >
            {propPanelOpen ? 'Ocultar panel' : 'Mostrar panel'}
          </button>
        </div>
      </div>

      {/* ── Ribbon contenido ── */}
      <div className="flex h-[82px] shrink-0 items-center gap-2 overflow-x-auto border-b border-blue-300/[0.10] bg-[linear-gradient(180deg,#101a3a,#0a1228)] px-3 shadow-[0_14px_40px_rgba(0,0,0,0.22)] scrollbar-thin">
        {tab === 'archivo' && (
          <RibbonArchivo
            onUpload={() => fileRef.current?.click()}
            onSave={saveTemplateAndExit}
            onPreview={previewCertificate}
            onDownloadPdf={downloadPdf}
            onDownloadPng={downloadPng}
            onPrint={printCertificate}
          />
        )}
        {tab === 'insertar' && (
          <RibbonInsertar onAdd={addBlock} onUploadImg={() => imgFileRef.current?.click()} />
        )}
        {tab === 'diseno' && (
          <RibbonDiseno
            palette={palette}
            onPalette={setPalette}
            onUploadBg={() => fileRef.current?.click()}
            onGradient={setBgGradient}
            onSolid={setBgSolid}
            paper={paper}
            onPaper={setPaper}
          />
        )}
        {tab === 'datos' && <RibbonDatos onInsert={insertVariable} />}
        {tab === 'vista' && (
          <RibbonVista
            zoom={zoom}
            setZoom={setZoom}
            showRulers={showRulers}
            setShowRulers={setShowRulers}
            showGrid={showGrid}
            setShowGrid={setShowGrid}
            snap={snapToGrid}
            setSnap={setSnapToGrid}
          />
        )}
        <RibbonGroup label="Paneles">
          <RibbonBigBtn icon={Layers} label="Capas" onClick={() => setTool('layers')} />
          <RibbonBigBtn icon={Database} label="Variables" onClick={() => setTool('data')} />
          <RibbonBigBtn icon={LayoutIcon} label="Plantillas" onClick={() => setTool('pages')} />
        </RibbonGroup>
      </div>

      {/* ── Cuerpo ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Lienzo */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#142553_0%,#0a1127_38%,#060b18_100%)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(96,165,250,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.10) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          {showRulers && (
            <>
              <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-5 border-b border-white/[0.08] bg-[#0c1022]/90 backdrop-blur" />
              <div className="pointer-events-none absolute bottom-7 left-0 top-5 z-10 w-5 border-r border-white/[0.08] bg-[#0c1022]/90 backdrop-blur" />
            </>
          )}

          <div
            ref={canvasWrapperRef}
            className="relative flex flex-1 items-start justify-center overflow-auto p-14"
          >
            <div
              className="rounded-2xl bg-[#030712]/45 p-6 shadow-[0_44px_160px_rgba(0,0,0,0.50)] ring-1 ring-blue-300/[0.10] transition-transform duration-200"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center top' }}
            >
              <div
                ref={canvasRef}
                onPointerMove={onPointerMove}
                onPointerUp={endInteraction}
                onClick={() => setSelectedId('')}
                className={cn(
                  'relative overflow-hidden rounded-[10px] border border-blue-400/25 bg-gradient-to-br shadow-[0_32px_90px_rgba(0,0,0,0.58)] ring-1 ring-white/[0.08]',
                  !activePage.bgUrl && !activePage.bgGradient && !activePage.bgSolid
                    ? palette.className
                    : '',
                )}
                style={{
                  width: `${paper.px}px`,
                  height: `${Math.round(paper.px / paper.ratio)}px`,
                  maxWidth: '90vw',
                  ...(activePage.bgUrl
                    ? {
                        backgroundImage: `url(${activePage.bgUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : activePage.bgGradient
                      ? {
                          backgroundImage: `linear-gradient(135deg, ${activePage.bgGradient.from}, ${activePage.bgGradient.to})`,
                        }
                      : activePage.bgSolid
                        ? { backgroundColor: activePage.bgSolid }
                        : {}),
                }}
              >
                {!activePage.bgUrl && (
                  <>
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          'radial-gradient(circle at 50% 40%, rgba(96,165,250,0.18), transparent 38%), radial-gradient(circle at 78% 52%, rgba(255,255,255,0.10), transparent 20%), linear-gradient(135deg, rgba(255,255,255,0.08), transparent 28%, rgba(37,99,235,0.10))',
                      }}
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-8 rounded-[18px] border border-blue-200/15"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-14 rounded-[14px] border border-white/10"
                    />
                  </>
                )}
                {showGrid && (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{
                      backgroundImage:
                        'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
                      backgroundSize: '40px 40px',
                    }}
                  />
                )}
                {pageBlocks.map((b) => (
                  <BlockNode
                    key={b.id}
                    block={b}
                    selected={selectedId === b.id}
                    cropMode={cropMode}
                    onDuplicate={duplicate}
                    onLock={() => toggleLock(b.id)}
                    onMoveBack={() => moveZ(-1)}
                    onMoveForward={() => moveZ(1)}
                    onRemove={remove}
                    onPointerDown={(e) =>
                      startInteraction(e, b.id, cropMode === b.id ? 'move' : 'move')
                    }
                    onResize={(e, h) => startInteraction(e, b.id, 'resize', h)}
                    onRotate={(e) => startInteraction(e, b.id, 'rotate')}
                    onCrop={(e, h) => startInteraction(e, b.id, 'crop', h)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="relative z-20 flex h-10 shrink-0 items-center justify-between border-t border-blue-300/[0.10] bg-[#071024] px-4 text-[11px] text-[var(--color-fg-subtle)] shadow-[0_-12px_34px_rgba(0,0,0,0.20)]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="rounded-md border border-blue-300/[0.10] bg-white/[0.03] px-2 py-1">
                Página {pages.findIndex((p) => p.id === activePageId) + 1} / {pages.length}
              </span>
              <span className="rounded-md border border-blue-300/[0.10] bg-white/[0.03] px-2 py-1">
                {blocks.filter((b) => b.pageId === activePageId).length} elementos
              </span>
              {selected && (
                <span className="truncate rounded-md border border-blue-300/[0.10] bg-white/[0.03] px-2 py-1">
                  <span className="text-[var(--color-fg-muted)]">{selected.label}</span> ·{' '}
                  {selected.kind} · X {selected.x.toFixed(0)}% · Y {selected.y.toFixed(0)}% ·{' '}
                  {selected.w}×{selected.h}px · {selected.rotation}°
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom((z) => Math.max(25, z - 5))}
                className="grid h-7 w-7 place-items-center rounded-lg border border-blue-300/[0.10] bg-white/[0.03] hover:bg-white/[0.07]"
              >
                <ZoomOut className="h-3 w-3" />
              </button>
              <input
                type="range"
                min={25}
                max={200}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-1.5 w-40 accent-blue-500"
              />
              <button
                onClick={() => setZoom((z) => Math.min(200, z + 5))}
                className="grid h-7 w-7 place-items-center rounded-lg border border-blue-300/[0.10] bg-white/[0.03] hover:bg-white/[0.07]"
              >
                <ZoomIn className="h-3 w-3" />
              </button>
              <span className="w-10 text-center font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom(75)}
                className="grid h-7 w-7 place-items-center rounded-lg border border-blue-300/[0.10] bg-white/[0.03] hover:bg-white/[0.07]"
                title="Restablecer zoom"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
              <button
                onClick={fitToScreen}
                className="rounded-lg border border-blue-300/[0.10] bg-white/[0.03] px-2.5 py-1 text-[10px] hover:bg-white/[0.07] hover:text-[var(--color-fg)]"
                title="Ajustar a pantalla"
              >
                Ajustar
              </button>
            </div>
          </div>
        </div>

        {/* Panel propiedades */}
        {propPanelOpen && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-blue-300/[0.10] bg-[#081127] shadow-[-10px_0_36px_rgba(0,0,0,0.20)]">
            {tool !== 'select' ? (
              <>
                {tool === 'layers' && (
                  <>
                    <PanelHeader
                      title="Capas"
                      hint={`${blocks.filter((b) => b.pageId === activePageId).length} elementos`}
                      onClose={() => setTool('select')}
                    />
                    <div className="flex-1 overflow-y-auto p-2">
                      {[...blocks]
                        .filter((b) => b.pageId === activePageId)
                        .reverse()
                        .map((b) => (
                          <div
                            key={b.id}
                            className={cn(
                              'group mb-1 flex items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-1.5 transition-colors',
                              selectedId === b.id
                                ? 'border-[var(--color-brand-500)]/25 bg-[var(--color-brand-500)]/15'
                                : 'hover:border-white/[0.06] hover:bg-white/[0.04]',
                            )}
                          >
                            <button
                              onClick={() => toggleHide(b.id)}
                              className="grid h-5 w-5 place-items-center rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
                            >
                              {b.hidden ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              onClick={() => toggleLock(b.id)}
                              className="grid h-5 w-5 place-items-center rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
                            >
                              {b.locked ? (
                                <Lock className="h-3 w-3" />
                              ) : (
                                <LockOpen className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedId(b.id);
                                setTool('select');
                              }}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p
                                className={cn(
                                  'truncate text-[12px] font-medium',
                                  selectedId === b.id
                                    ? 'text-[var(--color-fg)]'
                                    : 'text-[var(--color-fg-muted)]',
                                )}
                              >
                                {b.label}
                              </p>
                              <p className="truncate font-mono text-[10px] text-[var(--color-fg-subtle)]">
                                {b.content || `${b.kind}`}
                              </p>
                            </button>
                          </div>
                        ))}
                    </div>
                  </>
                )}
                {tool === 'data' && (
                  <>
                    <PanelHeader
                      title="Variables"
                      hint="Click para insertar"
                      onClose={() => setTool('select')}
                    />
                    <div className="flex-1 overflow-y-auto p-3">
                      {VARIABLE_GROUPS.map((g) => (
                        <div key={g.label} className="mb-3">
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                            {g.label}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {g.tokens.map((v) => (
                              <button
                                key={v}
                                onClick={() => insertVariable(v)}
                                className="rounded border border-[var(--color-border)] bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-[var(--color-brand-300)] hover:border-[var(--color-brand-500)]/60 hover:bg-[var(--color-brand-500)]/10"
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {tool === 'pages' && (
                  <>
                    <PanelHeader
                      title="Plantillas"
                      hint={`${pages.length} en total`}
                      onClose={() => setTool('select')}
                    />
                    <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
                      {pages.map((p, i) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setActivePageId(p.id);
                            setTool('select');
                          }}
                          className={cn(
                            'group relative w-full overflow-hidden rounded-lg border bg-white/[0.02] transition-all',
                            activePageId === p.id
                              ? 'border-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/40'
                              : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                          )}
                        >
                          <div
                            className={cn(
                              'aspect-[1.414/1] w-full bg-gradient-to-br',
                              PALETTES.find((pl) => pl.id === p.paletteId)?.className ??
                                PALETTES[0]!.className,
                            )}
                          />
                          <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[#101827] px-2 py-1 text-[11px]">
                            <span className="text-[var(--color-fg-muted)]">
                              #{i + 1} · {p.name}
                            </span>
                            {pages.length > 1 && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removePage(p.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.stopPropagation();
                                    removePage(p.id);
                                  }
                                }}
                                className="grid h-5 w-5 cursor-pointer place-items-center rounded text-[var(--color-fg-subtle)] opacity-0 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                              >
                                <Trash2 className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={addPage}
                        className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-[var(--color-border)] py-2 text-[11px] text-[var(--color-fg-muted)] hover:border-[var(--color-brand-500)]/60 hover:text-[var(--color-fg)]"
                      >
                        <Plus className="h-3 w-3" /> Nueva página
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <PanelHeader
                  title="Propiedades"
                  hint={
                    selected ? `${selected.label} · ${selected.kind}` : 'Selecciona un elemento'
                  }
                />
                <div className="flex-1 overflow-y-auto">
                  {!selected ? (
                    <div className="space-y-4 px-4 py-6 text-[12px] text-[var(--color-fg-muted)]">
                      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white/[0.02] p-4 text-center">
                        <p className="font-medium text-[var(--color-fg)]">Selecciona un elemento</p>
                        <p className="mt-1 leading-relaxed text-[var(--color-fg-subtle)]">
                          Haz click sobre un bloque del lienzo para editar sus propiedades.
                        </p>
                      </div>
                      <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                          Atajos
                        </p>
                        <div className="mt-2 space-y-1.5 font-mono text-[10px] text-[var(--color-fg-subtle)]">
                          <p>Ctrl+S guardar</p>
                          <p>Ctrl+Z deshacer</p>
                          <p>Ctrl+D duplicar</p>
                          <p>Shift + arrastrar mantiene proporción</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 p-3">
                      <PropGroup title="Contenido">
                        <textarea
                          value={selected.content}
                          onChange={(e) => update({ content: e.target.value })}
                          rows={2}
                          className="w-full resize-none rounded border border-[var(--color-border)] bg-white/[0.03] p-1.5 text-[12px] text-[var(--color-fg)] focus:border-[var(--color-brand-500)] focus:outline-none"
                        />
                        <div className="mt-1.5 grid grid-cols-2 gap-1">
                          <SmallBtn icon={Copy} label="Duplicar" onClick={duplicate} />
                          <SmallBtn icon={Trash2} label="Quitar" onClick={remove} danger />
                        </div>
                      </PropGroup>

                      <PropGroup title="Capa">
                        <div className="grid grid-cols-4 gap-1">
                          <ZBtn
                            icon={ArrowUpToLine}
                            title="Al frente"
                            onClick={() => moveZ('top')}
                          />
                          <ZBtn icon={ArrowUp} title="Subir" onClick={() => moveZ(1)} />
                          <ZBtn icon={ArrowDown} title="Bajar" onClick={() => moveZ(-1)} />
                          <ZBtn
                            icon={ArrowDownToLine}
                            title="Al fondo"
                            onClick={() => moveZ('bottom')}
                          />
                        </div>
                        <div className="mt-1.5 grid grid-cols-2 gap-1">
                          <SmallBtn
                            icon={selected.locked ? Lock : LockOpen}
                            label={selected.locked ? 'Desbloquear' : 'Bloquear'}
                            onClick={() => toggleLock(selected.id)}
                          />
                          <SmallBtn
                            icon={selected.hidden ? EyeOff : Eye}
                            label={selected.hidden ? 'Mostrar' : 'Ocultar'}
                            onClick={() => toggleHide(selected.id)}
                          />
                        </div>
                      </PropGroup>

                      <PropGroup title="Posición & tamaño">
                        <div className="grid grid-cols-2 gap-1.5">
                          <NumField
                            label="X"
                            value={selected.x}
                            onChange={(v) => update({ x: clamp(v, 0, 100) })}
                            suffix="%"
                          />
                          <NumField
                            label="Y"
                            value={selected.y}
                            onChange={(v) => update({ y: clamp(v, 0, 100) })}
                            suffix="%"
                          />
                          <NumField
                            label="W"
                            value={selected.w}
                            onChange={(v) => update({ w: Math.max(8, v) })}
                            suffix="px"
                          />
                          <NumField
                            label="H"
                            value={selected.h}
                            onChange={(v) => update({ h: Math.max(8, v) })}
                            suffix="px"
                          />
                        </div>
                        <div className="mt-2">
                          <Label>Rotación · {selected.rotation}°</Label>
                          <input
                            type="range"
                            min={-180}
                            max={180}
                            value={selected.rotation}
                            onChange={(e) => update({ rotation: Number(e.target.value) })}
                            className="h-1 w-full accent-[var(--color-brand-500)]"
                          />
                        </div>
                        <div className="mt-1">
                          <Label>Opacidad · {Math.round(selected.opacity * 100)}%</Label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(selected.opacity * 100)}
                            onChange={(e) => update({ opacity: Number(e.target.value) / 100 })}
                            className="h-1 w-full accent-[var(--color-brand-500)]"
                          />
                        </div>
                      </PropGroup>

                      {(selected.kind === 'text' ||
                        selected.kind === 'placeholder' ||
                        selected.kind === 'signature' ||
                        selected.kind === 'seal') && (
                        <PropGroup title="Tipografía">
                          <Select
                            value={selected.fontFamily ?? 'sans'}
                            onChange={(e) => update({ fontFamily: e.target.value as FontId })}
                            className="h-9 w-full px-2 py-1.5 text-[12px]"
                          >
                            {[...FONT_FAMILIES]
                              .sort((a, b) => a.label.localeCompare(b.label, 'es'))
                              .map((f) => (
                                <option key={f.id} value={f.id} style={{ fontFamily: f.value }}>
                                  {f.label}
                                </option>
                              ))}
                          </Select>
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <NumField
                              label="Tamaño"
                              value={selected.size}
                              onChange={(v) => update({ size: clamp(v, 4, 120) })}
                              suffix="px"
                            />
                            <NumField
                              label="Espaciado"
                              value={selected.letterSpacing ?? 0}
                              onChange={(v) => update({ letterSpacing: v })}
                              suffix="px"
                            />
                          </div>
                          <div className="mt-2 flex items-center gap-1">
                            <ToggleBtn
                              icon={Bold}
                              active={!!selected.bold}
                              onClick={() => update({ bold: !selected.bold })}
                            />
                            <ToggleBtn
                              icon={Italic}
                              active={!!selected.italic}
                              onClick={() => update({ italic: !selected.italic })}
                            />
                            <ToggleBtn
                              icon={Underline}
                              active={!!selected.underline}
                              onClick={() => update({ underline: !selected.underline })}
                            />
                            <Sep vertical={false} />
                            <ToggleBtn
                              icon={AlignLeft}
                              active={selected.align === 'left'}
                              onClick={() => update({ align: 'left' })}
                            />
                            <ToggleBtn
                              icon={AlignCenter}
                              active={selected.align === 'center'}
                              onClick={() => update({ align: 'center' })}
                            />
                            <ToggleBtn
                              icon={AlignRight}
                              active={selected.align === 'right'}
                              onClick={() => update({ align: 'right' })}
                            />
                          </div>
                          <label className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-fg-muted)]">
                            <input
                              type="checkbox"
                              checked={!!selected.textShadow}
                              onChange={(e) => update({ textShadow: e.target.checked })}
                              className="accent-[var(--color-brand-500)]"
                            />
                            Sombra de texto
                          </label>
                        </PropGroup>
                      )}

                      <PropGroup title="Color">
                        <Label>Texto / principal</Label>
                        <ColorRow
                          value={selected.color}
                          onChange={(c) => update({ color: c })}
                          recents={recentColors}
                        />
                        {(selected.kind === 'rect' ||
                          selected.kind === 'circle' ||
                          selected.kind === 'star' ||
                          selected.kind === 'triangle' ||
                          selected.kind === 'line' ||
                          selected.kind === 'arrow' ||
                          selected.kind === 'divider') && (
                          <>
                            <Label>Relleno</Label>
                            <ColorRow
                              value={selected.bgColor ?? '#ffffff'}
                              onChange={(c) => update({ bgColor: c })}
                              recents={recentColors}
                            />
                          </>
                        )}
                        {(selected.kind === 'rect' ||
                          selected.kind === 'circle' ||
                          selected.kind === 'triangle') && (
                          <>
                            <Label>Borde</Label>
                            <ColorRow
                              value={selected.borderColor ?? '#ffffff'}
                              onChange={(c) => update({ borderColor: c })}
                              recents={recentColors}
                            />
                            <NumField
                              label="Grosor borde"
                              value={selected.borderWidth ?? 1}
                              onChange={(v) => update({ borderWidth: clamp(v, 0, 12) })}
                              suffix="px"
                            />
                          </>
                        )}
                        {(selected.kind === 'rect' || selected.kind === 'image') && (
                          <>
                            <Label>Esquinas · {selected.borderRadius ?? 6}px</Label>
                            <input
                              type="range"
                              min={0}
                              max={120}
                              value={selected.borderRadius ?? 6}
                              onChange={(e) => update({ borderRadius: Number(e.target.value) })}
                              className="h-1 w-full accent-[var(--color-brand-500)]"
                            />
                          </>
                        )}
                        {selected.kind === 'image' && (
                          <>
                            <Label>Recorte</Label>
                            <div className="grid grid-cols-2 gap-1">
                              <SmallBtn
                                icon={cropMode === selected.id ? Eye : Scissors}
                                label={cropMode === selected.id ? 'Aplicar' : 'Recortar'}
                                onClick={() =>
                                  setCropMode(cropMode === selected.id ? null : selected.id)
                                }
                              />
                              <SmallBtn icon={RotateCw} label="Restablecer" onClick={resetCrop} />
                            </div>
                            <SmallBtn
                              icon={Maximize2}
                              label="Ajustar a proporción real"
                              onClick={fitImageToNatural}
                            />
                            <div className="mt-1 grid grid-cols-2 gap-1.5">
                              <NumField
                                label="Recorte ←"
                                value={Math.round((selected.cropL ?? 0) * 100)}
                                onChange={(v) =>
                                  update({ cropL: clamp(v / 100, 0, 0.95 - (selected.cropR ?? 0)) })
                                }
                                suffix="%"
                              />
                              <NumField
                                label="Recorte →"
                                value={Math.round((selected.cropR ?? 0) * 100)}
                                onChange={(v) =>
                                  update({ cropR: clamp(v / 100, 0, 0.95 - (selected.cropL ?? 0)) })
                                }
                                suffix="%"
                              />
                              <NumField
                                label="Recorte ↑"
                                value={Math.round((selected.cropT ?? 0) * 100)}
                                onChange={(v) =>
                                  update({ cropT: clamp(v / 100, 0, 0.95 - (selected.cropB ?? 0)) })
                                }
                                suffix="%"
                              />
                              <NumField
                                label="Recorte ↓"
                                value={Math.round((selected.cropB ?? 0) * 100)}
                                onChange={(v) =>
                                  update({ cropB: clamp(v / 100, 0, 0.95 - (selected.cropT ?? 0)) })
                                }
                                suffix="%"
                              />
                            </div>
                            <p className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
                              Sugerencia: arrastra desde una esquina con Shift para mantener
                              proporciones.
                            </p>
                          </>
                        )}
                      </PropGroup>
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleBgUpload(e.target.files?.[0])}
      />
      <input
        ref={imgFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0])}
      />
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712]/80 p-6 backdrop-blur-md"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-blue-300/[0.16] bg-[#081127] shadow-[0_32px_120px_rgba(0,0,0,0.58)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-blue-300/[0.12] px-4">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">Vista previa</p>
                <p className="text-[11px] text-[var(--color-fg-subtle)]">
                  {paper.name} · {paper.w} × {paper.h} mm
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadPdf}
                  className="rounded-lg border border-blue-300/[0.14] bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--color-fg-muted)] hover:bg-white/[0.08] hover:text-[var(--color-fg)]"
                >
                  Descargar PDF
                </button>
                <button
                  type="button"
                  onClick={printCertificate}
                  className="rounded-lg border border-blue-300/[0.14] bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--color-fg-muted)] hover:bg-white/[0.08] hover:text-[var(--color-fg)]"
                >
                  Imprimir
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPreviewUrl(null);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPreviewUrl(null);
                  }}
                  className="rounded-lg border border-blue-300/[0.14] bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--color-fg-muted)] hover:bg-white/[0.08] hover:text-[var(--color-fg)]"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top,#142553_0%,#060b18_58%)] p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Vista previa del certificado"
                className="mx-auto max-h-full max-w-full rounded-lg shadow-[0_28px_100px_rgba(0,0,0,0.45)]"
              />
            </div>
          </div>
        </div>
      )}
      {exporting && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-50 rounded-xl border border-blue-300/[0.16] bg-[#071024]/95 px-4 py-2 text-xs text-blue-100 shadow-2xl">
          Preparando certificado...
        </div>
      )}
    </div>
  );
}

// ─── Ribbons ──────────────────────────────────────────────────────────────────

function RibbonArchivo({
  onUpload,
  onSave,
  onPreview,
  onDownloadPdf,
  onDownloadPng,
  onPrint,
}: {
  onUpload: () => void;
  onSave: () => void;
  onPreview: () => void;
  onDownloadPdf: () => void;
  onDownloadPng: () => void;
  onPrint: () => void;
}) {
  return (
    <>
      <RibbonGroup label="Archivo">
        <RibbonBigBtn
          icon={FileText}
          label="Nuevo"
          onClick={() => {
            if (confirm('¿Descartar trabajo actual?')) {
              localStorage.removeItem('tessera.template-editor');
              location.reload();
            }
          }}
        />
        <RibbonBigBtn icon={Upload} label="Cargar fondo" onClick={onUpload} />
        <RibbonBigBtn icon={Save} label="Guardar" onClick={onSave} />
      </RibbonGroup>
      <RibbonGroup label="Exportar">
        <RibbonBigBtn icon={Eye} label="Preview" onClick={onPreview} />
        <RibbonBigBtn icon={Download} label="PDF" onClick={onDownloadPdf} />
        <RibbonBigBtn icon={ImageIcon} label="PNG" onClick={onDownloadPng} />
        <RibbonBigBtn icon={Printer} label="Imprimir" onClick={onPrint} />
      </RibbonGroup>
      <RibbonGroup label="Compartir">
        <RibbonBigBtn icon={Link2} label="Enlace" />
        <RibbonBigBtn icon={Lock} label="Permisos" />
      </RibbonGroup>
    </>
  );
}

function RibbonInsertar({
  onAdd,
  onUploadImg,
}: {
  onAdd: (k: BlockKind, opts?: Partial<Block>) => void;
  onUploadImg: () => void;
}) {
  return (
    <>
      <RibbonGroup label="Texto">
        <RibbonBigBtn icon={Type} label="Texto" onClick={() => onAdd('text')} />
        <RibbonBigBtn icon={Variable} label="Variable" onClick={() => onAdd('placeholder')} />
      </RibbonGroup>
      <RibbonGroup label="Formas">
        <RibbonBigBtn icon={Square} label="Rect" onClick={() => onAdd('rect')} />
        <RibbonBigBtn icon={Circle} label="Círculo" onClick={() => onAdd('circle')} />
        <RibbonBigBtn icon={Triangle} label="Triáng." onClick={() => onAdd('triangle')} />
        <RibbonBigBtn icon={Star} label="Estrella" onClick={() => onAdd('star')} />
        <RibbonBigBtn icon={Minus} label="Línea" onClick={() => onAdd('line')} />
        <RibbonBigBtn icon={ArrowRight} label="Flecha" onClick={() => onAdd('arrow')} />
      </RibbonGroup>
      <RibbonGroup label="Marca">
        <RibbonBigBtn icon={Stamp} label="Sello" onClick={() => onAdd('seal')} />
        <RibbonBigBtn icon={Pencil} label="Firma" onClick={() => onAdd('signature')} />
        <RibbonBigBtn icon={Minus} label="Divisor" onClick={() => onAdd('divider')} />
      </RibbonGroup>
      <RibbonGroup label="Multimedia">
        <RibbonBigBtn icon={ImageIcon} label="Imagen" onClick={onUploadImg} />
      </RibbonGroup>
    </>
  );
}

function RibbonDiseno({
  palette,
  onPalette,
  onUploadBg,
  onGradient,
  onSolid,
  paper,
  onPaper,
}: {
  palette: Palette;
  onPalette: (p: Palette) => void;
  onUploadBg: () => void;
  onGradient: (from: string, to: string) => void;
  onSolid: (c: string) => void;
  paper: PaperSize;
  onPaper: (id: PaperId) => void;
}) {
  const [from, setFrom] = useState('#1d2f64');
  const [to, setTo] = useState('#0b0f1f');
  return (
    <>
      <RibbonGroup label="Tamaño de hoja">
        <Select
          value={paper.id}
          onChange={(e) => onPaper(e.target.value as PaperId)}
          className="h-9 min-w-[220px] px-2 py-1 text-[11px]"
        >
          {[...PAPER_SIZES]
            .sort((a, b) => a.name.localeCompare(b.name, 'es'))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.w}×{p.h} mm)
              </option>
            ))}
        </Select>
      </RibbonGroup>
      <RibbonGroup label="Tema">
        <div className="grid grid-cols-6 gap-1">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => onPalette(p)}
              title={p.name}
              className={cn(
                'h-6 w-6 rounded border bg-gradient-to-br transition-all',
                p.className,
                palette.id === p.id
                  ? 'border-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/40'
                  : 'border-[var(--color-border)]',
              )}
            />
          ))}
        </div>
      </RibbonGroup>
      <RibbonGroup label="Gradiente custom">
        <div className="flex items-center gap-1">
          <input
            type="color"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded border border-[var(--color-border)] bg-transparent"
          />
          <input
            type="color"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded border border-[var(--color-border)] bg-transparent"
          />
          <button
            onClick={() => onGradient(from, to)}
            className="rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:border-[var(--color-brand-500)]/60 hover:text-[var(--color-fg)]"
          >
            Aplicar
          </button>
        </div>
      </RibbonGroup>
      <RibbonGroup label="Sólido">
        <input
          type="color"
          defaultValue="#0a0d18"
          onChange={(e) => onSolid(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded border border-[var(--color-border)] bg-transparent"
        />
      </RibbonGroup>
      <RibbonGroup label="Fondo">
        <RibbonBigBtn icon={Upload} label="Subir" onClick={onUploadBg} />
      </RibbonGroup>
    </>
  );
}

function RibbonDatos({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <>
      <RibbonGroup label="Variables disponibles">
        <div className="flex max-w-[720px] flex-wrap items-center gap-1">
          {VARIABLE_GROUPS.flatMap((g) => g.tokens).map((v) => (
            <button
              key={v}
              onClick={() => onInsert(v)}
              className="rounded border border-[var(--color-border)] bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-[var(--color-brand-300)] hover:border-[var(--color-brand-500)]/60 hover:bg-[var(--color-brand-500)]/10"
            >
              {v}
            </button>
          ))}
        </div>
      </RibbonGroup>
      <RibbonGroup label="Plantilla de datos">
        <RibbonBigBtn
          icon={Database}
          label="Descargar CSV"
          onClick={() => {
            const headers = VARIABLE_GROUPS.flatMap((g) => g.tokens).map((t) =>
              t.replace(/[{}]/g, ''),
            );
            const sample = headers.map((h) =>
              h === 'nombre'
                ? 'Ana Quispe'
                : h === 'email'
                  ? 'ana@example.com'
                  : h === 'wallet'
                    ? '0x0000000000000000000000000000000000000000'
                    : h === 'curso'
                      ? 'Diseño en Tessera'
                      : h === 'instructor'
                        ? 'M. Fernández'
                        : h === 'horas'
                          ? '40'
                          : h === 'puntaje'
                            ? '95'
                            : h === 'institucion'
                              ? 'Universidad Demo'
                              : h === 'ciudad'
                                ? 'Lima'
                                : h === 'rector'
                                  ? 'Dr. J. Salas'
                                  : h === 'fecha'
                                    ? new Date().toISOString().slice(0, 10)
                                    : h === 'tokenId'
                                      ? '1'
                                      : h === 'serie'
                                        ? '2026-A'
                                        : h === 'folio'
                                          ? '0001'
                                          : '',
            );
            const csv = `${headers.join(',')}\n${sample.join(',')}\n`;
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'tessera-plantilla.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
        />
        <RibbonBigBtn
          icon={FileText}
          label="Copiar variables"
          onClick={() => {
            const tokens = VARIABLE_GROUPS.flatMap((g) => g.tokens).join(', ');
            navigator.clipboard?.writeText(tokens).catch(() => {});
          }}
        />
      </RibbonGroup>
    </>
  );
}

function RibbonVista({
  zoom,
  setZoom,
  showRulers,
  setShowRulers,
  showGrid,
  setShowGrid,
  snap,
  setSnap,
}: {
  zoom: number;
  setZoom: (n: number) => void;
  showRulers: boolean;
  setShowRulers: (b: boolean) => void;
  showGrid: boolean;
  setShowGrid: (b: boolean) => void;
  snap: boolean;
  setSnap: (b: boolean) => void;
}) {
  return (
    <>
      <RibbonGroup label="Zoom">
        {[50, 75, 100, 125, 150].map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={cn(
              'rounded px-2 py-1 text-[11px]',
              zoom === z
                ? 'bg-[var(--color-brand-500)] text-white'
                : 'text-[var(--color-fg-muted)] hover:bg-white/[0.05] hover:text-[var(--color-fg)]',
            )}
          >
            {z}%
          </button>
        ))}
      </RibbonGroup>
      <RibbonGroup label="Mostrar">
        <ToggleChip icon={Ruler} active={showRulers} onClick={() => setShowRulers(!showRulers)}>
          Reglas
        </ToggleChip>
        <ToggleChip icon={Grid3x3} active={showGrid} onClick={() => setShowGrid(!showGrid)}>
          Cuadrícula
        </ToggleChip>
        <ToggleChip icon={LayoutIcon} active={snap} onClick={() => setSnap(!snap)}>
          Snap
        </ToggleChip>
      </RibbonGroup>
    </>
  );
}

// ─── Render de bloque ──────────────────────────────────────────────────────────

function BlockNode({
  block: b,
  selected,
  cropMode,
  onDuplicate,
  onLock,
  onMoveBack,
  onMoveForward,
  onRemove,
  onPointerDown,
  onResize,
  onRotate,
  onCrop,
}: {
  block: Block;
  selected: boolean;
  cropMode: string | null;
  onDuplicate: () => void;
  onLock: () => void;
  onMoveBack: () => void;
  onMoveForward: () => void;
  onRemove: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onResize: (e: React.PointerEvent, handle: string) => void;
  onRotate: (e: React.PointerEvent) => void;
  onCrop: (e: React.PointerEvent, handle: string) => void;
}) {
  const fontStack =
    FONT_FAMILIES.find((f) => f.id === b.fontFamily)?.value ?? FONT_FAMILIES[1]!.value;
  const isShape =
    b.kind === 'rect' ||
    b.kind === 'circle' ||
    b.kind === 'star' ||
    b.kind === 'triangle' ||
    b.kind === 'line' ||
    b.kind === 'arrow' ||
    b.kind === 'divider';

  const textStyle = {
    color: b.color,
    fontSize: `${b.size}px`,
    textAlign: b.align,
    fontWeight: b.bold ? 700 : 400,
    fontStyle: b.italic ? 'italic' : 'normal',
    textDecoration: b.underline ? 'underline' : 'none',
    fontFamily: fontStack,
    letterSpacing: `${b.letterSpacing ?? 0}px`,
    textShadow: b.textShadow ? '0 2px 12px rgba(0,0,0,0.55)' : 'none',
    width: '100%',
    display: 'block',
  } as const;

  return (
    <div
      id={`blk-${b.id}`}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'absolute -translate-x-1/2 -translate-y-1/2 select-none transition-shadow',
        b.locked ? 'cursor-not-allowed' : 'cursor-move',
        selected
          ? 'outline outline-2 outline-offset-2 outline-blue-400 drop-shadow-[0_0_18px_rgba(59,130,246,0.35)]'
          : 'hover:outline hover:outline-1 hover:outline-blue-200/45',
      )}
      style={{
        left: `${b.x}%`,
        top: `${b.y}%`,
        width: `${b.w}px`,
        minHeight: `${b.h}px`,
        height:
          isShape || b.kind === 'qr' || b.kind === 'seal' || b.kind === 'image'
            ? `${b.h}px`
            : 'auto',
        transform: `translate(-50%,-50%) rotate(${b.rotation}deg)`,
        opacity: b.opacity,
      }}
    >
      {/* contenido */}
      {b.kind === 'rect' && (
        <div
          className="h-full w-full"
          style={{
            background: b.bgColor,
            border: `${b.borderWidth ?? 0}px solid ${b.borderColor ?? 'transparent'}`,
            borderRadius: `${b.borderRadius ?? 6}px`,
          }}
        />
      )}
      {b.kind === 'circle' && (
        <div
          className="h-full w-full rounded-full"
          style={{
            background: b.bgColor,
            border: `${b.borderWidth ?? 0}px solid ${b.borderColor ?? 'transparent'}`,
          }}
        />
      )}
      {b.kind === 'triangle' && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon
            points="50,5 95,95 5,95"
            fill={b.bgColor}
            stroke={b.borderColor}
            strokeWidth={b.borderWidth ?? 0}
          />
        </svg>
      )}
      {b.kind === 'star' && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon
            points="50,5 61,38 96,38 67,58 78,92 50,72 22,92 33,58 4,38 39,38"
            fill={b.bgColor}
          />
        </svg>
      )}
      {b.kind === 'line' && (
        <div className="h-full w-full rounded-full" style={{ background: b.bgColor }} />
      )}
      {b.kind === 'arrow' && (
        <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="h-full w-full">
          <line x1="0" y1="10" x2="92" y2="10" stroke={b.bgColor} strokeWidth="2" />
          <polygon points="92,2 100,10 92,18" fill={b.bgColor} />
        </svg>
      )}
      {b.kind === 'divider' && (
        <div
          className="h-full w-full rounded-full"
          style={{ background: b.bgColor ?? b.color, opacity: 0.5 }}
        />
      )}

      {b.kind === 'qr' && (
        <div className="flex h-full w-full flex-col items-center gap-1">
          <div className="grid flex-1 w-full place-items-center rounded-xl border border-slate-200 bg-white p-2 shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
              }}
            />
          </div>
        </div>
      )}
      {b.kind === 'seal' && (
        <div
          className="grid h-full w-full place-items-center rounded-full border-2 border-blue-100/45 bg-transparent font-bold shadow-[0_10px_24px_rgba(0,0,0,0.14)]"
          style={{ color: b.color, fontSize: `${b.size}px`, fontFamily: fontStack }}
        >
          {b.content}
        </div>
      )}
      {b.kind === 'image' &&
        (b.src ? (
          (() => {
            const cL = b.cropL ?? 0,
              cR = b.cropR ?? 0,
              cT = b.cropT ?? 0,
              cB = b.cropB ?? 0;
            const visW = Math.max(0.05, 1 - cL - cR);
            const visH = Math.max(0.05, 1 - cT - cB);
            const isCrop = cropMode === b.id;
            if (isCrop) {
              // Modo recorte: muestra la imagen completa cubriendo el bloque y resalta
              // el rectángulo que se conservará. Sin duplicados ni bordes flotantes.
              return (
                <div
                  className="relative h-full w-full overflow-hidden"
                  style={{ borderRadius: `${b.borderRadius ?? 0}px` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.src}
                    alt={b.label}
                    draggable={false}
                    className="pointer-events-none absolute inset-0 h-full w-full select-none"
                    style={{ objectFit: 'fill', opacity: 0.35 }}
                  />
                  <div
                    className="pointer-events-none absolute overflow-hidden ring-2 ring-amber-400"
                    style={{
                      left: `${cL * 100}%`,
                      top: `${cT * 100}%`,
                      width: `${visW * 100}%`,
                      height: `${visH * 100}%`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={b.src}
                      alt=""
                      draggable={false}
                      className="absolute inset-0 select-none"
                      style={{
                        width: `${100 / visW}%`,
                        height: `${100 / visH}%`,
                        left: `${(-100 * cL) / visW}%`,
                        top: `${(-100 * cT) / visH}%`,
                        objectFit: 'fill',
                      }}
                    />
                  </div>
                </div>
              );
            }
            return (
              <div
                className="relative h-full w-full overflow-hidden"
                style={{ borderRadius: `${b.borderRadius ?? 0}px` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.src}
                  alt={b.label}
                  draggable={false}
                  className="absolute select-none"
                  style={{
                    width: `${100 / visW}%`,
                    height: `${100 / visH}%`,
                    left: `${(-100 * cL) / visW}%`,
                    top: `${(-100 * cT) / visH}%`,
                    objectFit: 'fill',
                  }}
                />
              </div>
            );
          })()
        ) : (
          <div className="grid h-full w-full place-items-center rounded-md border border-dashed border-white/30 bg-white/[0.04] text-white/40">
            <FileImage className="h-5 w-5" />
          </div>
        ))}
      {b.kind === 'signature' && (
        <div className="flex flex-col items-end gap-1">
          <div className="h-px w-[180px] bg-white/40" />
          <span style={textStyle} className="whitespace-nowrap">
            {b.content}
          </span>
        </div>
      )}
      {(b.kind === 'text' || b.kind === 'placeholder') && (
        <span style={textStyle} className="whitespace-nowrap">
          {b.content}
        </span>
      )}

      {selected && (
        <div
          className="absolute left-1/2 -top-16 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-blue-300/[0.18] bg-[#071024]/95 p-1 shadow-[0_18px_52px_rgba(0,0,0,0.42)] backdrop-blur"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <MiniTool icon={Copy} title="Duplicar" onClick={onDuplicate} />
          <MiniTool
            icon={b.locked ? Lock : LockOpen}
            title={b.locked ? 'Desbloquear' : 'Bloquear'}
            onClick={onLock}
          />
          <MiniTool icon={ArrowDown} title="Enviar atrás" onClick={onMoveBack} />
          <MiniTool icon={ArrowUp} title="Traer adelante" onClick={onMoveForward} />
          <MiniTool icon={Trash2} title="Quitar" onClick={onRemove} danger />
        </div>
      )}

      {/* Handles cuando seleccionado */}
      {selected && !b.locked && cropMode !== b.id && (
        <>
          <ResizeHandle pos="nw" onPointerDown={(e) => onResize(e, 'nw')} />
          <ResizeHandle pos="ne" onPointerDown={(e) => onResize(e, 'ne')} />
          <ResizeHandle pos="sw" onPointerDown={(e) => onResize(e, 'sw')} />
          <ResizeHandle pos="se" onPointerDown={(e) => onResize(e, 'se')} />
          <ResizeHandle pos="n" onPointerDown={(e) => onResize(e, 'n')} />
          <ResizeHandle pos="s" onPointerDown={(e) => onResize(e, 's')} />
          <ResizeHandle pos="e" onPointerDown={(e) => onResize(e, 'e')} />
          <ResizeHandle pos="w" onPointerDown={(e) => onResize(e, 'w')} />
          <button
            onPointerDown={onRotate}
            title="Rotar"
            className="absolute left-1/2 -top-7 grid h-5 w-5 -translate-x-1/2 cursor-grab place-items-center rounded-full border border-white bg-[var(--color-brand-500)] text-white"
          >
            <RotateCw className="h-3 w-3" />
          </button>
        </>
      )}
      {/* Handles de RECORTE para imagen */}
      {selected && !b.locked && cropMode === b.id && b.kind === 'image' && (
        <>
          <CropHandle
            side="L"
            cropL={b.cropL}
            cropR={b.cropR}
            cropT={b.cropT}
            cropB={b.cropB}
            onPointerDown={(e) => onCrop(e, 'cropL')}
          />
          <CropHandle
            side="R"
            cropL={b.cropL}
            cropR={b.cropR}
            cropT={b.cropT}
            cropB={b.cropB}
            onPointerDown={(e) => onCrop(e, 'cropR')}
          />
          <CropHandle
            side="T"
            cropL={b.cropL}
            cropR={b.cropR}
            cropT={b.cropT}
            cropB={b.cropB}
            onPointerDown={(e) => onCrop(e, 'cropT')}
          />
          <CropHandle
            side="B"
            cropL={b.cropL}
            cropR={b.cropR}
            cropT={b.cropT}
            cropB={b.cropB}
            onPointerDown={(e) => onCrop(e, 'cropB')}
          />
        </>
      )}
    </div>
  );
}

function ResizeHandle({
  pos,
  onPointerDown,
}: {
  pos: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const map: Record<string, string> = {
    nw: '-left-1.5 -top-1.5 cursor-nwse-resize',
    ne: '-right-1.5 -top-1.5 cursor-nesw-resize',
    sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
    se: '-bottom-1.5 -right-1.5 cursor-nwse-resize',
    n: 'left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize',
    s: 'left-1/2 -bottom-1.5 -translate-x-1/2 cursor-ns-resize',
    e: 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize',
    w: 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize',
  };
  return (
    <button
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'absolute h-3.5 w-3.5 rounded-[4px] border-2 border-white bg-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.55)]',
        map[pos],
      )}
    />
  );
}

function CropHandle({
  side,
  cropL = 0,
  cropR = 0,
  cropT = 0,
  cropB = 0,
  onPointerDown,
}: {
  side: 'L' | 'R' | 'T' | 'B';
  cropL?: number;
  cropR?: number;
  cropT?: number;
  cropB?: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const style: React.CSSProperties =
    side === 'L'
      ? {
          left: `${cropL * 100}%`,
          top: `${cropT * 100}%`,
          height: `${(1 - cropT - cropB) * 100}%`,
          width: 8,
          transform: 'translateX(-50%)',
          cursor: 'ew-resize',
        }
      : side === 'R'
        ? {
            left: `${(1 - cropR) * 100}%`,
            top: `${cropT * 100}%`,
            height: `${(1 - cropT - cropB) * 100}%`,
            width: 8,
            transform: 'translateX(-50%)',
            cursor: 'ew-resize',
          }
        : side === 'T'
          ? {
              top: `${cropT * 100}%`,
              left: `${cropL * 100}%`,
              width: `${(1 - cropL - cropR) * 100}%`,
              height: 8,
              transform: 'translateY(-50%)',
              cursor: 'ns-resize',
            }
          : {
              top: `${(1 - cropB) * 100}%`,
              left: `${cropL * 100}%`,
              width: `${(1 - cropL - cropR) * 100}%`,
              height: 8,
              transform: 'translateY(-50%)',
              cursor: 'ns-resize',
            };
  return (
    <button
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-10 rounded bg-amber-400/90 ring-2 ring-amber-400 shadow"
      style={style}
    />
  );
}

// ─── UI auxiliares ─────────────────────────────────────────────────────────────

function IconBtn({
  icon: Icon,
  title,
  onClick,
  disabled,
}: {
  icon: typeof Save;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="grid h-8 w-8 place-items-center rounded-lg border border-blue-300/[0.10] bg-white/[0.025] text-[var(--color-fg-muted)] transition hover:border-blue-300/[0.22] hover:bg-blue-300/[0.07] hover:text-[var(--color-fg)] disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function MiniTool({
  icon: Icon,
  title,
  onClick,
  danger,
}: {
  icon: typeof Copy;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-lg border border-transparent transition-colors',
        danger
          ? 'text-red-300 hover:border-red-400/30 hover:bg-red-500/10'
          : 'text-[var(--color-fg-muted)] hover:border-white/[0.10] hover:bg-white/[0.07] hover:text-[var(--color-fg)]',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function Sep({ vertical }: { vertical?: boolean }) {
  return vertical ? (
    <div className="my-1 h-px w-full bg-blue-300/[0.10]" />
  ) : (
    <div className="mx-1 h-5 w-px bg-blue-300/[0.12]" />
  );
}

function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-[64px] flex-col items-stretch gap-1 rounded-xl border border-blue-300/[0.10] bg-white/[0.035] px-2.5 py-1.5 shadow-inner shadow-white/[0.02]">
      <div className="flex flex-1 items-center gap-1">{children}</div>
      <p className="text-center text-[9.5px] uppercase tracking-wider text-blue-200/55">{label}</p>
    </div>
  );
}

function RibbonBigBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Type;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-14 flex-col items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-[10px] text-[var(--color-fg-muted)] transition-colors hover:border-blue-300/[0.16] hover:bg-blue-300/[0.08] hover:text-[var(--color-fg)]"
    >
      <Icon className="h-4 w-4 text-blue-300" />
      <span className="leading-tight">{label}</span>
    </button>
  );
}

function ToggleChip({
  icon: Icon,
  active,
  onClick,
  children,
}: {
  icon?: typeof Type;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors',
        active
          ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10 text-[var(--color-brand-300)]'
          : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]',
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </button>
  );
}

function PanelHeader({
  title,
  hint,
  onClose,
}: {
  title: string;
  hint?: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-blue-300/[0.10] bg-[linear-gradient(180deg,#0e1835,#091127)] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200">
          {title}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-[var(--color-fg-muted)]">{hint}</p>}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[var(--color-fg-muted)] transition hover:bg-white/[0.08] hover:text-[var(--color-fg)]"
          aria-label="Cerrar panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function PropGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200/60">
        {title}
      </p>
      <div className="space-y-2 rounded-xl border border-blue-300/[0.10] bg-white/[0.035] p-3 shadow-inner shadow-white/[0.02]">
        {children}
      </div>
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[10px] uppercase tracking-wider text-blue-200/55">{children}</span>
  );
}

function NumField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const safeValue = Number.isFinite(value) ? Math.round(value) : 0;
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] transition focus-within:border-[var(--color-brand-500)]/50">
        <input
          type="number"
          value={String(safeValue)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent px-1.5 py-1 text-[12px] text-[var(--color-fg)] focus:outline-none"
        />
        {suffix && <span className="px-1 text-[10px] text-[var(--color-fg-subtle)]">{suffix}</span>}
      </div>
    </div>
  );
}

function ToggleBtn({
  icon: Icon,
  active,
  onClick,
}: {
  icon: typeof Bold;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-lg border border-transparent transition-colors',
        active
          ? 'border-[var(--color-brand-500)]/30 bg-[var(--color-brand-500)]/15 text-[var(--color-brand-300)]'
          : 'text-[var(--color-fg-muted)] hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-[var(--color-fg)]',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function ZBtn({
  icon: Icon,
  title,
  onClick,
}: {
  icon: typeof ArrowUp;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="grid h-7 place-items-center rounded-lg border border-white/[0.08] text-[var(--color-fg-muted)] transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-[var(--color-fg)]"
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

function SmallBtn({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors',
        danger
          ? 'border-red-500/40 text-red-300 hover:bg-red-500/10'
          : 'border-white/[0.08] text-[var(--color-fg-muted)] hover:border-white/[0.16] hover:bg-white/[0.04] hover:text-[var(--color-fg)]',
      )}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function ColorRow({
  value,
  onChange,
  recents,
}: {
  value: string;
  onChange: (c: string) => void;
  recents: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-[var(--color-border)] bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-[var(--color-border)] bg-white/[0.03] px-1.5 py-1 font-mono text-[11px] text-[var(--color-fg)] focus:outline-none"
        />
        <button
          onClick={() => setOpen((v) => !v)}
          className="grid h-7 w-7 place-items-center rounded border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          <Palette className="h-3 w-3" />
        </button>
      </div>
      {open && (
        <div className="rounded border border-[var(--color-border)] bg-white/[0.02] p-1.5">
          {recents.length > 0 && (
            <>
              <p className="mb-1 text-[9.5px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                Recientes
              </p>
              <div className="mb-2 flex flex-wrap gap-0.5">
                {recents.map((c) => (
                  <button
                    key={c}
                    onClick={() => onChange(c)}
                    className="h-4 w-4 rounded border border-white/15"
                    style={{ background: c }}
                  />
                ))}
              </div>
            </>
          )}
          <p className="mb-1 text-[9.5px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            Paleta
          </p>
          <div className="flex flex-wrap gap-0.5">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => onChange(c)}
                title={c}
                className={cn(
                  'h-4 w-4 rounded border',
                  value === c
                    ? 'border-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/40'
                    : 'border-white/15',
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'certificado-tessera'
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getImageSize(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('No se pudo leer la captura del certificado'));
    image.src = dataUrl;
  });
}

function buildJpegPdf(
  dataUrl: string,
  paper: PaperSize,
  imageSize: { width: number; height: number },
  embeddedLayout?: Record<string, unknown>,
) {
  const image = dataUrlToBytes(dataUrl);
  const pageW = (paper.w * 72) / 25.4;
  const pageH = (paper.h * 72) / 25.4;
  const imageW = Math.max(1, Math.round(imageSize.width));
  const imageH = Math.max(1, Math.round(imageSize.height));
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  function addText(text: string) {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    offset += bytes.length;
  }

  function addBytes(bytes: Uint8Array) {
    chunks.push(bytes);
    offset += bytes.length;
  }

  function beginObject(id: number) {
    offsets[id] = offset;
    addText(`${id} 0 obj\n`);
  }

  addText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const layoutMarker = embeddedLayout ? encodeLayoutMarker(embeddedLayout) : null;
  if (layoutMarker) addText(`%TESSERA_LAYOUT_V1:${layoutMarker}\n`);

  beginObject(1);
  addText('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  beginObject(2);
  addText('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  beginObject(3);
  addText(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(
      2,
    )}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );

  beginObject(4);
  addText(
    `<< /Type /XObject /Subtype /Image /Width ${imageW} /Height ${imageH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`,
  );
  addBytes(image);
  addText('\nendstream\nendobj\n');

  const content = `q\n${pageW.toFixed(2)} 0 0 ${pageH.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
  beginObject(5);
  addText(`<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

  const startxref = offset;
  addText(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i += 1) {
    addText(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  addText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`);

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const pdf = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    pdf.set(chunk, cursor);
    cursor += chunk.length;
  }
  return pdf;
}

function encodeLayoutMarker(layout: Record<string, unknown>) {
  try {
    const json = JSON.stringify(layout);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  } catch {
    return null;
  }
}

function isSerializedTemplate(
  value: Record<string, unknown>,
): value is { name?: string; pages: Page[]; blocks: Block[] } {
  return Array.isArray(value.pages) && Array.isArray(value.blocks);
}

function normalizeBlock(block: Block): Block {
  return {
    ...block,
    x: clamp(block.x, 0, 100),
    y: clamp(block.y, 0, 100),
    w: Math.max(8, finite(block.w, 120)),
    h: Math.max(8, finite(block.h, 32)),
    rotation: clamp(finite(block.rotation, 0), -360, 360),
    opacity: clamp(finite(block.opacity, 1), 0, 1),
    size: clamp(finite(block.size, 16), 4, 120),
    borderWidth:
      block.borderWidth === undefined ? undefined : Math.max(0, finite(block.borderWidth, 0)),
    borderRadius:
      block.borderRadius === undefined ? undefined : Math.max(0, finite(block.borderRadius, 0)),
    cropL: block.cropL === undefined ? undefined : clamp(block.cropL, 0, 0.95),
    cropR: block.cropR === undefined ? undefined : clamp(block.cropR, 0, 0.95),
    cropT: block.cropT === undefined ? undefined : clamp(block.cropT, 0, 0.95),
    cropB: block.cropB === undefined ? undefined : clamp(block.cropB, 0, 0.95),
  };
}

function isTextLikeBlock(block: Block) {
  return (
    block.kind === 'text' ||
    block.kind === 'placeholder' ||
    block.kind === 'signature' ||
    block.kind === 'seal'
  );
}

function finite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}
