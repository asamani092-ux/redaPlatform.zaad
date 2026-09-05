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
ENV DOCKER_BUILD=1
ENV NODE_OPTIONS=--max-old-space-size=3072
# Placeholders for next build only (Coolify ARG rewriter corrupts lines containing at-sign)
ENV DATABASE_URL=postgresql://127.0.0.1:5432/build
ENV AUTH_SECRET=build-time-placeholder-not-used-at-runtime
RUN npx prisma generate && npm run build

# Prisma CLI + tsx فقط — الإصدارات داخل JSON بلا رمز at-sign (Coolify يفسد package@version)
FROM node:22-alpine AS tools
WORKDIR /tools
RUN printf '%s' '{"private":true,"dependencies":{"prisma":"7.9.1","tsx":"4.23.1","typescript":"5.9.3"}}' > package.json \
  && npm install --ignore-scripts

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN (apk add --no-cache bash openssl libc6-compat su-exec postgresql16-client \
      || apk add --no-cache bash openssl libc6-compat su-exec postgresql-client) \
  && addgroup -S nodejs && adduser -S nextjs -G nodejs \
  && mkdir -p /data/backups /data/uploads /data/uploads/evidence /data/uploads/presentation-logos \
  && chown -R nextjs:nodejs /data

# بلا --chown على الطبقات الكبيرة: يقلّل ضغط القرص أثناء export (فشل Coolify 255)
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/assets ./assets
# مطلوب لـ npm run init / reset-admin في الحاوية
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/src/lib ./src/lib
# standalone يحوي اعتماديات التشغيل المتتبَّعة — بلا نسخ node_modules الكامل
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# دمج Prisma/tsx فوق standalone (حجم أصغر بكثير من prod node_modules)
COPY --from=tools /tools/node_modules /tmp/tools-nm
RUN cp -a /tmp/tools-nm/. ./node_modules/ \
  && rm -rf /tmp/tools-nm \
  && chmod +x ./scripts/entrypoint.sh ./scripts/apply-pending.sh ./scripts/backup.sh \
      ./scripts/seed-once.sh ./scripts/boot.sh ./scripts/check-storage-persist.sh \
  && chown -R nextjs:nodejs ./src/generated ./prisma

# الإقلاع كـ root لضبط صلاحيات volume /data ثم su-exec → nextjs
USER root
EXPOSE 3100
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
ENV BACKUP_DIR=/data/backups
ENV UPLOADS_DIR=/data/uploads
VOLUME ["/data"]
# ترحيل تراكمي فقط — لا بذرة عند كل إقلاع (البذرة: npm run init مرة واحدة)
CMD ["./scripts/entrypoint.sh"]
