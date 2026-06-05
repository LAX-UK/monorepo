# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/config-ts/package.json ./packages/config-ts/
COPY apps/event/package.json ./apps/event/
RUN pnpm install --frozen-lockfile --filter @auction/event...

FROM deps AS builder
COPY packages/config-ts ./packages/config-ts
COPY apps/event ./apps/event
ARG VITE_API_BASE=https://api.lax.bid
ARG VITE_WEB_ORIGIN=https://lax.bid
ARG VITE_EVENT_ORIGIN=https://event.lax.bid
ARG VITE_CDN_BASE=https://cdn.lax.bid
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_WEB_ORIGIN=$VITE_WEB_ORIGIN
ENV VITE_EVENT_ORIGIN=$VITE_EVENT_ORIGIN
ENV VITE_CDN_BASE=$VITE_CDN_BASE
RUN pnpm --filter @auction/event build

FROM nginx:alpine AS runner
COPY apps/event/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/event/dist /usr/share/nginx/html
EXPOSE 80
