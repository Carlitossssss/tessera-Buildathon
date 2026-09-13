import fp from 'fastify-plugin';
import argon2 from 'argon2';
import { createHash, timingSafeEqual } from 'node:crypto';
import { eq, and, isNull } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../lib/db.js';
import { errors } from '@tessera/shared/errors';
import type { ApiKeyContext } from '@tessera/shared/types';
import type { Plan } from '@tessera/shared/constants';
import { API_KEY_PREFIX } from '@tessera/shared/constants';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKeyContext;
  }
  interface FastifyInstance {
    requireApiKey: (
      requiredScopes?: string[],
    ) => (req: import('fastify').FastifyRequest) => Promise<void>;
  }
}

function extractKey(header: string | undefined): string | undefined {
  if (!header) return undefined;
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return header.trim();
}

/**
 * Verificar una API key cuesta ~100 ms porque argon2id esta calibrado para
 * resistir fuerza bruta offline sobre contrasenas. Ese coste tiene sentido una
 * vez por clave, no en cada request de un LMS que sincroniza miles de
 * certificados.
 *
 * Cacheamos el resultado en memoria durante TTL_MS indexado por el SHA-256 de
 * la clave presentada: nunca guardamos la clave en claro. Sigue siendo el hash
 * argon2id en base de datos el que autoriza la primera vez; la cache solo evita
 * repetir esa comprobacion mientras la entrada sigue viva.
 *
 * La cache es por proceso y de vida corta a proposito: una revocacion tarda
 * como maximo TTL_MS en propagarse a todas las replicas, y no requiere Redis ni
 * invalidacion distribuida.
 */
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 5_000;
/** Espaciado minimo entre escrituras de lastUsedAt para la misma clave. */
const LAST_USED_THROTTLE_MS = 60_000;

interface CachedKey {
  expiresAtMs: number;
  digest: Buffer;
  row: {
    id: string;
    institutionId: string;
    scopes: string[];
    expiresAt: Date | null;
  };
}

const verifiedKeys = new Map<string, CachedKey>();
const lastUsedWrites = new Map<string, number>();

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function cacheKeyFor(digest: Buffer): string {
  return digest.toString('base64');
}

function pruneCache(): void {
  if (verifiedKeys.size <= CACHE_MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of verifiedKeys) {
    if (entry.expiresAtMs <= now) verifiedKeys.delete(key);
  }
  // Si siguen sobrando, descartamos las mas antiguas (Map preserva insercion).
  while (verifiedKeys.size > CACHE_MAX_ENTRIES) {
    const oldest = verifiedKeys.keys().next();
    if (oldest.done) break;
    verifiedKeys.delete(oldest.value);
  }
}

/** Invalida la cache de una clave concreta; la llama la revocacion. */
export function forgetCachedApiKey(apiKeyId: string): void {
  for (const [key, entry] of verifiedKeys) {
    if (entry.row.id === apiKeyId) verifiedKeys.delete(key);
  }
  lastUsedWrites.delete(apiKeyId);
}

export default fp(
  async (app) => {
    app.decorate('requireApiKey', (requiredScopes: string[] = []) => {
      return async (req) => {
        const raw =
          (req.headers['x-api-key'] as string | undefined) ??
          extractKey(req.headers.authorization as string | undefined);

        if (!raw || !raw.startsWith(API_KEY_PREFIX)) {
          throw errors.invalidApiKey();
        }

        const db = getDb();
        const presentedDigest = sha256(raw);
        const cacheKey = cacheKeyFor(presentedDigest);
        const now = Date.now();

        let resolved: CachedKey['row'] | undefined;

        const cached = verifiedKeys.get(cacheKey);
        if (
          cached &&
          cached.expiresAtMs > now &&
          // Comparacion en tiempo constante aunque la clave del Map ya coincida:
          // mantiene la propiedad incluso si el Map cambiara de implementacion.
          cached.digest.length === presentedDigest.length &&
          timingSafeEqual(cached.digest, presentedDigest)
        ) {
          resolved = cached.row;
        } else {
          if (cached) verifiedKeys.delete(cacheKey);

          const lookupPrefix = raw.slice(0, 12);
          const row = await db.query.apiKeys.findFirst({
            where: and(eq(schema.apiKeys.prefix, lookupPrefix), isNull(schema.apiKeys.revokedAt)),
          });
          if (!row) throw errors.invalidApiKey();

          const ok = await argon2.verify(row.hash, raw).catch(() => false);
          if (!ok) throw errors.invalidApiKey();

          resolved = {
            id: row.id,
            institutionId: row.institutionId,
            scopes: row.scopes ?? [],
            expiresAt: row.expiresAt,
          };

          verifiedKeys.set(cacheKey, {
            expiresAtMs: now + CACHE_TTL_MS,
            digest: presentedDigest,
            row: resolved,
          });
          pruneCache();
        }

        // La expiracion se comprueba siempre, incluso sirviendo desde cache:
        // una clave puede caducar mientras su entrada sigue viva.
        if (resolved.expiresAt && resolved.expiresAt < new Date(now)) {
          verifiedKeys.delete(cacheKey);
          throw errors.invalidApiKey();
        }

        const scopes = resolved.scopes;
        for (const scope of requiredScopes) {
          if (!scopes.includes(scope) && !scopes.includes('*')) {
            throw errors.forbidden(`Falta el scope requerido: ${scope}`);
          }
        }

        const institution = await db.query.institutions.findFirst({
          where: eq(schema.institutions.id, resolved.institutionId),
        });
        if (!institution || institution.status !== 'approved') {
          verifiedKeys.delete(cacheKey);
          throw errors.forbidden('Institucion no activa');
        }

        req.apiKey = {
          apiKeyId: resolved.id,
          institutionId: resolved.institutionId,
          scopes,
          plan: institution.plan === 'enterprise' ? 'pro_extended' : (institution.plan as Plan),
        };

        // lastUsedAt es telemetria, no autorizacion: escribirlo en cada request
        // anade un UPDATE al camino critico y castiga justo a las integraciones
        // de mayor volumen. Lo agrupamos y nunca dejamos que su fallo tumbe la
        // request.
        const lastWrite = lastUsedWrites.get(resolved.id) ?? 0;
        if (now - lastWrite >= LAST_USED_THROTTLE_MS) {
          lastUsedWrites.set(resolved.id, now);
          void db
            .update(schema.apiKeys)
            .set({ lastUsedAt: new Date(now) })
            .where(eq(schema.apiKeys.id, resolved.id))
            .catch((err: unknown) => {
              req.log.warn({ err, apiKeyId: resolved.id }, 'No se pudo registrar lastUsedAt');
            });
        }
      };
    });
  },
  { name: 'api-key-guard', dependencies: ['error-handler'] },
);
