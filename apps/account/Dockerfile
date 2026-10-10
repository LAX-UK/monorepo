# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY patches ./patches
COPY packages ./packages
COPY apps/account/package.json ./apps/account/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/account ./apps/account
RUN pnpm turbo run build --filter=@auction/account

FROM node:22-alpine AS runner
WORKDIR /app
ARG IMAGE_SHA=unknown
ENV NODE_ENV=production
ENV PORT=3040
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV SENTRY_RELEASE=${IMAGE_SHA}
COPY --from=builder --chown=node:node /app/apps/account/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/account/.next/static ./apps/account/.next/static
USER node
EXPOSE 3040
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3040/health/live').then(async r=>{await r.text();process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/account/server.js"]
