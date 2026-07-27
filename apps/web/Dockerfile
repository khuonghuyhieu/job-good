FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN --mount=type=cache,id=good-job-corepack,target=/root/.cache/node/corepack,sharing=locked \
    --mount=type=cache,id=good-job-pnpm,target=/pnpm/store,sharing=locked \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --filter @good-job/web...
COPY apps/web apps/web
COPY packages/config packages/config
COPY packages/contracts packages/contracts
ARG VITE_API_URL=http://localhost:3000
ARG VITE_WEBSOCKET_PATH=/socket.io
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WEBSOCKET_PATH=$VITE_WEBSOCKET_PATH
RUN pnpm --filter @good-job/web... build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
