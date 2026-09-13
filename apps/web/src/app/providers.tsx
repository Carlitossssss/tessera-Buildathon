'use client';

import { useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { I18nProvider } from '@tessera/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      {/* El idioma envuelve a la aplicación entera para que cambiarlo sea un
          cambio de estado y nada más: sin navegar, sin recargar y sin perder
          lo que hay en pantalla. Va por dentro de SessionProvider porque la
          preferencia guardada del usuario llega con la sesión. */}
      <I18nProvider>
        <QueryClientProvider client={client}>
          {children}
          <Toaster
            position="top-right"
            theme="dark"
            richColors
            closeButton
            toastOptions={{
              style: {
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-fg)',
              },
            }}
          />
        </QueryClientProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
