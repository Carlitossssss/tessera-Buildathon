'use client';

import { useEffect, useState, use } from 'react';
import { Loader2 } from 'lucide-react';
import { verifyApi, type VerifyCertificateResponse } from '@/lib/api/endpoints/verify';
import { VerifyResult } from '@/components/verify/verify-result';
import { ProvenancePanel } from './provenance-panel';
import { AccreditationPanel } from '@/components/verify/accreditation-panel';
import { useT } from '@tessera/i18n';

interface Props {
  params: Promise<{ tokenId: string }>;
}

export function VerifyResultClient({ params }: Props) {
  const t = useT();
  const { tokenId } = use(params);
  const [result, setResult] = useState<VerifyCertificateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await verifyApi.verify({ tokenId });
        if (!cancelled) {
          setResult(res);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t.public.verify.form.errors.verifyFailed);
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [tokenId, t.public.verify.form.errors.verifyFailed]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--color-brand-400)]" />
          <p className="mt-4 text-sm text-[var(--color-fg-muted)]">
            {t.public.verify.result.verifying.replace('{id}', tokenId)}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[var(--color-danger-400)]">{error}</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="px-4 sm:px-6">
        <div className="mx-auto max-w-5xl py-10 sm:py-16">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-brand-300)]">
              {t.public.verify.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-4xl">
              {t.public.verify.result.certificateTitle.replace('{id}', tokenId)}
            </h1>
          </div>
          <VerifyResult result={result} />
          {/* Procedencia RWA: quien emitio, si estaba autorizado y si el token
              puede venderse. Se lee del contrato, no de nuestra base. */}
          <ProvenancePanel tokenId={tokenId} />
          {/* Quien emitio este certificado, y si los contratos lo reconocen
              como institucion acreditada. */}
          {result.certificate.institutionSlug ? (
            <div className="mt-6">
              <AccreditationPanel slug={result.certificate.institutionSlug} />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return null;
}
