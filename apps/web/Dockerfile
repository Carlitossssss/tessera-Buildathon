# syntax=docker/dockerfile:1.7
# Tessera Web - Next.js 15 (App Router)
# Build estándar (no standalone) por compatibilidad con Windows + pnpm symlinks.

ARG NODE_VERSION=22.18.0

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/contracts/package.json ./packages/contracts/
RUN --mount=type=cache,id=pnpm-web,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @tessera/web...

FROM deps AS build
ARG BUILD_AUTH_SECRET=build-only-auth-secret-not-used-at-runtime-32-chars
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_POLYGON_CHAIN_ID
ARG NEXT_PUBLIC_POLYGON_RPC_URL
ARG NEXT_PUBLIC_CONTRACT_REGISTRY
ARG NEXT_PUBLIC_CONTRACT_CERTIFICATE
ARG NEXT_PUBLIC_CONTRACT_BADGE
ARG NEXT_PUBLIC_UNLOCK_LOCK_ADDRESS
ARG NEXT_PUBLIC_UNLOCK_CHAIN_ID
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
# Next collects server component configuration during `next build`. This value
# exists only in the build stage; the real AUTH_SECRET is supplied at runtime.
ENV AUTH_SECRET=$BUILD_AUTH_SECRET
ENV AUTH_TRUST_HOST=true
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_POLYGON_CHAIN_ID=$NEXT_PUBLIC_POLYGON_CHAIN_ID
ENV NEXT_PUBLIC_POLYGON_RPC_URL=$NEXT_PUBLIC_POLYGON_RPC_URL
ENV NEXT_PUBLIC_CONTRACT_REGISTRY=$NEXT_PUBLIC_CONTRACT_REGISTRY
ENV NEXT_PUBLIC_CONTRACT_CERTIFICATE=$NEXT_PUBLIC_CONTRACT_CERTIFICATE
ENV NEXT_PUBLIC_CONTRACT_BADGE=$NEXT_PUBLIC_CONTRACT_BADGE
ENV NEXT_PUBLIC_UNLOCK_LOCK_ADDRESS=$NEXT_PUBLIC_UNLOCK_LOCK_ADDRESS
ENV NEXT_PUBLIC_UNLOCK_CHAIN_ID=$NEXT_PUBLIC_UNLOCK_CHAIN_ID
RUN pnpm --filter @tessera/web build

FROM node:${NODE_VERSION}-alpine AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Copiamos todo lo necesario para ejecutar Next.js directamente en runtime.
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/packages ./packages
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Next escribe en .next/cache en runtime (optimizacion de imagenes). Los
# archivos llegan del stage de build como root, asi que sin este chown el
# proceso "node" no puede crear .next/cache/images y cada imagen falla con
# EACCES. Se hace antes de cambiar de usuario.
RUN mkdir -p /app/apps/web/.next/cache \
    && chown -R node:node /app/apps/web/.next

EXPOSE 3000
USER node
CMD ["node", "apps/web/node_modules/next/dist/bin/next", "start", "apps/web"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
