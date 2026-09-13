import { AlertCircle } from 'lucide-react';
import { SectionHeading } from '@/components/dashboard/stat-card';
import { apiKeysApi } from '@/lib/api/endpoints/api-keys';
import { requireSession, safeFetch } from '@/lib/dashboard';
import { ApiKeysClient } from './api-keys-client';
import { publicEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function ApiKeysPage() {
  const { token } = await requireSession();
  const list = (await safeFetch(() => apiKeysApi.list(token))) ?? [];

  return (
    <div className="space-y-6">
      <SectionHeading
        title="API Keys"
        description="Integra Tessera con tu LMS o backend. Cada clave se muestra UNA sola vez al crearla."
      />

      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-[var(--color-fg-muted)]">
          <strong className="text-[var(--color-fg)]">Trata cada clave como una contraseña.</strong>{' '}
          No la subas a Git ni la incluyas en código frontend. Usa solo en backends o Edge
          Functions.
        </p>
      </div>

      <ApiKeysClient
        initial={list.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          scopes: k.scopes,
          lastUsedAt: k.lastUsedAt,
          expiresAt: k.expiresAt,
          createdAt: k.createdAt,
        }))}
      />

      {/* Snippet */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6">
        <h3 className="text-base font-semibold text-[var(--color-fg)]">
          Ejemplo: emitir un certificado
        </h3>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          POST a <code className="font-mono text-[var(--color-brand-300)]">/v1/certificates</code>{' '}
          con el header <code className="font-mono text-[var(--color-brand-300)]">X-Api-Key</code>.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-black/40 p-4 text-xs leading-relaxed text-[var(--color-fg-muted)]">
          {`curl -X POST ${publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/v1/certificates \\
  -H "X-Api-Key: tss_prod_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "student": {
      "email": "alumno@example.com",
      "name": "Alumno Ejemplo",
      "walletAddress": "0x..."
    },
    "achievement": {
      "name": "Solidity Avanzado",
      "grade": 85
    },
    "idempotencyKey": "ord_2026_0001"
  }'`}
        </pre>
      </section>
    </div>
  );
}
