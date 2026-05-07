  FROM node:22-slim AS base

  FROM base AS builder
  WORKDIR /app
  RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
  RUN corepack enable && corepack prepare pnpm@10 --activate
  COPY package.json package-lock.json ./
  RUN pnpm import && pnpm install --frozen-lockfile
  COPY . .
  RUN pnpm run build
  

  FROM base AS runner
  WORKDIR /app
  ENV NODE_ENV=production

  RUN addgroup --system --gid 1001 nodejs
  RUN adduser --system --uid 1001 nextjs

  COPY --from=builder /app/public ./public
  COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
  COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

  USER nextjs
  EXPOSE 3000
  ENV PORT=3000
  ENV HOSTNAME="0.0.0.0"

  CMD ["node", "server.js"]