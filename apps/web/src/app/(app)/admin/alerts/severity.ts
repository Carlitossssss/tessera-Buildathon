import { AlertTriangle, Info, XCircle } from 'lucide-react';

/** Shared between the server page (typing) and the client view (icons/colors). */
export const SEVERITY = {
  error: {
    icon: XCircle,
    color: 'text-[var(--color-danger-500)]',
    border: 'border-[var(--color-danger-500)]/30',
    bg: 'bg-[var(--color-danger-500)]/5',
    variant: 'danger' as const,
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    variant: 'warning' as const,
  },
  info: {
    icon: Info,
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
    variant: 'default' as const,
  },
};
