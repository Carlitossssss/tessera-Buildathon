import NextAuth, { type DefaultSession, type User as AuthUser } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import { authApi } from '@/lib/api/endpoints/auth';

export type Role = 'admin' | 'institution_admin' | 'teacher' | 'student';

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  accessToken: z.string().optional(),
  accessTokenExpiresAt: z.string().optional(),
});

const oauthProviders = [];
if (serverEnv?.GOOGLE_CLIENT_ID && serverEnv?.GOOGLE_CLIENT_SECRET) {
  oauthProviders.push(
    Google({
      clientId: serverEnv.GOOGLE_CLIENT_ID,
      clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    accessTokenExpiresAt?: string | null;
    authInvalid?: boolean;
    user: {
      id: string;
      email: string;
      role: Role;
      institutionId?: string | null;
      restricted?: boolean;
      restrictedAt?: string | null;
      restrictionReason?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    role: Role;
    accessToken: string;
    accessTokenExpiresAt?: string | null;
    authInvalid?: boolean;
    institutionId?: string | null;
    restricted?: boolean;
    restrictedAt?: string | null;
    restrictionReason?: string | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: serverEnv.AUTH_SECRET,
  trustHost: serverEnv.AUTH_TRUST_HOST,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        // The login page exchanges credentials with the API first, then hands
        // this short-lived token to Auth.js to establish the browser session.
        accessToken: { label: 'Access token', type: 'text' },
        accessTokenExpiresAt: { label: 'Access token expiry', type: 'text' },
      },
      authorize: async (raw): Promise<AuthUser | null> => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        try {
          const res = parsed.data.accessToken
            ? {
                token: parsed.data.accessToken,
                tokenExpiresAt: parsed.data.accessTokenExpiresAt ?? new Date().toISOString(),
                user: (await authApi.me(parsed.data.accessToken)).user,
              }
            : await authApi.login(parsed.data.email.trim(), parsed.data.password);
          return {
            id: res.user.id,
            email: res.user.email,
            name: res.user.email,
            role: res.user.role,
            accessToken: res.token,
            accessTokenExpiresAt: res.tokenExpiresAt,
            institutionId: res.user.institutionId ?? null,
            restricted: res.user.restricted ?? false,
            restrictedAt: res.user.restrictedAt ?? null,
            restrictionReason: res.user.restrictionReason ?? null,
          };
        } catch {
          return null;
        }
      },
    }),
    ...oauthProviders,
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      const t = token as Record<string, unknown>;
      if (user) {
        const u = user as {
          id?: string;
          role?: Role;
          accessToken?: string;
          accessTokenExpiresAt?: string | null;
          authInvalid?: boolean;
          institutionId?: string | null;
          restricted?: boolean;
          restrictedAt?: string | null;
          restrictionReason?: string | null;
        };
        if (u.id) t.userId = u.id;
        if (u.role) t.role = u.role;
        if (u.accessToken) t.accessToken = u.accessToken;
        if (u.accessTokenExpiresAt) t.accessTokenExpiresAt = u.accessTokenExpiresAt;
        t.authInvalid = false;
        if (u.institutionId !== undefined) t.institutionId = u.institutionId;
        if (u.restricted !== undefined) t.restricted = u.restricted;
        if (u.restrictedAt !== undefined) t.restrictedAt = u.restrictedAt;
        if (u.restrictionReason !== undefined) t.restrictionReason = u.restrictionReason;
      }
      const accessToken = typeof t.accessToken === 'string' ? t.accessToken : null;
      const expiresAt =
        typeof t.accessTokenExpiresAt === 'string' ? Date.parse(t.accessTokenExpiresAt) : 0;
      const shouldRefresh = accessToken && expiresAt > 0 && Date.now() > expiresAt - 10 * 60 * 1000;
      if (shouldRefresh) {
        try {
          const refreshed = await authApi.refresh(accessToken);
          t.accessToken = refreshed.token;
          t.accessTokenExpiresAt = refreshed.tokenExpiresAt;
          t.institutionId = refreshed.user.institutionId ?? null;
          t.restricted = refreshed.user.restricted ?? false;
          t.restrictedAt = refreshed.user.restrictedAt ?? null;
          t.restrictionReason = refreshed.user.restrictionReason ?? null;
          t.authInvalid = false;
        } catch {
          t.authInvalid = true;
          delete t.accessToken;
          delete t.accessTokenExpiresAt;
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      const t = token as Record<string, unknown>;
      if (typeof t.accessToken === 'string') session.accessToken = t.accessToken;
      if (typeof t.accessTokenExpiresAt === 'string') {
        session.accessTokenExpiresAt = t.accessTokenExpiresAt;
      }
      if (typeof t.authInvalid === 'boolean') session.authInvalid = t.authInvalid;
      if (typeof t.role === 'string') session.user.role = t.role as Role;
      if (typeof t.userId === 'string') session.user.id = t.userId;
      if (typeof t.institutionId === 'string' || t.institutionId === null) {
        session.user.institutionId = t.institutionId as string | null;
      }
      if (typeof t.restricted === 'boolean') session.user.restricted = t.restricted;
      if (typeof t.restrictedAt === 'string' || t.restrictedAt === null) {
        session.user.restrictedAt = t.restrictedAt as string | null;
      }
      if (typeof t.restrictionReason === 'string' || t.restrictionReason === null) {
        session.user.restrictionReason = t.restrictionReason as string | null;
      }
      return session;
    },
    authorized: ({ auth: a }) => Boolean(a),
  },
});
