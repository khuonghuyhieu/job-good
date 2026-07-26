FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile --filter @good-job/worker...
COPY apps/worker apps/worker
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY packages/database packages/database
RUN pnpm db:generate && pnpm --filter @good-job/worker... build

FROM node:22-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
RUN apk add --no-cache ffmpeg
RUN corepack enable
COPY --from=build /workspace /workspace
CMD ["node", "apps/worker/dist/main.js"]
