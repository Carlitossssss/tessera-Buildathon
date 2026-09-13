/**
 * Capa de idioma de Tessera.
 *
 * Vive en un paquete y no dentro de `apps/web` por una razón concreta: los
 * mensajes de error del API también los lee una persona, así que los
 * diccionarios tendrán que compartirse. Tenerlos aquí desde el principio
 * evita moverlos --y reescribir cada import-- cuando llegue ese momento.
 */

export {
  I18nProvider,
  useI18n,
  useT,
  isLocale,
  resolveBrowserLocale,
  LOCALES,
  DEFAULT_LOCALE,
  type Locale,
  type I18nProviderProps,
} from './provider';

export { LanguageSwitcher, type LanguageSwitcherProps } from './language-switcher';

export { en, type Dictionary } from './locales/en';
export { es } from './locales/es';
