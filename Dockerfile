# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22.11.0

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/contracts/package.json ./packages/contracts/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @tessera/shared build || true
RUN pnpm --filter @tessera/db build || true
RUN pnpm --filter @tessera/contracts build || true
RUN pnpm --filter @tessera/api build

FROM base AS runtime
RUN apk add --no-cache fontconfig ttf-dejavu
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3001
USER node
CMD ["node", "apps/api/dist/server.js"]
