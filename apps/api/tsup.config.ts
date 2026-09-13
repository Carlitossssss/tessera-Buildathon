import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/workers.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  dts: false,
  splitting: false,
  minify: false,
  bundle: true,
  // External: deps DIRECTAS del API, pnpm las pone en apps/api/node_modules/
  // y el COPY del Dockerfile las incluye correctamente.
  external: ['argon2', 'ioredis', 'bullmq', 'viem', 'pino', 'pino-pretty'],
  // NoExternal: deps TRANSITIVAS de los workspace packages, que pnpm 10+
  // NO hoistea al root node_modules (están en packages/db/node_modules/,
  // packages/shared/node_modules/, etc., que el Dockerfile NO copia).
  // Si las dejamos external, Node tira ERR_MODULE_NOT_FOUND en runtime
  // al hacer `import 'postgres'`. Bundleándolas en tsup, el código va
  // inline en dist/server.js y dist/workers.js, y Node no tiene que
  // resolverlas en runtime. Esto es la fix quirúrgica que necesitamos.
  noExternal: [
    'postgres', // dep transitiva de @tessera/db
    'drizzle-orm', // dep transitiva de @tessera/db (por si acaso)
    'pg', // dep transitiva de drizzle-orm (por si acaso)
    'postgres-interval', // idem
    /^@tessera\//, // workspace packages (también tienen source .ts)
  ],
});
