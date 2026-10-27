# ---- build ----
FROM node:24-bookworm-slim AS build
WORKDIR /usr/src/api
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit --loglevel=error
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime: só o necessário, usuário sem privilégios ----
FROM node:24-bookworm-slim
ENV NODE_ENV=prd
WORKDIR /usr/src/api
COPY --from=build --chown=node:node /usr/src/api/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/api/dist ./dist
COPY --from=build --chown=node:node /usr/src/api/public ./public
COPY --from=build --chown=node:node /usr/src/api/package.json ./package.json
USER node
EXPOSE 3000
# Aplica migrations pendentes e sobe a API.
CMD ["sh", "-c", "node ./node_modules/typeorm/cli.js -d ./dist/src/config/dataSource.js migration:run && exec node dist/src/main"]
