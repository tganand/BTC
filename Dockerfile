# Production Dockerfile for continuous 24/7 BTC Signal Monitoring
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runner stage with Alpine Chromium support
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

# Install Chromium and required fonts/libraries in Alpine
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

COPY package*.json ./
RUN npm ci --omit=dev && npm install -g tsx

# Copy compiled frontend and server source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/server ./src/server

# Data persistence directory
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME /app/data

USER node

EXPOSE 3000

CMD ["tsx", "server.ts"]
