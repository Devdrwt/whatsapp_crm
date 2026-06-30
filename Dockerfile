# syntax=docker/dockerfile:1

# ============================================================
#  wacrm — production image (Next.js 16 standalone)
#  Pattern: aligned on /opt/drwintech/Dockerfile (Hostinger VPS,
#  nginx front, ghcr.io registry).
# ============================================================

# ---------- 1. Builder ----------
FROM node:22-alpine AS builder
WORKDIR /app

# libc6-compat helps native deps on alpine.
RUN apk add --no-cache libc6-compat

# Dependencies first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

# NEXT_PUBLIC_* values are INLINED into the client bundle by `next build`,
# so they must be present at build time. CI passes them via build-args.
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ARG NEXT_PUBLIC_SITE_URL="https://drwt-crm.drwintech.com"
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- 2. Runner ----------
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Unprivileged user — required for Next.js standalone in containers.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# Standalone server + static + public. The standalone bundle is
# self-contained (only the deps Next traced). .next/static and public
# are copied separately because Next intentionally leaves CDN-served
# assets out of standalone — we serve them through Next itself here
# (nginx terminates TLS upstream but doesn't cache statics).
#
# i18n message catalogs (messages/*.json) are picked up automatically
# via outputFileTracingIncludes in next.config.ts — they land inside
# .next/standalone/messages/, so the first COPY brings them.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
