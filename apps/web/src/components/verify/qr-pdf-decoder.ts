'use client';

import * as pdfjs from 'pdfjs-dist';
import { decodeImageSource } from './qr-decoder';

const MAX_PAGES = 5;
const TARGET_LONG_EDGE = 1600;

let workerConfigured = false;
function ensureWorker() {
  if (workerConfigured) return;
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  workerConfigured = true;
}

export async function decodeQrFromPdf(file: File): Promise<string | null> {
  ensureWorker();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    disableAutoFetch: true,
    disableStream: true,
  });
  const doc = await loadingTask.promise;
  try {
    const pages = Math.min(doc.numPages, MAX_PAGES);
    for (let n = 1; n <= pages; n++) {
      const page = await doc.getPage(n);
      try {
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(3, TARGET_LONG_EDGE / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const code = decodeImageSource(canvas, canvas.width, canvas.height, 'attemptBoth');
        if (code) return code;
      } finally {
        page.cleanup();
      }
    }
    return null;
  } finally {
    await doc.destroy();
  }
}
