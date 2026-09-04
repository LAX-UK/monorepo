# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/shop-identity/package.json ./apps/shop-identity/
COPY apps/auth/package.json ./apps/auth/
COPY apps/api/package.json ./apps/api/
COPY apps/ws/package.json ./apps/ws/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY apps/shop-identity ./apps/shop-identity
RUN pnpm turbo run build --filter=@auction/shop-identity

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/shop-identity/package.json ./apps/shop-identity/package.json
COPY --from=builder /app/apps/shop-identity/node_modules ./apps/shop-identity/node_modules
COPY --from=builder /app/apps/shop-identity/dist ./apps/shop-identity/dist
EXPOSE 3010
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3010/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/shop-identity/dist/index.js"]
