  # check=skip=SecretsUsedInArgOrEnv
  FROM node:22-slim AS base

  FROM base AS builder
  WORKDIR /app
  RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
  RUN corepack enable && corepack prepare pnpm@11 --activate
  COPY package.json package-lock.json pnpm-workspace.yaml ./
  RUN pnpm import && pnpm install --frozen-lockfile
  COPY . .
  # Next.js requires these at build time; real values are provided at runtime via docker run --env-file
  ARG MONGODB_URI=mongodb://placeholder:27017/placeholder
  ARG AUTH_SECRET=build-placeholder
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