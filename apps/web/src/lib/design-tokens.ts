export const tesseraDesignTokens = {
  fonts: {
    sans: 'var(--font-sans)',
    mono: 'var(--font-mono)',
  },
  colors: {
    background: {
      base: 'var(--color-bg)',
      elevated: 'var(--color-bg-elevated)',
      card: 'var(--color-bg-card)',
      surface: 'var(--color-surface)',
    },
    foreground: {
      base: 'var(--color-fg)',
      muted: 'var(--color-fg-muted)',
      subtle: 'var(--color-fg-subtle)',
    },
    border: {
      base: 'var(--color-border)',
      strong: 'var(--color-border-strong)',
    },
    brand: {
      50: 'var(--color-brand-50)',
      100: 'var(--color-brand-100)',
      200: 'var(--color-brand-200)',
      300: 'var(--color-brand-300)',
      400: 'var(--color-brand-400)',
      500: 'var(--color-brand-500)',
      600: 'var(--color-brand-600)',
      700: 'var(--color-brand-700)',
      800: 'var(--color-brand-800)',
      900: 'var(--color-brand-900)',
    },
    cyan: {
      400: 'var(--color-cyan-400)',
      500: 'var(--color-cyan-500)',
      600: 'var(--color-cyan-600)',
    },
    accent: {
      400: 'var(--color-accent-400)',
      500: 'var(--color-accent-500)',
      600: 'var(--color-accent-600)',
    },
    state: {
      danger: 'var(--color-danger-500)',
      warning: 'var(--color-warning-500)',
      success: 'var(--color-success-500)',
    },
  },
  radii: {
    card: 'var(--radius-card)',
    pill: 'var(--radius-pill)',
  },
  shadows: {
    card: 'var(--shadow-card)',
    glow: 'var(--shadow-glow)',
  },
} as const;

export type TesseraDesignTokens = typeof tesseraDesignTokens;
