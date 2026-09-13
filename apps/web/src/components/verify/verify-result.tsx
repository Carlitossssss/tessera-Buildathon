'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import {
  Award,
  ExternalLink,
  FileCheck,
  FileWarning,
  Hash,
  Network,
  ShieldAlert,
  ShieldCheck,
  User,
  Calendar,
  Database,
  ArrowLeft,
  Check,
  Copy,
  Download,
} from 'lucide-react';
import type { VerifyCertificateResponse } from '@/lib/api/endpoints/verify';
import { cn } from '@/lib/utils';
import { shortAddr, formatDate } from '@/lib/format';

interface Props {
  result: VerifyCertificateResponse;
  onReset?: () => void;
}

export function VerifyResult({ result, onReset }: Props) {
  const isValid = result.valid && result.reason !== 'not_found';
  const [copied, setCopied] = useState(false);

  async function copyVerificationLink() {
    if (!result.verifyUrl || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(result.verifyUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied by browser privacy settings.
    }
  }

  if (result.reason === 'not_found' || !result.certificate) {
    return (
      <div className="mx-auto mt-10 max-w-xl text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/10 text-[var(--color-warning-500)]">
          <FileWarning className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-[var(--color-fg)]">
          Certificado no encontrado
        </h2>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          No se encontró ningún certificado con ese tokenId o hash de transacción. Verificá que el
          ID sea correcto y que el certificado haya sido emitido en la cadena.
        </p>
        {onReset && (
          <button
            onClick={onReset}
            className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--color-brand-400)] transition hover:text-[var(--color-brand-300)]"
          >
            <ArrowLeft className="h-4 w-4" /> Verificar otro certificado
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-5xl">
      <div className="rounded-3xl border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,27,51,0.85),rgba(10,13,26,0.95))] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.88)]">
        <div
          className={cn(
            'flex items-center gap-3 border-b px-6 py-5 sm:px-8',
            isValid ? 'border-[var(--color-accent-500)]/30' : 'border-[var(--color-danger-500)]/30',
          )}
        >
          <span
            className={cn(
              'grid h-12 w-12 shrink-0 place-items-center rounded-2xl border',
              isValid
                ? 'border-[var(--color-accent-500)]/40 bg-[var(--color-accent-500)]/10 text-[var(--color-accent-400)]'
                : 'border-[var(--color-danger-500)]/40 bg-[var(--color-danger-500)]/10 text-[var(--color-danger-400)]',
            )}
          >
            {isValid ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
              Resultado de verificación
            </p>
            <p
              className={cn(
                'text-lg font-semibold',
                isValid ? 'text-[var(--color-accent-400)]' : 'text-[var(--color-danger-400)]',
              )}
            >
              {isValid ? 'Certificado auténtico y válido' : 'Certificado revocado'}
            </p>
          </div>
          <span
            className={cn(
              'ml-auto rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider',
              isValid
                ? 'border-[var(--color-accent-500)]/50 bg-[var(--color-accent-500)]/15 text-[var(--color-accent-400)]'
                : 'border-[var(--color-danger-500)]/50 bg-[var(--color-danger-500)]/15 text-[var(--color-danger-400)]',
            )}
          >
            {isValid ? 'Válido' : 'Revocado'}
          </span>
        </div>

        {result.storage.imageUrl && (
          <section className="mx-6 mt-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] sm:mx-8">
            <a
              href={result.storage.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block aspect-[1600/1130]"
              title="Abrir certificado a tamaño completo"
            >
              <Image
                src={result.storage.imageUrl}
                alt={`Certificado de ${result.certificate.achievement}`}
                fill
                unoptimized
                priority
                className="object-contain"
              />
            </a>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-black/10 px-4 py-3">
              <p className="text-xs text-[var(--color-fg-muted)]">
                Documento verificable vinculado al token #{result.certificate.tokenId}
              </p>
              <div className="flex flex-wrap gap-2">
                {result.storage.downloadUrl && (
                  <a
                    href={result.storage.downloadUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-fg)] transition hover:border-[var(--color-brand-400)] hover:text-[var(--color-brand-300)]"
                  >
                    <Download className="h-3.5 w-3.5" /> Descargar PNG
                  </a>
                )}
                {result.verifyUrl && (
                  <button
                    type="button"
                    onClick={copyVerificationLink}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-500)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--color-brand-400)]"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Enlace copiado' : 'Copiar verificación'}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2">
          <section>
            <SectionTitle icon={Award}>Logro</SectionTitle>
            <p className="mt-2 text-xl font-semibold text-[var(--color-fg)]">
              {result.certificate.achievement}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-fg-muted)]">
              {result.certificate.description}
            </p>
            <div className="mt-4 space-y-3">
              <InfoRow icon={User} label="Estudiante" value={result.certificate.studentName} />
              <InfoRow
                icon={FileCheck}
                label="Institución"
                value={result.certificate.institution}
              />
              {result.certificate.grade !== null && (
                <InfoRow label="Calificación" value={String(result.certificate.grade)} />
              )}
              {result.certificate.issuedAt && (
                <InfoRow
                  icon={Calendar}
                  label="Fecha de emisión"
                  value={formatDate(result.certificate.issuedAt)}
                />
              )}
              {result.certificate.tokenId && (
                <InfoRow
                  icon={Hash}
                  label="Token ID"
                  value={result.certificate.tokenId}
                  copyValue={result.certificate.tokenId}
                  mono
                />
              )}
            </div>
          </section>

          <section>
            <SectionTitle icon={Network}>Blockchain</SectionTitle>
            <div className="mt-2 space-y-3">
              <InfoRow label="Red" value={result.blockchain.network} />
              <InfoRow
                label="Confirmado"
                value={
                  result.blockchain.confirmed ? (
                    <span className="text-[var(--color-accent-400)]">Sí</span>
                  ) : (
                    <span className="text-[var(--color-warning-400)]">Pendiente</span>
                  )
                }
              />
              {result.blockchain.blockNumber && (
                <InfoRow
                  label="Bloque"
                  value={String(result.blockchain.blockNumber)}
                  copyValue={String(result.blockchain.blockNumber)}
                  mono
                />
              )}
              {result.blockchain.txHash && (
                <InfoRow
                  label="Tx Hash"
                  value={shortAddr(result.blockchain.txHash, 8, 6)}
                  copyValue={result.blockchain.txHash}
                  mono
                />
              )}
              {result.blockchain.polygonscanUrl && (
                <div className="mt-3">
                  <Link
                    href={result.blockchain.polygonscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-400)] transition hover:text-[var(--color-brand-300)]"
                  >
                    Ver transacción en PolygonScan <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
              {result.blockchain.nftUrl && (
                <div className="mt-2">
                  <Link
                    href={result.blockchain.nftUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-400)] transition hover:text-[var(--color-brand-300)]"
                  >
                    Ver NFT y actualizar metadata <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
              <div className="mt-3">
                <Link
                  href={result.blockchain.contractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-400)] transition hover:text-[var(--color-brand-300)]"
                >
                  Ver contrato ERC-721 <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </section>

          {/* Cada red donde vive el certificado.
              La verificacion hablaba solo de la red de emision, asi que una
              copia existente en Avalanche no aparecia y no habia forma de
              abrirla. Cada red trae su propio tokenId: los contratos llevan
              contadores independientes. */}
          {result.networks && result.networks.length > 0 && (
            <section>
              <SectionTitle icon={Network}>Redes</SectionTitle>
              <div className="mt-2 space-y-2.5">
                {result.networks.map((net) => (
                  <div
                    key={net.chainId}
                    className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-3.5 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[13px] font-medium text-[var(--color-fg)]">
                        {net.name}
                      </span>
                      <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                        {net.role === 'issuance' ? 'emisión' : 'réplica'}
                      </span>
                      <span
                        className={cn(
                          'ml-auto font-mono text-[11px]',
                          net.status === 'confirmed'
                            ? 'text-[var(--color-accent-400)]'
                            : net.status === 'failed'
                              ? 'text-[var(--color-danger-400)]'
                              : 'text-[var(--color-fg-muted)]',
                        )}
                      >
                        {net.status}
                      </span>
                    </div>

                    {net.tokenId && (
                      <p className="mt-1.5 font-mono text-[11px] text-[var(--color-fg-subtle)]">
                        Token #{net.tokenId}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                      {net.nftUrl && (
                        <Link
                          href={net.nftUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--color-brand-400)] transition hover:text-[var(--color-brand-300)]"
                        >
                          Ver NFT <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {net.txUrl && (
                        <Link
                          href={net.txUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--color-brand-400)] transition hover:text-[var(--color-brand-300)]"
                        >
                          Ver transacción <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      <Link
                        href={net.contractUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
                      >
                        Contrato <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionTitle icon={Database}>Almacenamiento permanente</SectionTitle>
            <div className="mt-2 space-y-3">
              {result.storage.arweaveUrl ? (
                <div>
                  <span className="text-xs text-[var(--color-fg-subtle)]">Arweave</span>
                  <Link
                    href={result.storage.arweaveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-0.5 text-sm text-[var(--color-brand-400)] transition hover:text-[var(--color-brand-300)] break-all"
                  >
                    {result.storage.arweaveUrl} <ExternalLink className="inline h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-[var(--color-fg-muted)]">
                  Metadata no disponible en Arweave
                </p>
              )}
              {result.storage.ipfsUrl ? (
                <div>
                  <span className="text-xs text-[var(--color-fg-subtle)]">IPFS</span>
                  <Link
                    href={result.storage.ipfsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-0.5 text-sm text-[var(--color-brand-400)] transition hover:text-[var(--color-brand-300)] break-all"
                  >
                    {result.storage.ipfsUrl} <ExternalLink className="inline h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-[var(--color-fg-muted)]">
                  Metadata no disponible en IPFS
                </p>
              )}
              {result.storage.imageIpfsUrl && (
                <div>
                  <span className="text-xs text-[var(--color-fg-subtle)]">
                    Imagen del certificado
                  </span>
                  <Link
                    href={result.storage.imageIpfsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-0.5 text-sm text-[var(--color-brand-400)] transition hover:text-[var(--color-brand-300)] break-all"
                  >
                    Ver imagen en IPFS <ExternalLink className="inline h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section>
            <SectionTitle icon={User}>Detalles on-chain</SectionTitle>
            <div className="mt-2 space-y-3">
              {/* Las wallets se muestran abreviadas para que quepan, pero se
                  copian enteras: media direccion no sirve para comparar ni
                  para pegar en un explorador. */}
              {result.certificate.studentWallet && (
                <InfoRow
                  label="Wallet del estudiante"
                  value={shortAddr(result.certificate.studentWallet, 6, 4)}
                  copyValue={result.certificate.studentWallet}
                  mono
                />
              )}
              {result.certificate.issuedByWallet && (
                <InfoRow
                  label="Wallet emisora"
                  value={shortAddr(result.certificate.issuedByWallet, 6, 4)}
                  copyValue={result.certificate.issuedByWallet}
                  mono
                />
              )}
              <InfoRow
                label="Contrato ERC-721"
                value={shortAddr(result.blockchain.contractAddress, 6, 4)}
                copyValue={result.blockchain.contractAddress}
                mono
              />
              <InfoRow
                label="Estado"
                value={
                  result.status === 'issued' ? (
                    <span className="text-[var(--color-accent-400)]">Emitido</span>
                  ) : result.status === 'revoked' ? (
                    <span className="text-[var(--color-danger-400)]">Revocado</span>
                  ) : (
                    <span className="text-[var(--color-fg-muted)]">{result.status}</span>
                  )
                }
              />
            </div>
          </section>
        </div>

        {!isValid && result.revokedAt && (
          <div className="mx-6 mb-6 rounded-2xl border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/10 px-5 py-4 sm:mx-8 sm:mb-8">
            <p className="text-sm font-semibold text-[var(--color-danger-300)]">
              Este certificado fue revocado
            </p>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              Fecha de revocación: {formatDate(result.revokedAt)}
            </p>
            {result.revokeReason && (
              <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                Motivo: {result.revokeReason}
              </p>
            )}
          </div>
        )}

        {onReset && (
          <div className="border-t border-[var(--color-border)] px-6 py-4 sm:px-8">
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 text-sm text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
            >
              <ArrowLeft className="h-4 w-4" /> Verificar otro certificado
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Award; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
  copyValue,
}: {
  icon?: typeof Award;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  copyValue?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)]">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </dt>
      <dd
        className={cn(
          'text-right text-xs text-[var(--color-fg)] break-all',
          mono && 'font-mono text-[var(--color-brand-200)]',
        )}
      >
        {value}
        {copyValue && <CopyText text={copyValue} />}
      </dd>
    </div>
  );
}

function CopyText({ text }: { text: string }) {
  function handleCopy() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text);
      }
    } catch {
      // clipboard no disponible (HTTP sin localhost, browser antiguo)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1.5 text-[var(--color-fg-subtle)] transition hover:text-[var(--color-fg-muted)]"
      title="Copiar"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  );
}
