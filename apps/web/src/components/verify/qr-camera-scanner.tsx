'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { decodeQrFromCanvas } from './qr-decoder';

interface Props {
  onScan: (rawValue: string) => void;
  onClose: () => void;
}

type Status = 'starting' | 'scanning' | 'error' | 'detected';

const SCAN_INTERVAL_MS = 250;
const SCAN_MAX_WIDTH = 720;

export function QrCameraScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function start() {
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            'Tu navegador no permite acceso a la cámara. Probá con un navegador actualizado o subí una imagen del QR.',
          );
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        scratchRef.current = document.createElement('canvas');
        setStatus('scanning');

        interval = setInterval(() => {
          if (cancelled) return;
          const v = videoRef.current;
          const scratch = scratchRef.current;
          if (!v || !scratch || v.readyState < 2 || v.videoWidth === 0) return;

          try {
            const vw = v.videoWidth;
            const vh = v.videoHeight;
            const scale = Math.min(1, SCAN_MAX_WIDTH / vw);
            const w = Math.max(1, Math.round(vw * scale));
            const h = Math.max(1, Math.round(vh * scale));
            if (scratch.width !== w) scratch.width = w;
            if (scratch.height !== h) scratch.height = h;
            const ctx = scratch.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;
            ctx.drawImage(v, 0, 0, w, h);
            const result = decodeQrFromCanvas(scratch);
            if (result && !cancelled) {
              setStatus('detected');
              if (interval) clearInterval(interval);
              stopCamera();
              onScan(result);
            }
          } catch {
            // frame ilegible, intentar el siguiente
          }
        }, SCAN_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
            setErrorMsg(
              'Permiso de cámara denegado. Permití el acceso desde la configuración del navegador.',
            );
            return;
          }
          if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
            setErrorMsg('No se encontró ninguna cámara disponible en este dispositivo.');
            return;
          }
          if (err.name === 'NotReadableError') {
            setErrorMsg(
              'La cámara está en uso por otra aplicación. Cerrá la otra app e intentá de nuevo.',
            );
            return;
          }
        }
        setErrorMsg(err instanceof Error ? err.message : 'No se pudo acceder a la cámara.');
      }
    }

    start();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      stopCamera();
    };
  }, [onScan, stopCamera]);

  return (
    <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black">
      {status === 'starting' && (
        <div className="flex aspect-[4/3] items-center justify-center bg-black/90">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--color-brand-400)]" />
            <p className="mt-3 text-sm text-[var(--color-fg-muted)]">Iniciando cámara…</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
          <AlertTriangle className="h-10 w-10 text-[var(--color-warning-400)]" />
          <p className="text-sm text-[var(--color-fg-muted)]">{errorMsg}</p>
        </div>
      )}

      {(status === 'scanning' || status === 'detected') && (
        <div className="relative aspect-[4/3]">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            playsInline
          />
          <div className="absolute inset-0 border-2 border-[var(--color-brand-400)]/60" />
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-6 top-6 h-12 w-12 rounded-tl-2xl border-l-3 border-t-3 border-[var(--color-brand-400)]" />
            <div className="absolute right-6 top-6 h-12 w-12 rounded-tr-2xl border-r-3 border-t-3 border-[var(--color-brand-400)]" />
            <div className="absolute bottom-6 left-6 h-12 w-12 rounded-bl-2xl border-b-3 border-l-3 border-[var(--color-brand-400)]" />
            <div className="absolute bottom-6 right-6 h-12 w-12 rounded-br-2xl border-b-3 border-r-3 border-[var(--color-brand-400)]" />
          </div>
          {status === 'scanning' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-5 py-2 text-xs text-[var(--color-fg-muted)] backdrop-blur-sm">
              Apuntá la cámara al código QR del certificado
            </div>
          )}
          {status === 'detected' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--color-accent-400)]" />
                <p className="mt-2 text-sm text-[var(--color-accent-300)]">QR detectado</p>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => {
          stopCamera();
          onClose();
        }}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl bg-black/60 text-[var(--color-fg-muted)] backdrop-blur-sm transition hover:bg-black/80 hover:text-[var(--color-fg)]"
        aria-label="Cerrar escáner"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
