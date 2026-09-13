'use client';

import { useState, useTransition } from 'react';
import {
  AlertCircle,
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ExternalLink,
  Medal,
  Plus,
  ShieldOff,
  Trash2,
  Wallet,
  Webhook as WebhookIcon,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/format';
import { createWebhookAction, deleteWebhookAction } from '../actions';

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  disabledAt: string | null;
  createdAt: string;
}

type EventId =
  | 'certificate.issued'
  | 'certificate.failed'
  | 'certificate.revoked'
  | 'badge.issued'
  | 'credits.low_balance'
  | 'payment.received';

interface EventMeta {
  desc: string;
  icon: React.ElementType;
  color: string;
}

const EVENT_META: Record<EventId, EventMeta> = {
  'certificate.issued': {
    desc: 'El certificado quedo confirmado en la blockchain. Ya es verificable.',
    icon: Award,
    color: 'text-emerald-400',
  },
  'certificate.failed': {
    desc: 'Falló el mint del certificado',
    icon: AlertCircle,
    color: 'text-red-400',
  },
  'certificate.revoked': {
    desc: 'Certificado revocado por la institución',
    icon: ShieldOff,
    color: 'text-amber-400',
  },
  'badge.issued': {
    desc: 'Se emitio una insignia a un estudiante.',
    icon: Medal,
    color: 'text-[var(--color-brand-300)]',
  },
  'credits.low_balance': {
    desc: 'Quedan pocos creditos de emision. Conviene recargar.',
    icon: Wallet,
    color: 'text-amber-400',
  },
  'payment.received': {
    desc: 'Se acredito un pago y tus creditos se actualizaron.',
    icon: CreditCard,
    color: 'text-emerald-400',
  },
};

const ALL_EVENT_IDS = Object.keys(EVENT_META) as EventId[];

/** Trunca URLs largas para mostrar en tabla */
function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 24 ? u.pathname.slice(0, 22) + '…' : u.pathname;
    return `${u.hostname}${path}`;
  } catch {
    return url.length > 40 ? url.slice(0, 38) + '…' : url;
  }
}

export function WebhooksClient({ initial }: { initial: WebhookRow[] }) {
  const [open, setOpen] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<EventId[]>([]);
  const [created, setCreated] = useState<{ url: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [expandedPayload, setExpandedPayload] = useState<string | null>(null);

  function toggleEvent(id: EventId) {
    setSelectedEvents((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  function handleCreate(form: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createWebhookAction(form);
      if (res.ok && res.data) {
        setCreated({ url: res.data.url, secret: res.data.secret });
        setOpen(false);
        setSelectedEvents([]);
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  }

  function handleDelete(id: string, url: string) {
    if (!confirm(`¿Eliminar el webhook "${shortUrl(url)}"? Dejará de recibir eventos.`)) return;
    startTransition(async () => {
      const res = await deleteWebhookAction(id);
      if (!res.ok) alert(res.error);
    });
  }

  const allSelected = selectedEvents.length === ALL_EVENT_IDS.length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-fg-muted)]">
          {initial.length} {initial.length === 1 ? 'endpoint registrado' : 'endpoints registrados'}
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
          {open ? 'Cancelar' : 'Nuevo webhook'}
        </Button>
      </div>

      {/* Formulario de creacion */}
      {open && (
        <form
          action={handleCreate}
          className="rounded-2xl border border-[var(--color-brand-500)]/25 bg-[var(--color-brand-500)]/[0.04] p-6 space-y-6"
        >
          {selectedEvents.map((e) => (
            <input key={e} type="hidden" name="events" value={e} />
          ))}

          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-fg)]">Configurar webhook</h3>
            <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
              El secret de firma se muestra una sola vez al crear el endpoint.
            </p>
          </div>

          {/* URL */}
          <div className="grid gap-2">
            <Label htmlFor="wh-url">Endpoint URL</Label>
            <Input
              id="wh-url"
              name="url"
              type="url"
              placeholder="https://api.tu-lms.com/tessera/webhook"
              required
            />
            <p className="text-[11px] text-[var(--color-fg-subtle)]">
              Debe ser HTTPS y responder con 2xx en menos de 10 s.
            </p>
          </div>

          {/* Eventos */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>Eventos a recibir</Label>
              <button
                type="button"
                onClick={() => setSelectedEvents(allSelected ? [] : [...ALL_EVENT_IDS])}
                className="text-[11px] text-[var(--color-brand-300)] transition-colors hover:text-[var(--color-brand-200)]"
              >
                {allSelected ? 'Desmarcar todo' : 'Marcar todo'}
              </button>
            </div>
            <div className="grid gap-2">
              {ALL_EVENT_IDS.map((id) => {
                const meta = EVENT_META[id];
                const active = selectedEvents.includes(id);
                const Icon = meta.icon;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleEvent(id)}
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
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.color)} />
                    <div>
                      <p className="font-mono text-[11px] leading-none text-[var(--color-brand-300)]">
                        {id}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">{meta.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--color-danger-500)]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" loading={pending}>
              Registrar webhook
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setSelectedEvents([]);
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* Secret reveal */}
      {created && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <Zap className="h-4 w-4 text-emerald-300" />
            </div>
            <div className="flex-1 min-w-0">
              <Badge variant="success" className="mb-1">
                Configurado
              </Badge>
              <p className="text-[15px] font-semibold text-[var(--color-fg)] truncate">
                {created.url}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
                Secret de firma HMAC-SHA256 — solo se muestra una vez
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="shrink-0 rounded-md p-1 text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-black/30 px-4 py-3">
            <code className="flex-1 break-all font-mono text-[12px] leading-relaxed text-[var(--color-fg)]">
              {created.secret}
            </code>
          </div>

          <div className="flex items-center gap-3">
            <CopyButton value={created.secret} label="Copiar secret" variant="outline" />
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              He guardado el secret
            </button>
          </div>
        </div>
      )}

      {/* Lista de webhooks */}
      {initial.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white/[0.015] px-6 py-16 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white/[0.03] text-[var(--color-brand-300)]">
            <WebhookIcon className="h-5 w-5" />
          </div>
          <h3 className="mt-5 text-[15px] font-semibold text-[var(--color-fg)]">
            Sin webhooks configurados
          </h3>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            Recibe eventos en tiempo real cuando se emiten o revocan certificados.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-white/[0.025]">
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  Endpoint
                </th>
                <th className="hidden px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)] md:table-cell">
                  Eventos
                </th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  Estado
                </th>
                <th className="hidden px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)] lg:table-cell">
                  Creado
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {initial.map((w) => {
                const isActive = !w.disabledAt;
                const payloadOpen = expandedPayload === w.id;
                return (
                  <tr key={w.id} className="group transition-colors hover:bg-white/[0.015]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            isActive
                              ? 'bg-emerald-400 shadow-[0_0_6px_0_rgba(52,211,153,0.6)]'
                              : 'bg-[var(--color-fg-subtle)]',
                          )}
                        />
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[12px] text-[var(--color-fg)]"
                            title={w.url}
                          >
                            {shortUrl(w.url)}
                          </span>
                          <a
                            href={w.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                            title="Abrir URL"
                          >
                            <ExternalLink className="h-3 w-3 text-[var(--color-fg-subtle)]" />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-5 py-4 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {w.events.map((e) => {
                          const meta = EVENT_META[e as EventId];
                          const Icon = meta?.icon;
                          return (
                            <span
                              key={e}
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-subtle)]"
                            >
                              {Icon && <Icon className={cn('h-2.5 w-2.5', meta?.color)} />}
                              {e}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={isActive ? 'success' : 'default'}>
                        {isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="hidden px-5 py-4 text-xs text-[var(--color-fg-subtle)] lg:table-cell">
                      {relativeTime(w.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setExpandedPayload(payloadOpen ? null : w.id)}
                          title="Ver payload de ejemplo"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-fg-subtle)] opacity-0 transition-all hover:bg-white/[0.06] hover:text-[var(--color-fg)] group-hover:opacity-100"
                        >
                          {payloadOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(w.id, w.url)}
                          disabled={pending}
                          title="Eliminar webhook"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-fg-subtle)] opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Payload expandido inline */}
      {expandedPayload &&
        (() => {
          const wh = initial.find((w) => w.id === expandedPayload);
          if (!wh) return null;
          const sampleEvent = wh.events[0] as EventId | undefined;
          return (
            <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[var(--color-fg)]">
                  Payload de ejemplo
                  {sampleEvent && (
                    <code className="ml-2 rounded-md border border-[var(--color-border)] bg-black/20 px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-brand-300)]">
                      {sampleEvent}
                    </code>
                  )}
                </p>
                <CopyButton
                  value={JSON.stringify(
                    buildSamplePayload(sampleEvent ?? 'certificate.issued'),
                    null,
                    2,
                  )}
                  label="Copiar"
                  size="sm"
                  variant="secondary"
                />
              </div>
              <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-[var(--color-fg-muted)] scrollbar-thin">
                {JSON.stringify(buildSamplePayload(sampleEvent ?? 'certificate.issued'), null, 2)}
              </pre>
            </div>
          );
        })()}
    </div>
  );
}

function buildSamplePayload(eventType: string): object {
  const base = {
    id: 'evt_01j9zxkq2p3r4s5t6u7v8w9x0y',
    type: eventType,
    institutionId: 'inst_01j8abc...',
    timestamp: new Date().toISOString(),
  };

  if (eventType === 'certificate.issued') {
    return {
      ...base,
      data: {
        certificateId: 'cert_01j9abc...',
        studentEmail: 'alumno@example.com',
        achievementName: 'Solidity Avanzado',
        tokenId: '42',
        txHash: '0xabc123...',
        issuedAt: new Date().toISOString(),
      },
    };
  }
  if (eventType === 'certificate.failed') {
    return {
      ...base,
      data: {
        certificateId: 'cert_01j9abc...',
        studentEmail: 'alumno@example.com',
        reason: 'INSUFFICIENT_CREDITS',
      },
    };
  }
  if (eventType === 'certificate.revoked') {
    return {
      ...base,
      data: { certificateId: 'cert_01j9abc...', revokedAt: new Date().toISOString() },
    };
  }
  if (eventType === 'badge.issued') {
    return {
      ...base,
      data: { badgeId: 'badge_01j9abc...', studentEmail: 'alumno@example.com', tokenId: '7' },
    };
  }
  if (eventType === 'credits.low_balance') {
    return {
      ...base,
      data: { walletAddress: '0xabc...', maticBalance: '0.0042', threshold: '0.01' },
    };
  }
  if (eventType === 'payment.received') {
    return {
      ...base,
      data: { packageCode: 'growth', tsc: 500, amountUsd: '425.00', paymentOrderId: 'order_...' },
    };
  }
  return { ...base, data: {} };
}
