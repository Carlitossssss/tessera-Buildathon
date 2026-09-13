import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDb>;

export interface DbConfig {
  connectionString: string;
  max?: number;
  idleTimeoutSeconds?: number;
  debug?: boolean;
}

export function createDb(config: DbConfig) {
  const client = postgres(config.connectionString, {
    max: config.max ?? 20,
    idle_timeout: config.idleTimeoutSeconds ?? 30,
    connect_timeout: 10,
    prepare: true,
    debug: config.debug
      ? (_, query) => {
          console.debug('[sql]', query);
        }
      : false,
  });

  const db = drizzle(client, { schema, logger: config.debug });

  return Object.assign(db, {
    $client: client,
    $close: async () => {
      await client.end({ timeout: 5 });
    },
  });
}

export { schema };
