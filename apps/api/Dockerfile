FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile --filter @good-job/api...
COPY apps/api apps/api
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY packages/database packages/database
RUN pnpm db:generate && pnpm --filter @good-job/api... build

FROM node:22-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /workspace /workspace
CMD ["node", "apps/api/dist/main.js"]
