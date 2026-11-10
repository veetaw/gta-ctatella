FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src/ ./src/
COPY server/ ./server/
COPY public/world-data.json public/dbt-extras.json ./public/
COPY public/teglie/world.pack ./public/teglie/world.pack
USER node
EXPOSE 8080
CMD ["node", "server/online.mjs"]
