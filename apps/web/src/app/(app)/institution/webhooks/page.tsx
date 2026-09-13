import { ShieldCheck } from 'lucide-react';
import { SectionHeading } from '@/components/dashboard/stat-card';
import { webhooksApi } from '@/lib/api/endpoints/webhooks';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { WebhooksClient } from './webhooks-client';

export const dynamic = 'force-dynamic';

export default async function WebhooksPage() {
  const { token } = await requireSession();
  const list = (await safeFetch(() => webhooksApi.list(token))) ?? [];

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Webhooks"
        description="Recibe eventos firmados HMAC-SHA256 cuando ocurren cambios en tus certificados."
      />

      <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-5 py-4 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-300)]" />
        <p className="text-[var(--color-fg-muted)]">
          Cada request incluye el header{' '}
          <code className="font-mono text-[var(--color-brand-300)]">X-Tessera-Signature</code> con
          la firma HMAC-SHA256 del body usando el secret del webhook. Hasta 5 reintentos con
          back-off exponencial si tu endpoint responde con 5xx.
        </p>
      </div>

      <WebhooksClient
        initial={list.map((w) => ({
          id: w.id,
          url: w.url,
          events: w.events,
          disabledAt: w.disabledAt,
          createdAt: w.createdAt,
        }))}
      />

      {/* Verificación */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6">
        <h3 className="text-base font-semibold text-[var(--color-fg)]">
          Verificar la firma (Node.js)
        </h3>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-black/40 p-4 text-xs leading-relaxed text-[var(--color-fg-muted)]">
          {`import crypto from 'node:crypto';

function verify(rawBody, signatureHeader, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}`}
        </pre>
      </section>
    </div>
  );
}
