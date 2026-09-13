function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '&') return '&amp;';
    if (char === '"') return '&quot;';
    return '&apos;';
  });
}

function label(value: string, limit: number): string {
  return escapeXml(value.length > limit ? `${value.slice(0, limit - 1)}...` : value);
}

type TemplateInput = {
  backgroundUrl: string | null;
  layout: Record<string, unknown> | null;
};

type LayoutBlock = {
  id?: string;
  kind?: string;
  content?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
  opacity?: number;
  size?: number;
  align?: string;
  color?: string;
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  letterSpacing?: number;
  fontFamily?: string;
  hidden?: boolean;
  pageId?: string;
  src?: string;
};

type LayoutPage = {
  id?: string;
  paletteId?: string;
  paperId?: string;
  bgUrl?: string | null;
  bgSolid?: string | null;
  bgGradient?: { from?: string; to?: string } | null;
};

const PAPER: Record<string, { width: number; ratio: number }> = {
  'a4-l': { width: 1100, ratio: 297 / 210 },
  'a4-p': { width: 780, ratio: 210 / 297 },
  'a3-l': { width: 1240, ratio: 420 / 297 },
  'a3-p': { width: 880, ratio: 297 / 420 },
  'a5-l': { width: 920, ratio: 210 / 148 },
  'a5-p': { width: 660, ratio: 148 / 210 },
  'letter-l': { width: 1080, ratio: 279 / 216 },
  'letter-p': { width: 820, ratio: 216 / 279 },
};

const PALETTE_BACKGROUNDS: Record<string, { from: string; to: string }> = {
  royal: { from: '#142046', to: '#0b0f1f' },
  gold: { from: '#3a2a18', to: '#0c0d15' },
  forest: { from: '#1a4234', to: '#0b111a' },
  platinum: { from: '#2a3144', to: '#10131d' },
  paper: { from: '#f5f3ee', to: '#dad4c2' },
  ocean: { from: '#0a4f72', to: '#021624' },
  violet: { from: '#3a1f6b', to: '#0a0716' },
};

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    : [];
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function fontFamily(id: string): string {
  if (id === 'serif' || id === 'display') return 'DejaVu Serif';
  if (id === 'mono') return 'DejaVu Sans Mono';
  return 'DejaVu Sans';
}

function resolveVariable(content: string, values: Record<string, string>): string {
  return content.replace(/{{\s*([^}]+)\s*}}/g, (_, key: string) => values[key.trim()] ?? '');
}

function renderQrCode(value: string, size: number): string {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const quietZone = 4;
  const cellSize = size / (qr.modules.size + quietZone * 2);
  const offset = -size / 2 + quietZone * cellSize;
  let path = '';

  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let column = 0; column < qr.modules.size; column += 1) {
      if (qr.modules.get(row, column)) {
        path += `M${offset + column * cellSize} ${offset + row * cellSize}h${cellSize}v${cellSize}h-${cellSize}z`;
      }
    }
  }

  return `<rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#111"/>`;
}

function renderTemplateArtwork(
  input: Parameters<typeof renderCertificateSvg>[0],
  template: TemplateInput,
): Buffer | null {
  const layout = template.layout;
  if (!layout) return null;
  const pages = asRecords(layout.pages) as LayoutPage[];
  const blocks = asRecords(layout.blocks) as LayoutBlock[];
  const page = pages[0];
  if (!page) return null;

  const paper = PAPER[page.paperId ?? 'a4-l'] ?? PAPER['a4-l']!;
  const width = 1600;
  const height = Math.round(width / paper.ratio);
  const scale = width / paper.width;
  const values = {
    nombre: input.studentName,
    estudiante: input.studentName,
    curso: input.achievementName,
    logro: input.achievementName,
    fecha: (input.completedAt ?? input.issuedAt ?? new Date().toISOString()).slice(0, 10),
    institucion: input.institutionName,
    instructor: input.institutionName,
    tokenId: input.certificateId,
  };
  const pageId = page.id ?? 'p1';
  // Imported PDFs/images are flattened previews that already contain placeholder text.
  // The editable layout is authoritative for the final credential, avoiding duplicate labels.
  const backgroundUrl = blocks.length ? null : (page.bgUrl ?? template.backgroundUrl);
  const palette = PALETTE_BACKGROUNDS[page.paletteId ?? 'royal'] ?? PALETTE_BACKGROUNDS.royal!;
  const background = backgroundUrl
    ? `<image href="${escapeXml(backgroundUrl)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`
    : page.bgGradient?.from && page.bgGradient.to
      ? `<defs><linearGradient id="template-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${escapeXml(page.bgGradient.from)}"/><stop offset="1" stop-color="${escapeXml(page.bgGradient.to)}"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#template-bg)"/>`
      : `<defs><linearGradient id="template-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${escapeXml(page.bgSolid ?? palette.from)}"/><stop offset="1" stop-color="${escapeXml(page.bgSolid ? page.bgSolid : palette.to)}"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#template-bg)"/>`;
  const elements = blocks
    .filter((block) => !block.hidden && (!block.pageId || block.pageId === pageId))
    .map((block) => renderTemplateBlock(block, values, width, height, scale, input.verificationUrl))
    .join('');

  if (!elements) return null;
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${escapeXml(input.achievementName)} - ${escapeXml(input.studentName)}</title>${background}${elements}</svg>`);
}

function renderTemplateBlock(
  block: LayoutBlock,
  values: Record<string, string>,
  width: number,
  height: number,
  scale: number,
  verificationUrl?: string,
): string {
  const x = (numberValue(block.x, 50) / 100) * width;
  const y = (numberValue(block.y, 50) / 100) * height;
  const w = numberValue(block.w, 200) * scale;
  const h = numberValue(block.h, 40) * scale;
  const rotation = numberValue(block.rotation, 0);
  const opacity = numberValue(block.opacity, 1);
  const color = escapeXml(stringValue(block.color, '#ffffff'));
  const fill = escapeXml(stringValue(block.bgColor, color));
  const content = label(resolveVariable(stringValue(block.content), values), 120);
  const transform = `translate(${x} ${y}) rotate(${rotation})`;
  const kind = block.kind ?? 'text';

  if (kind === 'rect' || kind === 'circle') {
    const radius =
      kind === 'circle' ? Math.min(w, h) / 2 : numberValue(block.borderRadius, 6) * scale;
    return `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${escapeXml(stringValue(block.borderColor, 'transparent'))}" stroke-width="${numberValue(block.borderWidth, 0) * scale}" opacity="${opacity}" transform="${transform}"/>`;
  }
  if (kind === 'divider' || kind === 'line') {
    return `<line x1="${x - w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y}" stroke="${fill}" stroke-width="${Math.max(1, h)}" opacity="${opacity}"/>`;
  }
  if (kind === 'image' && block.src) {
    return `<image href="${escapeXml(block.src)}" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" opacity="${opacity}" transform="rotate(${rotation} ${x} ${y})"/>`;
  }
  if (kind === 'qr') {
    const size = Math.min(w, h);
    return verificationUrl
      ? `<g transform="${transform}" opacity="${opacity}">${renderQrCode(verificationUrl, size)}</g>`
      : '';
  }

  const anchor = block.align === 'left' ? 'start' : block.align === 'right' ? 'end' : 'middle';
  const offset = anchor === 'start' ? -w / 2 : anchor === 'end' ? w / 2 : 0;
  const size = numberValue(block.size, 16) * scale;
  const style = `font-family:${fontFamily(stringValue(block.fontFamily, 'sans'))};font-size:${size}px;font-weight:${block.bold ? 700 : 400};font-style:${block.italic ? 'italic' : 'normal'};letter-spacing:${numberValue(block.letterSpacing, 0) * scale}px;text-decoration:${block.underline ? 'underline' : 'none'}`;
  const signature =
    kind === 'signature'
      ? `<line x1="${-w / 2}" y1="${-size}" x2="${w / 2}" y2="${-size}" stroke="${color}" stroke-opacity=".65"/>`
      : '';
  return `<g transform="${transform}" opacity="${opacity}">${signature}<text x="${offset}" y="0" dominant-baseline="middle" text-anchor="${anchor}" fill="${color}" style="${style}">${content}</text></g>`;
}

export function renderCertificateSvg(input: {
  certificateId: string;
  institutionName: string;
  studentName: string;
  achievementName: string;
  description: string | null;
  grade: number | null;
  completedAt: string | null;
  issuedAt?: string;
  verificationUrl?: string;
  template?: TemplateInput;
}): Buffer {
  const templateArtwork = input.template ? renderTemplateArtwork(input, input.template) : null;
  if (templateArtwork) return templateArtwork;
  const issuedAt = (input.issuedAt ?? new Date().toISOString()).slice(0, 10);
  const completedAt = input.completedAt?.slice(0, 10) ?? issuedAt;
  const details = input.description
    ? label(input.description, 150)
    : 'has successfully completed the certified achievement';
  const grade =
    input.grade === null
      ? ''
      : `<text x="800" y="805" text-anchor="middle" class="detail">Grade: ${input.grade}</text>`;
  const qr = input.verificationUrl
    ? `<g transform="translate(1390 930)">${renderQrCode(input.verificationUrl, 150)}</g>`
    : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1130" viewBox="0 0 1600 1130" role="img" aria-labelledby="title">
  <title id="title">Certificate issued by ${escapeXml(input.institutionName)}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#07182d"/><stop offset="1" stop-color="#102e52"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f9d97d"/><stop offset="1" stop-color="#b77c22"/></linearGradient>
    <style>.small{font:600 24px Arial,sans-serif;letter-spacing:4px;fill:#dbe9f6}.heading{font:700 70px Georgia,serif;fill:#f9d97d}.name{font:700 61px Georgia,serif;fill:#fff}.achievement{font:600 39px Arial,sans-serif;fill:#f9d97d}.body{font:400 26px Arial,sans-serif;fill:#e5edf6}.detail{font:600 22px Arial,sans-serif;fill:#dbe9f6;letter-spacing:1px}.footer{font:500 17px Arial,sans-serif;fill:#9db5cc}</style>
  </defs>
  <rect width="1600" height="1130" fill="url(#bg)"/>
  <rect x="34" y="34" width="1532" height="1062" rx="8" fill="none" stroke="url(#gold)" stroke-width="5"/>
  <rect x="52" y="52" width="1496" height="1026" rx="5" fill="none" stroke="#f9d97d" stroke-opacity=".35" stroke-width="1"/>
  <path d="M610 172H990" stroke="url(#gold)" stroke-width="3"/><circle cx="800" cy="172" r="8" fill="#f9d97d"/>
  <text x="800" y="245" text-anchor="middle" class="small">${label(input.institutionName.toUpperCase(), 64)}</text>
  <text x="800" y="345" text-anchor="middle" class="heading">CERTIFICATE OF ACHIEVEMENT</text>
  <text x="800" y="430" text-anchor="middle" class="body">This certifies that</text>
  <text x="800" y="525" text-anchor="middle" class="name">${label(input.studentName, 48)}</text>
  <path d="M450 550H1150" stroke="#f9d97d" stroke-opacity=".5" stroke-width="2"/>
  <text x="800" y="625" text-anchor="middle" class="body">has been awarded the following credential</text>
  <text x="800" y="700" text-anchor="middle" class="achievement">${label(input.achievementName, 62)}</text>
  <text x="800" y="760" text-anchor="middle" class="body">${details}</text>
  ${grade}
  <path d="M310 900H625" stroke="#9db5cc" stroke-width="1"/><path d="M975 900H1290" stroke="#9db5cc" stroke-width="1"/>
  <text x="467" y="935" text-anchor="middle" class="detail">COMPLETED ${escapeXml(completedAt)}</text>
  <text x="1132" y="935" text-anchor="middle" class="detail">ISSUED ${escapeXml(issuedAt)}</text>
  ${qr}
  <text x="800" y="1025" text-anchor="middle" class="footer">Tessera verified certificate · ID ${escapeXml(input.certificateId)}</text>
</svg>`;
  return Buffer.from(svg);
}
import QRCode from 'qrcode';
