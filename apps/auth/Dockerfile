# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/auth/package.json ./apps/auth/
COPY packages/auth/package.json ./packages/auth/
COPY packages/config-ts/package.json ./packages/config-ts/
COPY packages/identity-contracts/package.json ./packages/identity-contracts/
COPY packages/identity-db/package.json ./packages/identity-db/
COPY packages/observability/package.json ./packages/observability/
COPY scripts/ci/prepare-identity-lockfile.mjs ./scripts/ci/prepare-identity-lockfile.mjs
RUN node scripts/ci/prepare-identity-lockfile.mjs pnpm-lock.yaml package.json \
  && pnpm --config.node-linker=isolated install \
    --frozen-lockfile \
    --filter @auction/auth-app...

FROM deps AS builder
COPY apps/auth ./apps/auth
COPY packages/auth ./packages/auth
COPY packages/config-ts ./packages/config-ts
COPY packages/identity-contracts ./packages/identity-contracts
COPY packages/identity-db ./packages/identity-db
COPY packages/observability ./packages/observability
RUN pnpm --filter @auction/auth-app... --workspace-concurrency=1 build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/auth/package.json ./apps/auth/
COPY packages/auth/package.json ./packages/auth/
COPY packages/config-ts/package.json ./packages/config-ts/
COPY packages/identity-contracts/package.json ./packages/identity-contracts/
COPY packages/identity-db/package.json ./packages/identity-db/
COPY packages/observability/package.json ./packages/observability/
COPY scripts/ci/prepare-identity-lockfile.mjs ./scripts/ci/prepare-identity-lockfile.mjs
RUN node scripts/ci/prepare-identity-lockfile.mjs pnpm-lock.yaml package.json \
  && pnpm --config.node-linker=isolated install \
  --prod \
  --no-optional \
  --frozen-lockfile \
  --filter @auction/auth-app... \
  && test -z "$(find node_modules/.pnpm -maxdepth 1 \
    \( -name 'next@*' -o -name 'sharp@*' -o -name 'vitest@*' -o -name '@playwright+test@*' \) \
    -print -quit)"

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/auth/node_modules ./apps/auth/node_modules
COPY --from=prod-deps /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=prod-deps /app/packages/identity-contracts/node_modules ./packages/identity-contracts/node_modules
COPY --from=prod-deps /app/packages/identity-db/node_modules ./packages/identity-db/node_modules
COPY --from=prod-deps /app/packages/observability/node_modules ./packages/observability/node_modules
COPY --from=builder /app/apps/auth/package.json ./apps/auth/package.json
COPY --from=builder /app/apps/auth/dist ./apps/auth/dist
COPY --from=builder /app/packages/auth/package.json ./packages/auth/package.json
COPY --from=builder /app/packages/auth/dist ./packages/auth/dist
COPY --from=builder /app/packages/identity-contracts/package.json ./packages/identity-contracts/package.json
COPY --from=builder /app/packages/identity-contracts/dist ./packages/identity-contracts/dist
COPY --from=builder /app/packages/identity-db/package.json ./packages/identity-db/package.json
COPY --from=builder /app/packages/identity-db/dist ./packages/identity-db/dist
COPY --from=builder /app/packages/observability/package.json ./packages/observability/package.json
COPY --from=builder /app/packages/observability/dist ./packages/observability/dist
EXPOSE 3003
USER node
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3003/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/auth/dist/index.js"]
