'use client';

import { useT } from '@tessera/i18n';
import { Marquee } from '@/components/fx/marquee';

const wordmarks = [
  'Polygon',
  'OpenZeppelin',
  'Arweave',
  'IPFS',
  'Pinata',
  'Chainlink',
  'Cloudflare R2',
  'Vercel',
  'Sentry',
  'Stripe',
];

export function LogoCloud() {
  const t = useT();
  return (
    <section className="relative isolate border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]/40 py-16">
      <div className="container-page">
        <p className="text-center text-xs uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          {t.marketing.ecosystem.title}
        </p>
        <div className="mt-10 space-y-4">
          <Marquee duration={36}>
            {wordmarks.map((w) => (
              <Wordmark key={w} label={w} />
            ))}
          </Marquee>
          <Marquee duration={42} reverse>
            {[...wordmarks].reverse().map((w) => (
              <Wordmark key={`r-${w}`} label={w} />
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}

function Wordmark({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-white/[0.02] px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
      {label}
    </span>
  );
}
