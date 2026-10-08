# syntax=docker/dockerfile:1

# Se construye desde la raíz del monorepo:
#   docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# Primero sólo los manifiestos, para que Docker reutilice la capa de
# dependencias mientras no cambie el lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @ecolentes/shared build \
 && pnpm --filter @ecolentes/api prisma:generate \
 && pnpm --filter @ecolentes/api build

FROM node:22-alpine AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app

# Se copian también las dependencias de desarrollo: el cliente de Prisma se
# genera dentro de node_modules y las migraciones se aplican con el CLI de
# Prisma al arrancar.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./

EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @ecolentes/api exec prisma migrate deploy && node apps/api/dist/main.js"]
