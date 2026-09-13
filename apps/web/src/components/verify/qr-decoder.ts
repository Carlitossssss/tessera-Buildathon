'use client';

import jsQR from 'jsqr';

const MAX_DIMENSION = 1600;

export type SupportedFileType = 'image' | 'pdf';

export function detectFileType(file: File): SupportedFileType | null {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|webp|gif|bmp)$/.test(lower)) return 'image';
  return null;
}

export async function decodeQrFromFile(file: File): Promise<string | null> {
  const kind = detectFileType(file);
  if (kind === 'pdf') {
    const { decodeQrFromPdf } = await import('./qr-pdf-decoder');
    return decodeQrFromPdf(file);
  }
  if (kind === 'image') {
    return decodeQrFromImage(file);
  }
  throw new Error('Tipo de archivo no soportado. Subí PNG, JPG, WebP o PDF.');
}

async function decodeQrFromImage(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    return decodeImageSource(bitmap, bitmap.width, bitmap.height, 'attemptBoth');
  } finally {
    bitmap.close?.();
  }
}

export function decodeImageSource(
  source: CanvasImageSource,
  width: number,
  height: number,
  inversionAttempts: 'attemptBoth' | 'dontInvert' = 'dontInvert',
): string | null {
  if (width === 0 || height === 0) return null;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const code = jsQR(data.data, w, h, { inversionAttempts });
  return code?.data ?? null;
}

export function decodeQrFromCanvas(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(data.data, canvas.width, canvas.height, {
    inversionAttempts: 'dontInvert',
  });
  return code?.data ?? null;
}
