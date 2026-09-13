import Link from 'next/link';
import { AlertCircle, Building2, ExternalLink, Wallet } from 'lucide-react';
import { SectionHeading } from '@/components/dashboard/stat-card';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { meApi } from '@/lib/api/endpoints/me';
import { formatDate, requireSession, safeFetch, shortAddr } from '@/lib/dashboard';
import { getPlan } from '@/lib/plans';
import { addressUrl } from '@/lib/explorer';
import { AccountDeletionAction } from '../../account-deletion-action';
import { InstitutionRejectionNotice } from '../institution-rejection-notice';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

const STATUS_META: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }
> = {
  approved: { label: 'Aprobada', variant: 'success' },
  pending: { label: 'En revisión', variant: 'warning' },
  revoked: { label: 'Rechazada', variant: 'danger' },
  suspended: { label: 'Suspendida', variant: 'danger' },
};

export default async function SettingsPage() {
  const { token, session } = await requireSession();
  const [me, subscriptionResponse, stats, credits] = await Promise.all([
    safeFetch(() => meApi.institution(token)),
    safeFetch(() => meApi.subscriptions(token)),
    safeFetch(() => meApi.stats(token)),
    safeFetch(() => meApi.credits(token)),
  ]);

  if (!me) {
    return (
      <div className="space-y-6">
        <SectionHeading title="Configuración" />
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-[var(--color-fg-muted)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          No se pudo cargar la información de tu institución.
        </div>
      </div>
    );
  }

  const status = STATUS_META[me.institution.status] ?? {
    label: me.institution.status,
    variant: 'default' as const,
  };
  const activeSubscription =
    subscriptionResponse?.subscriptions.find((item) => item.status === 'active') ?? null;
  const planLabel = activeSubscription ? getPlan(activeSubscription.planCode).name : null;
  const usedThisMonth = stats?.certificates.issuedThisMonth ?? 0;
  const monthlyQuota = activeSubscription
    ? Math.floor(activeSubscription.monthlyTsc / (credits?.tscPerCertificate ?? 2))
    : 0;
  const polygonscanUrl = me.institution.walletAddress
    ? addressUrl(me.institution.walletAddress)
    : null;

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Configuración de la institución"
        description="Datos públicos que aparecen en certificados emitidos y verificación pública."
      />

      {me.institution.status === 'revoked' && (
        <InstitutionRejectionNotice reason={me.institution.rejectionReason} />
      )}

      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6">
        <SettingsForm
          initial={{
            name: me.institution.name,
            website: me.institution.website,
            description: me.institution.description,
            country: me.institution.country,
            legalName: me.institution.legalName,
            taxId: me.institution.taxId,
            addressLine: me.institution.addressLine,
            city: me.institution.city,
            stateRegion: me.institution.stateRegion,
            postalCode: me.institution.postalCode,
            contactName: me.institution.contactName,
            contactEmail: me.institution.contactEmail,
            contactPhone: me.institution.contactPhone,
            accreditationId: me.institution.accreditationId,
            profileSubmittedAt: me.institution.profileSubmittedAt,
          }}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
            <Building2 className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-[var(--color-fg)]">Identificadores</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <RowKV k="ID interno" mono copyable v={me.institution.id} />
            <RowKV k="Slug" mono copyable v={me.institution.slug} />
            <RowKV
              k="Suscripción"
              custom={
                <div className="flex items-center gap-2">
                  <Badge variant={planLabel ? 'brand' : 'default'}>
                    {planLabel ?? 'Sin suscripción activa'}
                  </Badge>
                  <Link
                    href="/institution/plan"
                    className="inline-flex items-center gap-1 text-xs text-[var(--color-brand-300)] hover:underline"
                  >
                    Ver planes
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              }
            />
            <RowKV k="Estado" custom={<Badge variant={status.variant}>{status.label}</Badge>} />
            <RowKV
              k="Perfil enviado"
              v={
                me.institution.profileSubmittedAt
                  ? formatDate(me.institution.profileSubmittedAt)
                  : '—'
              }
            />
            <RowKV k="Aprobada el" v={formatDate(me.institution.approvedAt) || '—'} />
          </dl>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
            <Wallet className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-[var(--color-fg)]">Wallet on-chain</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <RowKV
              k="Dirección"
              mono
              copyable
              v={me.institution.walletAddress || '—'}
              copyValue={me.institution.walletAddress ?? undefined}
            />
            <RowKV k="Corta" mono v={shortAddr(me.institution.walletAddress) || '—'} />
            <RowKV k="Red" v="Polygon Mainnet" />
            <RowKV
              k="Cuota mensual"
              v={`${usedThisMonth.toLocaleString('es-PE')} / ${monthlyQuota.toLocaleString('es-PE')}`}
            />
            {polygonscanUrl && (
              <div className="pt-2">
                <a
                  href={polygonscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-brand-300)] hover:underline"
                >
                  Ver en Polygonscan
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </dl>
        </div>
      </section>

      <section className="rounded-[26px] border border-red-500/30 bg-red-500/[0.04] p-6">
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">
          Eliminar mi cuenta
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
          Al confirmar, tu cuenta quedará bloqueada y la institución asociada dejará de operar en
          Tessera. Los certificados on-chain conservan su trazabilidad por su naturaleza inmutable.
        </p>
        <div className="mt-5">
          <AccountDeletionAction
            accountRole="institution_admin"
            selectedName={session.user.name ?? me.institution.name}
            selectedDetail={session.user.email ?? me.institution.name}
          />
        </div>
      </section>
    </div>
  );
}

interface RowKVProps {
  k: string;
  v?: string;
  mono?: boolean;
  copyable?: boolean;
  copyValue?: string;
  custom?: React.ReactNode;
}

function RowKV({ k, v, mono, copyable, copyValue, custom }: RowKVProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] pb-2 last:border-0 last:pb-0">
      <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {k}
      </dt>
      <dd className="flex items-center gap-2 text-right text-sm text-[var(--color-fg)]">
        {custom ?? <span className={mono ? 'font-mono break-all' : 'capitalize'}>{v}</span>}
        {copyable && (copyValue ?? v) && (
          <CopyButton value={copyValue ?? v ?? ''} variant="ghost" />
        )}
      </dd>
    </div>
  );
}
