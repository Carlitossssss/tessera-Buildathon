import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle,
  Coins,
  ExternalLink,
  Info,
  ShieldCheck,
  Sparkles,
  Wallet as WalletIcon,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { meApi, type CreditBundleDto } from '@/lib/api/endpoints/me';
import { formatNumber, requireSession, safeFetch, shortAddr } from '@/lib/dashboard';
import { addressUrl } from '@/lib/explorer';

export const dynamic = 'force-dynamic';

export default async function WalletPage() {
  const { token } = await requireSession();
  const [wallet, credits, bundlesResp] = await Promise.all([
    safeFetch(() => meApi.wallet(token)),
    safeFetch(() => meApi.credits(token)),
    safeFetch<{ bundles: CreditBundleDto[] }>(() => meApi.creditBundles(token)),
  ]);

  if (!wallet) {
    return (
      <div className="space-y-6">
        <SectionHeading title="Wallet de emisor" />
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-[var(--color-fg-muted)]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium text-[var(--color-fg)]">No se pudo cargar la wallet</p>
              <p className="mt-1">
                Verifica que tu institución haya sido aprobada. Si el problema persiste, contacta a
                soporte.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const offline = !wallet.chainAvailable;
  const balance = credits?.balance ?? 0;
  const noCredits = Boolean(credits) && balance <= 0;
  const lowCredits = credits?.lowBalance ?? false;
  const tscPerCertificate = credits?.tscPerCertificate ?? 2;
  const bundleValidityMonths = Array.from(
    new Set((bundlesResp?.bundles ?? []).map((bundle) => bundle.validityMonths)),
  );
  const bundleValidityText =
    bundleValidityMonths.length === 1
      ? `Adquieres paquetes TSC con vigencia de ${bundleValidityMonths[0]} meses.`
      : 'Adquieres paquetes TSC con la vigencia indicada en cada paquete.';

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Wallet de emisor"
        description={`Esta es la dirección on-chain que firma tus certificados como emisor verificable. Tessera cubre el gas y la operación; cada certificado consume ${formatNumber(
          tscPerCertificate,
        )} TSC.`}
        actions={
          <Button asChild variant="secondary">
            <a
              href={addressUrl(wallet.walletAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              <ExternalLink className="h-4 w-4" />
              Ver en Polygonscan
            </a>
          </Button>
        }
      />

      {noCredits || lowCredits ? (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-5 py-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="flex-1 min-w-[200px] text-[var(--color-fg-muted)]">
            <strong className="text-[var(--color-fg)]">
              {noCredits ? 'Sin saldo TSC.' : `Tienes solo ${formatNumber(balance)} TSC.`}
            </strong>{' '}
            {noCredits
              ? 'Compra un paquete para poder emitir nuevos certificados.'
              : 'Para no interrumpir las próximas emisiones, recarga tu cuenta.'}
          </div>
          <Button asChild variant="primary">
            <Link href="/institution/credits" className="inline-flex items-center gap-1.5">
              <Coins className="h-4 w-4" />
              Comprar TSC
            </Link>
          </Button>
        </div>
      ) : null}

      {offline ? (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5 px-5 py-4 text-sm">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger-500)]" />
          <div className="text-[var(--color-fg-muted)]">
            <strong className="text-[var(--color-fg)]">Nodo Polygon no disponible.</strong> El
            estado on-chain mostrado puede no ser el más reciente.
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="TSC disponible"
          value={formatNumber(balance)}
          icon={Coins}
          hint={
            Math.floor(balance / tscPerCertificate) === 0
              ? 'Recarga para emitir'
              : Math.floor(balance / tscPerCertificate) === 1
                ? '1 emisión más'
                : `${formatNumber(Math.floor(balance / tscPerCertificate))} emisiones más`
          }
          trend={lowCredits ? { delta: 'Bajo' } : undefined}
        />
        <StatCard
          label="Emitidos este mes"
          value={formatNumber(credits?.emittedThisMonth ?? 0)}
          icon={Sparkles}
          hint={
            credits
              ? `${formatNumber(credits.emittedLast30Days)} en 30 días`
              : 'Sin datos recientes'
          }
        />
        <StatCard label="Red" value="Polygon" icon={ShieldCheck} hint="EVM · Chain ID 137" />
        <StatCard
          label="Operación"
          value="Tessera cubre gas"
          icon={CheckCircle}
          hint="Sin necesidad de MATIC"
        />
      </div>

      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)]">
              Dirección de emisor
            </p>
            <p className="mt-1 font-mono text-sm text-[var(--color-fg)] break-all">
              {wallet.walletAddress}
            </p>
            <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
              {shortAddr(wallet.walletAddress)} · Esta dirección queda registrada como{' '}
              <code className="rounded bg-white/[0.05] px-1 py-0.5 font-mono text-[10px]">
                issuer
              </code>{' '}
              en cada certificado on-chain.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CopyButton value={wallet.walletAddress} label="Copiar" />
            <Badge variant={offline ? 'danger' : 'success'}>
              {offline ? (
                <XCircle className="h-3 w-3 mr-1" />
              ) : (
                <CheckCircle className="h-3 w-3 mr-1" />
              )}
              {offline ? 'Sin RPC' : 'Activa'}
            </Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <InfoCard
          icon={ShieldCheck}
          title="Identidad verificable"
          body="Tu dirección queda inmortalizada en cada certificado emitido. Cualquier verificador (LinkedIn, empleadores, otros explorers) puede comprobar que el SBT proviene de tu institución consultando el campo issuer del contrato."
        />
        <InfoCard
          icon={WalletIcon}
          title="Sin claves privadas que gestionar"
          body="Tessera firma las emisiones en tu nombre desde infraestructura propia con nonce manager distribuido (Redis + Redlock). Tú no necesitas conocer ni proteger ninguna clave privada — y sigues siendo el emisor on-chain."
        />
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6">
        <h3 className="text-base font-semibold text-[var(--color-fg)]">
          ¿Cómo funciona el modelo?
        </h3>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3 text-sm text-[var(--color-fg-muted)]">
          <Step n={1} title="Compras TSC" text={bundleValidityText} />
          <Step
            n={2}
            title="Tessera firma y paga el gas"
            text={`Cada emisión consume exactamente ${formatNumber(
              tscPerCertificate,
            )} TSC. Nosotros pagamos el gas en Polygon y subimos los metadatos.`}
          />
          <Step
            n={3}
            title="Tu wallet aparece como emisor"
            text="El SBT queda registrado on-chain con tu dirección como issuer — verificable por cualquiera."
          />
        </ul>
        <div className="mt-5">
          <Button asChild variant="primary">
            <Link href="/institution/credits" className="inline-flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Gestionar TSC
            </Link>
          </Button>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-5 text-xs text-[var(--color-fg-subtle)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-300)]" />
        <p>
          Para inspeccionar transacciones individuales utiliza{' '}
          <a
            href={addressUrl(wallet.walletAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand-300)] hover:underline"
          >
            Polygonscan
          </a>
          . El historial de transacciones integrado llegará en una próxima versión.
        </p>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, body }: { icon: typeof Info; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-[var(--color-fg)]">{title}</h3>
      <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">{body}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4">
      <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-700)]/20 text-xs font-semibold text-[var(--color-brand-200)]">
        {n}
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--color-fg)]">{title}</p>
      <p className="mt-1 text-xs">{text}</p>
    </div>
  );
}
