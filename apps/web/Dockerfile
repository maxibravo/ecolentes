# syntax=docker/dockerfile:1

# Se construye desde la raíz del monorepo: docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @ecolentes/shared build \
 && pnpm --filter @ecolentes/web build

# La web se sirve estática, con nginx mandando /api a la API.
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
