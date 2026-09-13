import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://tessera.io'),
  title: {
    default: 'Tessera · Certificados educativos verificables on-chain',
    template: '%s · Tessera',
  },
  description:
    'Emite credenciales como Soulbound Tokens en Polygon, con metadata permanente en Arweave y badges sociales para LinkedIn. API pública incluida.',
  keywords: ['certificados', 'soulbound', 'polygon', 'arweave', 'verificable', 'educación'],
  openGraph: {
    type: 'website',
    title: 'Tessera · Certificados educativos verificables on-chain',
    description: 'Soulbound Tokens en Polygon · Metadata permanente en Arweave · API pública',
    siteName: 'Tessera',
  },
  icons: {
    icon: [
      { url: '/tessera-favicon.png', sizes: '1024x1024', type: 'image/png' },
      { url: '/favicon.ico', sizes: '256x256', type: 'image/x-icon' },
    ],
    shortcut: '/tessera-favicon.png',
    apple: '/tessera-favicon.png',
  },
  twitter: { card: 'summary_large_image', creator: '@tessera_io' },
};

export const viewport: Viewport = { themeColor: '#080d1a', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--color-bg)] font-sans text-[var(--color-fg)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
