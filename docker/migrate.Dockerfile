# syntax=docker/dockerfile:1
# Slim pre-deploy migration image. Builds ONLY @auction/db (and its workspace
# deps via turbo `^build`) instead of the full API, which the migrate Job used to
# pull in via apps/api/Dockerfile. The runtime entrypoint is set by the App
# Platform Job `run_command` (node packages/db/dist/migrate-prod.js).
#
# NOTE: keep this Dockerfile free of BuildKit-only `RUN --mount=...` syntax so it
# also builds on DigitalOcean's (non-BuildKit) App Platform builders if ever used
# as a Git-source component. GHA buildx supplies the layer cache for CI builds.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
# Same install layer shape as the app Dockerfiles so the deps layer can be
# reused from cache across all images.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/auth/package.json ./apps/auth/
COPY apps/api/package.json ./apps/api/
COPY apps/ws/package.json ./apps/ws/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
# `packages` source is already present from the deps stage; build just the db
# package (turbo pulls in @auction/validators / config-ts via ^build).
RUN pnpm turbo run build --filter=@auction/db

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
# Copies packages/db/dist (compiled migrator) AND packages/db/drizzle (the raw
# SQL the runner reads at runtime via __dirname/../drizzle).
COPY --from=builder /app/packages ./packages
CMD ["node", "packages/db/dist/migrate-prod.js"]
