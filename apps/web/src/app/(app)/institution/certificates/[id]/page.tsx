import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, FileSignature, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { formatDate, requireSession, safeFetch } from '@/lib/dashboard';
import { pendingApprovalGate } from '../../approval-gate';
import { RetryMirror } from './retry-mirror';
import { PortalOriginPanel } from './portal-origin';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }
> = {
  issued: { label: 'Emitido', variant: 'success' },
  queued: { label: 'En cola', variant: 'warning' },
  processing: { label: 'Procesando', variant: 'warning' },
  failed: { label: 'Falló', variant: 'danger' },
  revoked: { label: 'Revocado', variant: 'default' },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CertificateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { token } = await requireSession();
  const approvalGate = await pendingApprovalGate(token);
  if (approvalGate) return approvalGate;
  const cert = await safeFetch(() => meApi.certificate(token, id));
  if (!cert) notFound();

  const status = STATUS_LABEL[cert.status] ?? STATUS_LABEL.queued!;

  return (
    <div className="space-y-6">
      <Link
        href="/institution/certificates"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a certificados
      </Link>

      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              Certificado
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
              {cert.achievementName}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
              {cert.studentName} · {cert.studentEmail}
            </p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        {cert.imageUrl ? (
          <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">Documento visual verificable</p>
                <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                  La copia descargable contiene los datos del certificado.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {cert.downloadUrl ? (
                  <Button asChild size="sm" variant="secondary">
                    <a href={cert.downloadUrl}>Descargar PNG</a>
                  </Button>
                ) : null}
                <Button asChild size="sm">
                  <a href={cert.imageUrl} target="_blank" rel="noopener noreferrer">
                    Abrir completo <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
            <a
              href={cert.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative mx-auto block aspect-[1600/1130] w-full max-w-4xl bg-black/20"
            >
              <Image
                src={cert.imageUrl}
                alt={`Certificado de ${cert.studentName}`}
                fill
                unoptimized
                priority
                className="object-contain"
              />
            </a>
          </section>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Token" value={cert.tokenId ? `#${cert.tokenId}` : '—'} icon={ShieldCheck} />
          <StatCard label="Nota" value={cert.grade != null ? String(cert.grade) : '—'} icon={FileSignature} />
          <StatCard label="Curso" value={cert.courseTitle ?? '—'} />
          <StatCard label="Plantilla" value={cert.templateName ?? '—'} />
        </div>

        <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2">
          <Info label="Wallet estudiante" value={cert.studentWallet ?? '—'} mono />
          <Info label="Creado" value={formatDate(cert.createdAt)} />
          <Info label="Emitido" value={cert.issuedAt ? formatDate(cert.issuedAt) : '—'} />
          <Info label="Bloque" value={cert.blockNumber ?? '—'} mono />
          <Info label="Token URI" value={cert.tokenUri ?? '—'} mono />
          <Info label="IPFS CID" value={cert.ipfsCid ?? '—'} mono />
          {cert.failureReason ? <Info label="Motivo de fallo" value={cert.failureReason} /> : null}
        </dl>

        {cert.chains && cert.chains.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5">
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">Redes</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-fg-muted)]">
              La red principal determina la validez del certificado. Las réplicas son copias del
              mismo contenido; cada una enlaza a su propio explorador.
            </p>
            <ul className="mt-4 space-y-2">
              {cert.chains.map((chain) => (
                <li
                  key={chain.chainId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-4 py-2.5"
                >
                  <span className="text-sm font-medium text-[var(--color-fg)]">{chain.name}</span>
                  <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                    {chain.chainId}
                  </span>
                  {chain.role === 'primary' ? (
                    <span className="rounded-full bg-[var(--color-brand-500)]/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-brand-200)]">
                      principal
                    </span>
                  ) : (
                    <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
                      réplica
                    </span>
                  )}
                  <span
                    className={
                      chain.status === 'confirmed'
                        ? 'font-mono text-[11px] text-emerald-400'
                        : chain.status === 'failed'
                          ? 'font-mono text-[11px] text-[var(--color-danger-500)]'
                          : 'font-mono text-[11px] text-[var(--color-fg-muted)]'
                    }
                  >
                    {chain.status}
                  </span>
                  {chain.explorerUrl ? (
                    <a
                      href={chain.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--color-brand-300)] hover:underline"
                    >
                      Ver <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {chain.failureReason ? (
                    <p className="w-full text-[11px] leading-relaxed text-[var(--color-danger-500)]">
                      {chain.failureReason}
                      {chain.attempts ? ` · ${chain.attempts} intento(s)` : ''}
                    </p>
                  ) : null}
                  {chain.role === 'mirror' && chain.status !== 'confirmed' ? (
                    <RetryMirror
                      accessToken={token}
                      certificateId={cert.id}
                      chainId={chain.chainId}
                      chainName={chain.name}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <PortalOriginPanel certificateId={id} />

        <div className="mt-6 flex flex-wrap gap-2">
          {cert.transactionUrl ? (
            <Button asChild variant="secondary">
              <a
                href={cert.transactionUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" /> Transacción en Polygon
              </a>
            </Button>
          ) : null}
          {cert.tokenId ? (
            <Button asChild>
              <Link href={`/verify/${cert.tokenId}`}>Verificación pública</Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <a href={cert.contractUrl} target="_blank" rel="noopener noreferrer">
              Contrato en Polygon <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-4 py-3">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-[var(--color-fg)] ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
