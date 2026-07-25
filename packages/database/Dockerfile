FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile --filter @good-job/database...
COPY packages/database packages/database
RUN pnpm db:generate

FROM node:22-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /workspace /workspace
CMD ["./packages/database/node_modules/.bin/prisma", "migrate", "deploy", "--schema=packages/database/prisma/schema.prisma"]
