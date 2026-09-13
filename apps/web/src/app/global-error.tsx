'use client';

/**
 * Error boundary raíz de Next.js: reemplaza por completo el <html> de la app,
 * incluido el layout normal donde vive I18nProvider. No se usa useT() aquí a
 * propósito: si el fallo que disparó este boundary viene del propio árbol de
 * providers, forzar el hook podría hacer que el boundary de errores fallara
 * también, dejando la pantalla completamente en blanco en vez de mostrar el
 * mensaje de error. El texto queda en español, documentado como excepción
 * deliberada y no como olvido.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <h1>Algo salió mal</h1>
        <p style={{ color: '#6b7280' }}>{error.message}</p>
        <button
          onClick={reset}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            borderRadius: 8,
            border: '1px solid #e2e6ef',
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
