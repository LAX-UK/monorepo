# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY patches ./patches
COPY packages ./packages
COPY apps/shop-api/package.json ./apps/shop-api/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY apps/shop-api ./apps/shop-api
RUN pnpm turbo run build --filter=@auction/shop-api...

FROM node:22-alpine AS runner
WORKDIR /app
ARG IMAGE_SHA=unknown
ENV NODE_ENV=production
ENV SENTRY_RELEASE=${IMAGE_SHA}
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/shop-api/package.json ./apps/shop-api/package.json
COPY --from=builder /app/apps/shop-api/node_modules ./apps/shop-api/node_modules
COPY --from=builder /app/apps/shop-api/dist ./apps/shop-api/dist
EXPOSE 3011
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3011/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/shop-api/dist/server.js"]
