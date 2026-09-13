import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // output: 'standalone' desactivado: en Windows + pnpm symlinks falla
  // (bug conocido). En Dokploy (Linux) no sería problema, pero dejamos
  // el build estándar (pnpm start) que también funciona.
  transpilePackages: ['@tessera/shared', '@tessera/contracts', '@tessera/i18n'],
  experimental: {
    typedRoutes: true,
    serverActions: {
      /**
       * Tope del cuerpo de una Server Action.
       *
       * El material de un temario —un vídeo o un audio de clase— se sube por
       * una Server Action, y el valor por defecto es 1 MB: sin esto, ningún
       * archivo real llegaba siquiera a salir de Next, mucho menos a la API.
       *
       * Queda por encima del máximo que acepta la acción (64 MB) para dejar
       * sitio al engorde de base64 y al resto del formulario. Quien manda es
       * la validación de la acción, que devuelve un error legible; este número
       * sólo evita que el framework corte antes con un fallo opaco.
       */
      bodySizeLimit: '96mb',
    },
  },
  /**
   * Turbopack en `next dev` (config vacia = comportamiento por defecto).
   *
   * Solo afecta al servidor de desarrollo: `next build` y `next start` siguen
   * usando webpack exactamente igual que antes, por eso el bloque `webpack:`
   * de abajo se mantiene.
   */
  turbopack: {},
  // Silencia warnings ruidosos del PackFileCacheStrategy y mejora el cache.
  // Solo aplica a `next build` (webpack); en dev manda Turbopack.
  webpack: (cfg) => {
    cfg.infrastructureLogging = { ...(cfg.infrastructureLogging ?? {}), level: 'error' };
    cfg.ignoreWarnings = [
      ...(cfg.ignoreWarnings ?? []),
      /Serializing big strings/,
      /webpack\.cache\.PackFileCacheStrategy/,
    ];
    return cfg;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'tomato-secondary-toad-829.mypinata.cloud' },
      { protocol: 'https', hostname: '**.mypinata.cloud' },
      { protocol: 'https', hostname: 'gateway.pinata.cloud' },
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: 'dweb.link' },
      { protocol: 'https', hostname: 'w3s.link' },
      { protocol: 'https', hostname: 'arweave.net' },
      { protocol: 'https', hostname: 'assets.tessera.io' },
    ],
  },
  async rewrites() {
    // Keep API traffic behind the same TLS-protected public hostname while
    // forwarding it only over Docker's internal network to the API service.
    return [{ source: '/backend/:path*', destination: 'http://api:3001/:path*' }];
  },
  async headers() {
    return [
      {
        source: '/embed/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
      {
        source: '/((?!embed).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default config;
