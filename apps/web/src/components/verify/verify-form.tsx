'use client';

import { useEffect, useState, useTransition, useRef } from 'react';
import { Search, ShieldCheck, Loader2, Upload, QrCode, Hash, Camera } from 'lucide-react';
import { useT, type Dictionary } from '@tessera/i18n';
import { verifyApi, type VerifyCertificateResponse } from '@/lib/api/endpoints/verify';
import { VerifyResult } from './verify-result';
import { QrCameraScanner } from './qr-camera-scanner';
import { extractCertificateLookup } from './qr-utils';
import { decodeQrFromFile, detectFileType } from './qr-decoder';

type Tab = 'txhash' | 'file' | 'camera';

/** Las tres formas de verificar, en el idioma activo. */
function tabsFor(t: Dictionary): { id: Tab; label: string; icon: typeof Hash }[] {
  return [
    { id: 'txhash', label: t.public.verify.form.tabs.txhash, icon: Hash },
    { id: 'file', label: t.public.verify.form.tabs.file, icon: Upload },
    { id: 'camera', label: t.public.verify.form.tabs.camera, icon: Camera },
  ];
}

export function VerifyForm({ initialCertificateId }: { initialCertificateId?: string }) {
  const t = useT();
  const tabs = tabsFor(t);
  const [tab, setTab] = useState<Tab>('txhash');
  const [txHash, setTxHash] = useState('');
  const [result, setResult] = useState<VerifyCertificateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showCamera, setShowCamera] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialCertificateId) return;

    startTransition(async () => {
      try {
        setResult(await verifyApi.verify({ certificateId: initialCertificateId }));
      } catch (err) {
        setError(err instanceof Error ? err.message : t.public.verify.form.errors.verifyFailed);
      }
    });
  }, [initialCertificateId, t]);

  function handleTxSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = txHash.trim();
    if (!trimmed) return;
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const res = await verifyApi.verify({ txHash: trimmed });
        setResult(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.public.verify.form.errors.verifyFailed);
      }
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!detectFileType(file)) {
      setFileError(t.public.verify.form.errors.fileType);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setFileError(null);
    setError(null);
    setResult(null);
    setFileLoading(true);

    try {
      const raw = await decodeQrFromFile(file);

      if (!raw) {
        setFileError(
          file.type === 'application/pdf'
            ? t.public.verify.form.errors.noQrPdf
            : t.public.verify.form.errors.noQrImage,
        );
        return;
      }

      const lookup = extractCertificateLookup(raw);
      if (!lookup) {
        setFileError(
          t.public.verify.form.errors.invalidQrFile + raw.slice(0, 40) + '…',
        );
        return;
      }

      const res = await verifyApi.verify(lookup);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.public.verify.form.errors.fileFailed);
    } finally {
      setFileLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleQrScan(raw: string) {
    setShowCamera(false);
    setError(null);

    const lookup = extractCertificateLookup(raw);
    if (!lookup) {
      setError(
        t.public.verify.form.errors.invalidQrScan + raw.slice(0, 40) + '…',
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await verifyApi.verify(lookup);
        setResult(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.public.verify.form.errors.verifyFailed);
      }
    });
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setTxHash('');
    setFileError(null);
  }

  if (result) {
    return <VerifyResult result={result} onReset={handleReset} />;
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-3xl border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.85),rgba(10,13,26,0.95))] p-8 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] bg-white/5 text-[var(--color-brand-200)]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
              {t.public.verify.form.card.eyebrow}
            </p>
            <h1 className="text-xl font-semibold text-[var(--color-fg)]">
              {t.public.verify.form.card.title}
            </h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
          {t.public.verify.form.card.body}
        </p>

        <div className="mt-6 flex rounded-xl border border-[var(--color-border)] bg-white/[0.03] p-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setError(null);
                  setFileError(null);
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition ${
                  tab === item.id
                    ? 'bg-[var(--color-brand-500)] text-white'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === 'txhash' && (
          <form onSubmit={handleTxSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
                {t.public.verify.form.hashLabel}
              </span>
              <div className="relative mt-2">
                <input
                  type="text"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="0x7af2c1a4b8e3…"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[rgba(14,18,36,0.7)] px-4 py-3 pr-12 font-mono text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-brand-400)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-brand-500),transparent_60%)]"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]">
                  <Search className="h-4 w-4" />
                </span>
              </div>
            </label>

            {error && (
              <p className="rounded-lg border border-[color-mix(in_oklab,var(--color-danger-500),transparent_60%)] bg-[color-mix(in_oklab,var(--color-danger-500),transparent_88%)] px-3 py-2 text-xs text-[var(--color-danger-300)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending || !txHash.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-500)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-400)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />{' '}
                  {t.public.verify.form.verifying}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" /> {t.public.verify.form.verifyByHash}
                </>
              )}
            </button>
          </form>
        )}

        {tab === 'file' && (
          <div className="mt-5 space-y-4">
            <label
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition ${
                fileLoading
                  ? 'border-[var(--color-brand-500)]/50 bg-[var(--color-brand-500)]/5'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-white/[0.02]'
              }`}
            >
              {fileLoading ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-400)]" />
                  <p className="text-sm text-[var(--color-fg-muted)]">
                    {t.public.verify.form.upload.processing}
                  </p>
                </>
              ) : (
                <>
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-fg-muted)]">
                    <QrCode className="h-7 w-7" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[var(--color-fg)]">
                      {t.public.verify.form.upload.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                      {t.public.verify.form.upload.body}
                    </p>
                  </div>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={handleFileChange}
                disabled={fileLoading}
                className="hidden"
              />
            </label>

            {(error || fileError) && (
              <p className="rounded-lg border border-[color-mix(in_oklab,var(--color-danger-500),transparent_60%)] bg-[color-mix(in_oklab,var(--color-danger-500),transparent_88%)] px-3 py-2 text-xs text-[var(--color-danger-300)]">
                {fileError || error}
              </p>
            )}
          </div>
        )}

        {tab === 'camera' && !showCamera && (
          <div className="mt-5 space-y-4">
            <button
              type="button"
              onClick={() => {
                setShowCamera(true);
                setError(null);
              }}
              className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--color-border)] px-6 py-10 transition hover:border-[var(--color-border-strong)] hover:bg-white/[0.02]"
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-fg-muted)]">
                <Camera className="h-7 w-7" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--color-fg)]">
                  {t.public.verify.form.camera.title}
                </p>
                <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                  {t.public.verify.form.camera.body}
                </p>
              </div>
            </button>
          </div>
        )}

        {tab === 'camera' && showCamera && (
          <div className="mt-5">
            <QrCameraScanner onScan={handleQrScan} onClose={() => setShowCamera(false)} />
          </div>
        )}

        {error && tab !== 'file' && (
          <p className="mt-4 rounded-lg border border-[color-mix(in_oklab,var(--color-danger-500),transparent_60%)] bg-[color-mix(in_oklab,var(--color-danger-500),transparent_88%)] px-3 py-2 text-xs text-[var(--color-danger-300)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
