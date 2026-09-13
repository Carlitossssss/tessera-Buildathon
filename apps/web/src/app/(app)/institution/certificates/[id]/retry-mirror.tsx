'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { meApi } from '@/lib/api/endpoints/me';

interface Props {
  accessToken: string;
  certificateId: string;
  chainId: number;
  chainName: string;
}

/**
 * Reintenta la replica en una red espejo.
 *
 * Solo aparece cuando la replica fallo: el certificado principal ya existe
 * on-chain y este boton no lo toca, asi que reintentar es seguro y no consume
 * un credito de emision.
 */
export function RetryMirror({ accessToken, certificateId, chainId, chainName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await meApi.retryMirror(accessToken, certificateId, chainId);
      if (result.status !== 'confirmed' && result.error) {
        setError(result.error);
      }
      // Refresca el detalle para mostrar el estado que quedo persistido.
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : `No pudimos reintentar en ${chainName}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={retry}
        disabled={busy || pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-brand-500)]/50 hover:text-[var(--color-fg)] disabled:opacity-60"
      >
        {busy || pending ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Reintentando…
          </>
        ) : (
          <>
            <RefreshCw className="h-3 w-3" /> Reintentar
          </>
        )}
      </button>
      {error ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-danger-500)]">{error}</p>
      ) : null}
    </div>
  );
}
