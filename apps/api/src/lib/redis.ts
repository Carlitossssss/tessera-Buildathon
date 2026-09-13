import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../config/env.js';

export function createRedis(overrides: RedisOptions = {}): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    ...overrides,
  });
}

export type { Redis };
