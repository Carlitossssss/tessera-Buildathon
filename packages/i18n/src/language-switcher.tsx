'use client';

import { useI18n, LOCALES, type Locale } from './provider';

/**
 * Selector de idioma.
 *
 * Dos botones y no un desplegable: con dos opciones un `select` esconde la
 * mitad de la información detrás de un clic, y además abre un panel nativo que
 * es justo la interrupción que se quiere evitar. Aquí se ve el idioma activo y
 * el disponible a la vez, y cambiar cuesta un solo clic.
 *
 * No lleva estilos propios del producto: usa las mismas variables de tema que
 * el resto de la interfaz, así que hereda el aspecto de donde se monte sin
 * arrastrar dependencias de `apps/web` a este paquete.
 */

const LABELS: Record<Locale, { short: string; full: (t: ReturnType<typeof useI18n>['t']) => string }> =
  {
    en: { short: 'EN', full: (t) => t.language.english },
    es: { short: 'ES', full: (t) => t.language.spanish },
  };

export interface LanguageSwitcherProps {
  /** `compact` muestra sólo EN/ES; `full` añade el nombre del idioma. */
  variant?: 'compact' | 'full';
  className?: string;
}

export function LanguageSwitcher({ variant = 'compact', className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.language.label}
      className={[
        'inline-flex items-center gap-0.5 rounded-lg border p-0.5',
        'border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)]',
        className ?? '',
      ]
        .join(' ')
        .trim()}
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            // `aria-pressed` y no `aria-current`: son dos estados de un mismo
            // control, no una posición dentro de una navegación.
            aria-pressed={active}
            aria-label={LABELS[code].full(t)}
            onClick={() => {
              if (!active) setLocale(code);
            }}
            className={[
              'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
              active
                ? 'bg-[var(--color-brand-500)]/15 text-[var(--color-brand-200)]'
                : 'text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]',
            ].join(' ')}
          >
            {variant === 'full' ? LABELS[code].full(t) : LABELS[code].short}
          </button>
        );
      })}
    </div>
  );
}
