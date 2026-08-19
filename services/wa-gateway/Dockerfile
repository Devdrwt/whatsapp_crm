# syntax=docker/dockerfile:1

# ============================================================
#  wa-gateway — WhatsApp Web (Baileys) side-car
#
#  INTERNAL PILOT ONLY. Unofficial transport, never client-facing.
#  See docs/pilote-baileys.md before deploying this anywhere.
# ============================================================
#
# Note the base image: the main app runs on node:22-alpine, but Baileys 7
# pulls `whatsapp-rust-bridge`, a prebuilt native addon linked against
# glibc. On alpine (musl) it either fails to install or loads and then
# crashes at the first socket handshake — the kind of failure that looks
# like a WhatsApp problem rather than a libc problem. Debian slim avoids
# the whole class.

# ---------- 1. Builder ----------
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json ./
# No lockfile is committed for the side-car: it is pinned to an exact
# Baileys release candidate in package.json, and `npm install` here keeps
# the pilot trivially bumpable without a second lockfile to maintain.
RUN npm install

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
# tsconfig.build.json excludes *.test.ts, so no test file (nor its vitest
# import) reaches dist and therefore the runner stage.
RUN npm run build

# ---------- 2. Runner ----------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    WA_DATA_DIR=/data

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Signal credentials, cached media and per-org state live on the volume.
# `node` (uid 1000) ships with the base image; running as root would make
# the volume's files root-owned and awkward to inspect from the host.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

VOLUME ["/data"]
EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4100)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
