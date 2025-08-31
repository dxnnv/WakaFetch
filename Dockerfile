# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=23116
ENV BASE_PATH=/wakafetch

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=builder /app/dist ./dist
COPY .env.example ./

USER node
EXPOSE 23116
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD sh -lc 'wget -qO- "http://127.0.0.1:${PORT:-23116}${BASE_PATH:-/wakafetch}/healthz" >/dev/null || exit 1'
CMD ["node", "dist/app/server.js"]