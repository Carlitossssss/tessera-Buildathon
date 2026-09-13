'use client';

import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { LanguageSwitcher, useT } from '@tessera/i18n';

/**
 * Cabecera y pie del marco de autenticación.
 *
 * Existen como componente aparte para que el layout siga siendo de servidor:
 * sólo estas dos piezas necesitan el idioma activo, y aislarlas evita convertir
 * en cliente toda la pantalla —con sus fondos, su aurora y su panel lateral—
 * por dos frases y un selector.
 *
 * El selector va aquí, y no en un ajuste posterior, porque ésta es la primera
 * pantalla que ve alguien que llega: elegir idioma no puede exigir tener
 * cuenta. En el resto del sitio vive en la cabecera pública y en el pie, pero
 * el marco de autenticación no monta ninguno de los dos.
 */
export function AuthLayoutChrome() {
  const t = useT();

  return (
    <div className="flex items-center gap-2">
      <LanguageSwitcher />
      <Link
        href="/"
        className="hidden items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] backdrop-blur transition hover:text-[var(--color-fg)] sm:inline-flex"
      >
        <LockKeyhole className="h-3 w-3" />
        {t.auth.layout.secureAccess}
      </Link>
    </div>
  );
}

/**
 * Pie del marco de autenticación.
 *
 * El año llega por props y no se calcula aquí: en el servidor y en el cliente
 * podría diferir en el cambio de año, y esa diferencia rompe la hidratación.
 */
export function AuthLayoutFooter({ year }: { year: number }) {
  const t = useT();

  return (
    <p className="shrink-0 pb-5 text-center text-[10.5px] text-[var(--color-fg-subtle)] sm:text-[11px] lg:text-left">
      (c) {year} Tessera Labs - {t.auth.layout.footer}
    </p>
  );
}
