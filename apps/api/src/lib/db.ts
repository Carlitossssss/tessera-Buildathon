import { createDb, type Database } from '@tessera/db';
import { env } from '../config/env.js';

let instance: Database | undefined;

export function getDb(): Database {
  if (!instance) {
    instance = createDb({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      debug: env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'trace',
    });
  }
  return instance;
}
