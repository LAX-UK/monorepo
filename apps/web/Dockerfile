# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/
COPY apps/ws/package.json ./apps/ws/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
ARG NEXT_PUBLIC_AUTH_URL=
ARG NEXT_PUBLIC_WS_URL=http://127.0.0.1:3002
ARG NEXT_PUBLIC_SETTLEMENTS_EMAIL=
ARG NEXT_PUBLIC_SETTLEMENTS_PHONE=
ARG NEXT_PUBLIC_ENGLISH_ONLY_AUCTIONS=true
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_SETTLEMENTS_EMAIL=$NEXT_PUBLIC_SETTLEMENTS_EMAIL
ENV NEXT_PUBLIC_SETTLEMENTS_PHONE=$NEXT_PUBLIC_SETTLEMENTS_PHONE
ENV NEXT_PUBLIC_ENGLISH_ONLY_AUCTIONS=$NEXT_PUBLIC_ENGLISH_ONLY_AUCTIONS
COPY apps/api ./apps/api
COPY apps/web ./apps/web
RUN pnpm turbo run build --filter=@auction/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(async r=>{await r.text();process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
