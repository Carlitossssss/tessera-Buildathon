import { defineConfig } from 'drizzle-kit';
import './src/load-env';

export default defineConfig({
  schema: [
    './src/schema/auth.ts',
    './src/schema/institutions.ts',
    './src/schema/courses.ts',
    './src/schema/certificates.ts',
    './src/schema/badges.ts',
    './src/schema/payments.ts',
    './src/schema/webhooks.ts',
    './src/schema/audit.ts',
    './src/schema/privacy.ts',
    './src/schema/credits.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://tessera:tessera@localhost:5432/tessera',
  },
  strict: true,
  verbose: true,
});
