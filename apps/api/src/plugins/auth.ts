import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { eq } from '@tessera/db';
import { schema } from '@tessera/db';
import { env } from '../config/env.js';
import { errors } from '@tessera/shared/errors';
import type { AuthContext } from '@tessera/shared/types';
import { getDb } from '../lib/db.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
  interface FastifyInstance {
    requireAuth: (roles?: string[]) => (req: import('fastify').FastifyRequest) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: string; email: string; institutionId: string | null };
    user: AuthContext;
  }
}

export default fp(
  async (app) => {
    await app.register(jwt, {
      secret: env.AUTH_SECRET,
      cookie: {
        cookieName: 'authjs.session-token',
        signed: false,
      },
      verify: {
        algorithms: ['HS256'],
        allowedIss: env.AUTH_URL,
        allowedAud: env.API_PUBLIC_URL,
        extractToken: (req) => {
          const header = req.headers.authorization;
          if (header?.startsWith('Bearer ')) return header.slice(7);
          const cookie = req.headers.cookie?.match(/authjs\.session-token=([^;]+)/);
          return cookie?.[1];
        },
      },
    });

    app.decorate('requireAuth', (roles?: string[]) => {
      return async (req) => {
        try {
          const payload = await req.jwtVerify<{
            sub: string;
            role: string;
            email: string;
            institutionId: string | null;
          }>();
          req.auth = {
            userId: payload.sub,
            role: payload.role as AuthContext['role'],
            email: payload.email,
            institutionId: payload.institutionId ?? null,
          };
        } catch {
          throw errors.unauthorized();
        }

        const user = await getDb().query.users.findFirst({
          columns: {
            id: true,
            deletedAt: true,
            restricted: true,
            restrictedAt: true,
          },
          where: eq(schema.users.id, req.auth!.userId),
        });
        if (!user || user.deletedAt) throw errors.unauthorized();

        let restrictionReason: string | null = null;
        try {
          const [restriction] = await getDb()
            .select({ reason: schema.users.restrictionReason })
            .from(schema.users)
            .where(eq(schema.users.id, req.auth!.userId))
            .limit(1);
          restrictionReason = restriction?.reason ?? null;
        } catch {
          restrictionReason = null;
        }

        req.auth = {
          ...req.auth!,
          restricted: user.restricted,
          restrictedAt: user.restrictedAt,
          restrictionReason,
        };

        const restrictedAllowed =
          req.routeOptions.url === '/v1/auth/me' ||
          req.routeOptions.url === '/v1/auth/refresh' ||
          req.routeOptions.url === '/v1/auth/restricted-appeal';
        if (user.restricted && !restrictedAllowed) {
          throw errors.forbidden('Tu cuenta esta suspendida');
        }

        if (roles && roles.length > 0 && !roles.includes(req.auth!.role)) {
          throw errors.forbidden('No tienes permisos para acceder a este recurso');
        }
      };
    });
  },
  { name: 'auth', dependencies: ['error-handler'] },
);
