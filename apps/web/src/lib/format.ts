/**
 * Utilidades puras de formato — seguras para Client Components.
 *
 * IMPORTANTE: Este módulo NO debe importar nada de `@/server/*` ni de
 * `@/lib/env` (server-only). De lo contrario Next.js intentará bundlearlo
 * en el cliente y fallará con `Cannot read properties of undefined`.
 */

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '0';
  return new Intl.NumberFormat('es-PE').format(n);
}

export function formatMatic(value: string | number | null | undefined, decimals = 4): string {
  if (value == null) return '0';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '0';
  return n.toLocaleString('es-PE', { maximumFractionDigits: decimals });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('es-PE', { dateStyle: 'medium' });
}

export function shortAddr(addr: string | null | undefined, head = 6, tail = 4): string {
  if (!addr) return '—';
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head + 2)}…${addr.slice(-tail)}`;
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `hace ${days} día${days === 1 ? '' : 's'}`;
  const months = Math.round(days / 30);
  if (months < 12) return `hace ${months} mes${months === 1 ? '' : 'es'}`;
  return formatDate(d);
}
