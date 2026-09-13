'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Provider = 'google' | 'microsoft' | 'github' | 'apple';

interface SocialButtonsProps {
  next?: string;
  audience: 'institution' | 'student' | 'teacher';
}

/**
 * Botones SSO. Sólo `google` está activo en backend; el resto se muestran
 * con apariencia consistente y un toast informativo si todavía no están
 * habilitados (configurables vía env por workspace).
 */
export function SocialButtons({ next = '/', audience }: SocialButtonsProps) {
  const [pending, setPending] = useState<Provider | null>(null);

  const handle = async (provider: Provider) => {
    if (provider !== 'google') {
      toast.message('Disponible muy pronto', {
        description:
          provider === 'microsoft'
            ? 'SSO con Microsoft Entra ID se habilita por workspace institucional.'
            : provider === 'apple'
              ? 'Sign in with Apple llegará en la próxima release.'
              : 'GitHub OAuth llegará en la próxima release.',
      });
      return;
    }
    setPending(provider);
    try {
      await signIn('google', { callbackUrl: next });
    } catch {
      toast.error('No pudimos iniciar el flujo SSO. Intenta de nuevo.');
    } finally {
      setPending(null);
    }
  };

  // Muestra distinta combinación según el público
  const set: Provider[] =
    audience === 'institution'
      ? ['google', 'microsoft']
      : audience === 'teacher'
        ? ['google', 'microsoft']
        : ['google', 'apple', 'github'];

  return (
    <div className="space-y-2.5">
      <div
        className={cn(
          'grid gap-2',
          set.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3',
        )}
      >
        {set.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handle(p)}
            disabled={pending !== null}
            className="group inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white/[0.04] px-3 text-[13px] font-semibold text-[var(--color-fg)] transition-all hover:bg-white/[0.07] hover:border-[var(--color-border-strong)] disabled:opacity-60"
          >
            {pending === p ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ProviderIcon provider={p} />
            )}
            <span className="truncate">{LABELS[p]}</span>
          </button>
        ))}
      </div>

      <div className="relative flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          o con email
        </span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
    </div>
  );
}

const LABELS: Record<Provider, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  github: 'GitHub',
  apple: 'Apple',
};

function ProviderIcon({ provider }: { provider: Provider }) {
  const c = 'h-4 w-4';
  switch (provider) {
    case 'google':
      return (
        <svg className={c} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.39a4.605 4.605 0 0 1-2 3.022v2.51h3.232c1.891-1.742 2.978-4.305 2.978-7.355z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 4.964-.895 6.622-2.418l-3.232-2.51c-.895.6-2.04.955-3.39.955-2.604 0-4.81-1.76-5.596-4.123H3.064v2.59A9.997 9.997 0 0 0 12 22z"
          />
          <path
            fill="#FBBC05"
            d="M6.404 13.904A5.99 5.99 0 0 1 6.09 12c0-.66.114-1.302.314-1.904V7.504H3.064A9.997 9.997 0 0 0 2 12c0 1.614.386 3.14 1.064 4.495l3.34-2.59z"
          />
          <path
            fill="#EA4335"
            d="M12 6.5c1.467 0 2.785.504 3.82 1.494l2.866-2.867C16.96 3.59 14.7 2.5 12 2.5A9.997 9.997 0 0 0 3.064 7.504l3.34 2.591C7.19 8.26 9.396 6.5 12 6.5z"
          />
        </svg>
      );
    case 'microsoft':
      return (
        <svg className={c} viewBox="0 0 24 24" aria-hidden>
          <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
          <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
          <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
          <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
        </svg>
      );
    case 'github':
      return (
        <svg className={c} viewBox="0 0 24 24" aria-hidden fill="currentColor">
          <path d="M12 .5C5.73.5.75 5.5.75 11.78c0 4.99 3.23 9.21 7.71 10.71.56.1.77-.24.77-.54v-1.9c-3.14.69-3.81-1.5-3.81-1.5-.51-1.31-1.25-1.66-1.25-1.66-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.17 1.72 1.17 1 1.74 2.63 1.24 3.27.95.1-.74.39-1.24.71-1.53-2.5-.29-5.13-1.27-5.13-5.65 0-1.25.44-2.27 1.17-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.7 10.7 0 0 1 5.74 0c2.18-1.48 3.14-1.17 3.14-1.17.62 1.58.23 2.75.11 3.04.73.8 1.16 1.82 1.16 3.07 0 4.39-2.64 5.36-5.15 5.64.4.35.76 1.04.76 2.1v3.11c0 .31.21.65.78.54 4.48-1.5 7.7-5.72 7.7-10.71C23.25 5.5 18.27.5 12 .5z" />
        </svg>
      );
    case 'apple':
      return (
        <svg className={c} viewBox="0 0 24 24" aria-hidden fill="currentColor">
          <path d="M16.36 12.71c-.02-2.13 1.74-3.15 1.82-3.2-.99-1.45-2.54-1.65-3.09-1.67-1.31-.13-2.56.77-3.23.77-.66 0-1.7-.75-2.79-.73-1.43.02-2.76.83-3.5 2.11-1.49 2.59-.38 6.42 1.07 8.52.71 1.04 1.55 2.2 2.65 2.16 1.06-.04 1.46-.69 2.74-.69 1.27 0 1.64.69 2.76.67 1.14-.02 1.86-1.05 2.55-2.1.81-1.21 1.14-2.39 1.16-2.45-.03-.01-2.22-.85-2.24-3.39zM14.27 6.41c.58-.7.97-1.68.86-2.65-.83.04-1.84.55-2.43 1.25-.53.61-1 1.61-.87 2.55.92.07 1.86-.46 2.44-1.15z" />
        </svg>
      );
  }
}
