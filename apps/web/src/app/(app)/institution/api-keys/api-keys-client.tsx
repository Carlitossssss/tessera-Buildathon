'use client';

import { useState, useTransition } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/format';
import { createApiKeyAction, revokeApiKeyAction } from '../actions';

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

type ScopeId =
  | 'certificates:read'
  | 'certificates:write'
  | 'badges:read'
  | 'badges:write'
  | 'courses:read'
  | 'courses:write'
  | 'wallet:read';

interface ScopeMeta {
  desc: string;
  icon: React.ElementType;
  /** Endpoints que este permiso habilita, para que se entienda que desbloquea. */
  endpoints: string;
  /** Un permiso de escritura consume creditos o altera datos: se marca. */
  sensitive?: boolean;
}

const SCOPE_META: Record<ScopeId, ScopeMeta> = {
  'certificates:read': {
    desc: 'Consultar los certificados que ya emitiste y su estado.',
    endpoints: 'GET /v1/certificates',
    icon: Award,
  },
  'certificates:write': {
    desc: 'Emitir certificados nuevos y revocarlos. Cada emisión consume un crédito.',
    endpoints: 'POST /v1/certificates · DELETE /v1/certificates/:id',
    icon: Award,
    sensitive: true,
  },
  'badges:read': {
    desc: 'Consultar las insignias emitidas.',
    endpoints: 'GET /v1/badges',
    icon: ShieldCheck,
  },
  'badges:write': {
    desc: 'Emitir insignias a estudiantes.',
    endpoints: 'POST /v1/badges',
    icon: ShieldCheck,
    sensitive: true,
  },
  'courses:read': {
    desc: 'Leer tus cursos y las matrículas de cada uno.',
    endpoints: 'GET /v1/courses',
    icon: BookOpen,
  },
  'courses:write': {
    desc: 'Crear y modificar cursos desde tu sistema.',
    endpoints: 'POST /v1/courses · PATCH /v1/courses/:id',
    icon: GraduationCap,
    sensitive: true,
  },
  'wallet:read': {
    desc: 'Consultar la identidad emisora on-chain de tu institución.',
    endpoints: 'GET /v1/me/wallet',
    icon: Wallet,
  },
};

const ALL_SCOPE_IDS = Object.keys(SCOPE_META) as ScopeId[];

function ExpiryIndicator({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt)
    return <span className="text-xs text-[var(--color-fg-subtle)]">Sin expiración</span>;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return <Badge variant="danger">Expirada</Badge>;
  if (days <= 7)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-300">
        <AlertTriangle className="h-3 w-3" />
        {days}d restantes
      </span>
    );
  return (
    <span className="text-xs text-[var(--color-fg-subtle)]">
      {new Date(expiresAt).toLocaleDateString('es-PE', { dateStyle: 'medium' })}
    </span>
  );
}

export function ApiKeysClient({ initial }: { initial: ApiKeyRow[] }) {
  const [open, setOpen] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<ScopeId[]>([]);
  const [createdKey, setCreatedKey] = useState<{
    name: string;
    prefix: string;
    key: string;
  } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleScope(id: ScopeId) {
    setSelectedScopes((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function handleCreate(form: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createApiKeyAction(form);
      if (res.ok && res.data) {
        setCreatedKey({ name: res.data.name, prefix: res.data.prefix, key: res.data.key });
        setOpen(false);
        setSelectedScopes([]);
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  }

  function handleRevoke(id: string, name: string) {
    if (!confirm(`¿Revocar "${name}"? Las requests posteriores con esa clave fallarán.`)) return;
    startTransition(async () => {
      const res = await revokeApiKeyAction(id);
      if (!res.ok) alert(res.error);
    });
  }

  const allSelected = selectedScopes.length === ALL_SCOPE_IDS.length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-fg-muted)]">
          {initial.length} {initial.length === 1 ? 'clave activa' : 'claves activas'}
        </p>
        <Button
          size="md"
          onClick={() => {
            setOpen((v) => !v);
            setError(null);
          }}
          className="inline-flex items-center gap-1.5"
        >
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {open ? 'Cancelar' : 'Nueva API key'}
        </Button>
      </div>

      {/* Formulario de creacion */}
      {open && (
        <form
          action={handleCreate}
          className="overflow-hidden rounded-2xl border border-[var(--color-brand-500)]/25 bg-[var(--color-brand-500)]/[0.04] p-6 space-y-6"
        >
          {selectedScopes.map((s) => (
            <input key={s} type="hidden" name="scopes" value={s} />
          ))}

          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-fg)]">Nueva API Key</h3>
            <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
              La clave completa se muestra una sola vez al crearla.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="key-name">Nombre descriptivo</Label>
            <Input
              id="key-name"
              name="name"
              placeholder="Producción · LMS Moodle"
              required
              maxLength={100}
            />
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>Permisos (scopes)</Label>
              <button
                type="button"
                onClick={() => setSelectedScopes(allSelected ? [] : [...ALL_SCOPE_IDS])}
                className="text-[11px] text-[var(--color-brand-300)] transition-colors hover:text-[var(--color-brand-200)]"
              >
                {allSelected ? 'Desmarcar todo' : 'Marcar todo'}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ALL_SCOPE_IDS.map((id) => {
                const meta = SCOPE_META[id];
                const active = selectedScopes.includes(id);
                const Icon = meta.icon;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleScope(id)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                      active
                        ? 'border-[var(--color-brand-500)]/60 bg-[var(--color-brand-500)]/10'
                        : 'border-[var(--color-border)] bg-white/[0.02] hover:border-[var(--color-border-strong)] hover:bg-white/[0.04]',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all',
                        active
                          ? 'border-[var(--color-brand-400)] bg-[var(--color-brand-500)]'
                          : 'border-[var(--color-border-strong)] bg-transparent',
                      )}
                    >
                      {active && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3 w-3 shrink-0 text-[var(--color-brand-300)]" />
                        <p className="truncate font-mono text-[11px] leading-none text-[var(--color-brand-300)]">
                          {id}
                        </p>
                        {meta.sensitive ? (
                          <span className="shrink-0 rounded border border-[var(--color-warning-500)]/35 px-1 py-px text-[9px] uppercase tracking-wider text-[var(--color-warning-500)]">
                            escritura
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
                        {meta.desc}
                      </p>
                      <p className="mt-1 truncate font-mono text-[10px] text-[var(--color-fg-subtle)]/70">
                        {meta.endpoints}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="key-expires">Expiración (días, opcional)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="key-expires"
                name="expiresInDays"
                type="number"
                min={1}
                max={730}
                placeholder="Sin expiración"
                className="max-w-[180px]"
              />
              <p className="text-[11px] text-[var(--color-fg-subtle)]">Máximo 730 días (2 años)</p>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--color-danger-500)]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" loading={pending}>
              Crear API key
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setSelectedScopes([]);
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* Vault reveal: clave creada */}
      {createdKey && (
        <div className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.05] p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
              <KeyRound className="h-4 w-4 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                Guarda esta clave ahora — no podrás recuperarla
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-[var(--color-fg)]">
                {createdKey.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreatedKey(null)}
              className="shrink-0 rounded-md p-1 text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-black/30 px-4 py-3">
            <KeyRound className="h-3.5 w-3.5 shrink-0 text-amber-400/70" />
            <code className="flex-1 break-all font-mono text-[12px] leading-relaxed text-[var(--color-fg)]">
              {showSecret ? createdKey.key : `${createdKey.prefix}${'•'.repeat(36)}`}
            </code>
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="shrink-0 rounded-md p-1.5 text-[var(--color-fg-subtle)] transition-all hover:bg-white/[0.06] hover:text-[var(--color-fg)]"
              aria-label={showSecret ? 'Ocultar' : 'Mostrar'}
            >
              {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <CopyButton value={createdKey.key} label="Copiar clave" variant="outline" />
            <button
              type="button"
              onClick={() => setCreatedKey(null)}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              He guardado la clave
            </button>
          </div>
        </div>
      )}

      {/* Lista de claves */}
      {initial.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white/[0.015] px-6 py-16 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
            <KeyRound className="h-5 w-5" />
          </div>
          <h3 className="mt-5 text-[15px] font-semibold text-[var(--color-fg)]">
            Sin API Keys aún
          </h3>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            Crea tu primera clave para integrar tu LMS o sistema externo.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-white/[0.025]">
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  Nombre
                </th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  Prefix
                </th>
                <th className="hidden px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)] md:table-cell">
                  Permisos
                </th>
                <th className="hidden px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)] lg:table-cell">
                  Último uso
                </th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  Expira
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {initial.map((k) => (
                <tr key={k.id} className="group transition-colors hover:bg-white/[0.015]">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_0_rgba(52,211,153,0.6)]" />
                      <span className="text-[13px] font-medium text-[var(--color-fg)]">
                        {k.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <code className="rounded-md border border-[var(--color-border)] bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-[var(--color-brand-300)]">
                      {k.prefix}…
                    </code>
                  </td>
                  <td className="hidden px-5 py-4 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <span
                          key={s}
                          className="rounded-md border border-[var(--color-border)] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-subtle)]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-5 py-4 text-xs text-[var(--color-fg-subtle)] lg:table-cell">
                    {k.lastUsedAt ? relativeTime(k.lastUsedAt) : 'Nunca'}
                  </td>
                  <td className="px-5 py-4">
                    <ExpiryIndicator expiresAt={k.expiresAt} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleRevoke(k.id, k.name)}
                      disabled={pending}
                      title="Revocar clave"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-fg-subtle)] opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
