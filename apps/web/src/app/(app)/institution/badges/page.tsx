import Image from 'next/image';
import { Award, ImageIcon, Layers } from 'lucide-react';
import { EmptyState, SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { formatDate, formatNumber, requireSession, safeFetch } from '@/lib/dashboard';
import { pendingApprovalGate } from '../approval-gate';
import { CreateBadgeDialog } from './create-badge-dialog';

export const dynamic = 'force-dynamic';

export default async function BadgesPage() {
  const { token } = await requireSession();
  const approvalGate = await pendingApprovalGate(token);
  if (approvalGate) return approvalGate;

  const list = await safeFetch(() => meApi.badgeCollections(token));
  const collections = list?.data ?? [];

  const totalMinted = collections.reduce((acc, c) => acc + c.minted, 0);
  const totalSupply = collections.reduce((acc, c) => acc + (c.maxSupply ?? 0), 0);
  const onchain = collections.filter((c) => c.onchainCollectionId).length;

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Badges & Colecciones"
        description="Insignias ERC-1155 para hitos como participación, ranking o reconocimientos. Compatibles con OpenSea."
        actions={<CreateBadgeDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Colecciones" value={formatNumber(collections.length)} icon={Layers} />
        <StatCard
          label="Badges emitidos"
          value={formatNumber(totalMinted)}
          icon={Award}
          hint={totalSupply ? `de ${formatNumber(totalSupply)} máximo` : 'Suministro abierto'}
        />
        <StatCard label="On-chain" value={formatNumber(onchain)} icon={ImageIcon} />
      </div>

      {collections.length === 0 ? (
        <EmptyState
          icon={Award}
          title="Sin colecciones aún"
          description="Crea tu primera colección de badges para premiar participación, ranking o hitos."
          action={<CreateBadgeDialog cta="Crear primera colección" />}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {collections.map((c) => {
            const ratio =
              c.maxSupply && c.maxSupply > 0
                ? Math.min(100, Math.round((c.minted / c.maxSupply) * 100))
                : null;
            return (
              <article
                key={c.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02] transition hover:border-[var(--color-brand-500)]/50"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[var(--color-brand-700)]/30 to-[var(--color-accent-500)]/30">
                  {c.imageUrl ? (
                    <Image
                      src={c.imageUrl}
                      alt={c.name}
                      fill
                      className="object-cover transition group-hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Award className="h-12 w-12 text-[var(--color-brand-300)]/60" />
                    </div>
                  )}
                  {c.onchainCollectionId && (
                    <span className="absolute top-3 right-3 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur">
                      #{c.onchainCollectionId}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-3 p-5">
                  <header>
                    <h3 className="text-base font-semibold text-[var(--color-fg)]">{c.name}</h3>
                    {c.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-fg-muted)]">
                        {c.description}
                      </p>
                    )}
                  </header>

                  <div className="mt-auto space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-fg-subtle)]">Emitidos</span>
                      <span className="font-mono text-[var(--color-fg)]">
                        {formatNumber(c.minted)}
                        {c.maxSupply ? ` / ${formatNumber(c.maxSupply)}` : ''}
                      </span>
                    </div>
                    {ratio !== null && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full rounded-full bg-[var(--color-brand-500)]"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-[var(--color-fg-subtle)]">
                      Creada {formatDate(c.createdAt)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
