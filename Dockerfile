FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholders for `next build` page-data collection only — real secrets stay runtime-only in Coolify
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
ENV AUTH_SECRET="build-time-placeholder-not-used-at-runtime"
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN (apk add --no-cache postgresql16-client || apk add --no-cache postgresql-client) \
  && addgroup -S nodejs && adduser -S nextjs -G nodejs \
  && mkdir -p /data/backups /data/uploads \
  && chown -R nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chmod +x ./scripts/apply-pending.sh ./scripts/backup.sh ./scripts/seed-once.sh ./scripts/boot.sh \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3100
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
ENV BACKUP_DIR=/data/backups
ENV UPLOADS_DIR=/data/uploads
VOLUME ["/data"]
# ترحيل تراكمي فقط — لا بذرة عند كل إقلاع (البذرة: npm run init مرة واحدة)
CMD ["sh", "-c", "./scripts/apply-pending.sh && node server.js"]
