# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/shop/package.json ./apps/shop/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG NEXT_PUBLIC_SHOP_IDENTITY_BASE_URL=https://test-shop.lax.bid
ARG SENTRY_RELEASE=unknown
ENV NEXT_PUBLIC_SHOP_IDENTITY_BASE_URL=$NEXT_PUBLIC_SHOP_IDENTITY_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/shop ./apps/shop
RUN pnpm turbo run build --filter=@auction/shop

FROM node:22-alpine AS runner
WORKDIR /app
ARG IMAGE_SHA=unknown
ENV NODE_ENV=production
ENV PORT=3020
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV SENTRY_RELEASE=${IMAGE_SHA}
COPY --from=builder --chown=node:node /app/apps/shop/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/shop/.next/static ./apps/shop/.next/static
USER node
EXPOSE 3020
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3020/health/ready').then(async r=>{await r.text();process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/shop/server.js"]
