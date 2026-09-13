'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en, type Dictionary } from './locales/en';
import { es } from './locales/es';

/**
 * Idioma de la interfaz, sin recargar la página.
 *
 * El cambio es un cambio de estado de React y nada más: no navega, no recarga
 * y no pide nada al servidor para repintar. Quien cambia de idioma se queda en
 * la misma pantalla, con el mismo scroll y los mismos datos a la vista.
 *
 * Esa decisión descarta las librerías de i18n que enrutan por prefijo
 * (`/en/...`, `/es/...`): ahí cambiar de idioma es navegar, y además habría
 * que reescribir el middleware que protege las rutas del panel. El coste de
 * tocar eso es justo lo que no se quiere arriesgar.
 *
 * La preferencia se guarda en tres sitios, y cada uno resuelve un problema
 * distinto:
 *
 *   estado de React   repinta al instante
 *   localStorage      sobrevive a un refresco, sin esperar al servidor
 *   perfil del usuario viaja entre dispositivos
 */

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

/** Inglés es el idioma por defecto del producto. */
export const DEFAULT_LOCALE: Locale = 'en';

const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

/** Clave de localStorage. Lleva prefijo para no chocar con nada más. */
const STORAGE_KEY = 'tessera.locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Normaliza lo que declara el navegador.
 *
 * `navigator.language` puede venir como 'es-419' o 'en-GB'; sólo interesa la
 * parte antes del guión. Cualquier idioma que no soportemos cae al por
 * defecto, que es inglés.
 */
export function resolveBrowserLocale(raw: string | null | undefined): Locale {
  if (!raw) return DEFAULT_LOCALE;
  const base = raw.trim().toLowerCase().split('-')[0];
  return isLocale(base) ? base : DEFAULT_LOCALE;
}

interface I18nValue {
  locale: Locale;
  /** El diccionario del idioma activo. */
  t: Dictionary;
  setLocale: (next: Locale) => void;
  /** Falso hasta que se lee la preferencia guardada, para evitar parpadeos. */
  ready: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

export interface I18nProviderProps {
  children: React.ReactNode;
  /**
   * Idioma que ya conoce el servidor (el del perfil del usuario). Cuando
   * llega, manda sobre lo guardado en el navegador: es la preferencia que el
   * usuario dejó dicha explícitamente y que le sigue entre dispositivos.
   */
  initialLocale?: Locale | null;
  /**
   * Guarda la preferencia donde deba persistir entre sesiones. Se llama en
   * segundo plano y su fallo nunca afecta al cambio visible: la interfaz ya
   * cambió, y reintentarlo no es asunto del usuario.
   */
  onPersist?: (locale: Locale) => void | Promise<unknown>;
}

export function I18nProvider({ children, initialLocale, onPersist }: I18nProviderProps) {
  // Se arranca con el idioma del servidor si lo hay, y si no con el por
  // defecto. Nunca se lee localStorage en el primer render: el servidor no
  // tiene acceso a él y pintar algo distinto rompería la hidratación.
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Ya en el navegador: se recupera la preferencia real. El orden importa
    // —perfil, luego navegador guardado, luego idioma del sistema— porque una
    // elección explícita pesa más que una deducida.
    if (initialLocale) {
      setLocaleState(initialLocale);
      setReady(true);
      return;
    }

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Modo privado o almacenamiento bloqueado: no es un error, sólo no hay
      // preferencia guardada.
      stored = null;
    }

    if (isLocale(stored)) {
      setLocaleState(stored);
    } else {
      setLocaleState(resolveBrowserLocale(window.navigator.language));
    }
    setReady(true);
  }, [initialLocale]);

  // El atributo lang del documento se mantiene al día: lo usan los lectores
  // de pantalla para elegir la voz y el navegador para ofrecer traducción.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);

      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Sin almacenamiento la elección vale para esta sesión. Es peor
        // fallar ruidosamente por una preferencia que no se pudo recordar.
      }

      // En segundo plano y sin await: la interfaz ya cambió y no debe esperar
      // a la red para verse.
      void Promise.resolve(onPersist?.(next)).catch(() => {
        // Persistir es un extra. Si falla, la preferencia sigue viva en este
        // navegador y se reintentará al próximo cambio.
      });
    },
    [onPersist],
  );

  const value = useMemo<I18nValue>(
    () => ({ locale, t: DICTIONARIES[locale], setLocale, ready }),
    [locale, setLocale, ready],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Acceso al diccionario del idioma activo.
 *
 * Fuera del provider devuelve el inglés en vez de lanzar: un componente que se
 * renderice por error sin contexto debe mostrar texto, no romper la pantalla.
 */
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_LOCALE,
    t: DICTIONARIES[DEFAULT_LOCALE],
    setLocale: () => undefined,
    ready: true,
  };
}

/** Atajo para leer sólo los textos: `const t = useT()`. */
export function useT(): Dictionary {
  return useI18n().t;
}
