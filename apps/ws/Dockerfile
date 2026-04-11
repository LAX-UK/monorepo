# syntax=docker/dockerfile:1
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/ws ./apps/ws
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@auction/ws
ENV NODE_ENV=production
EXPOSE 3002
CMD ["node", "apps/ws/dist/index.js"]
