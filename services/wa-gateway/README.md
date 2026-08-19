# wa-gateway

WhatsApp Web (Baileys) side-car for wacrm.

> **INTERNAL PILOT ONLY.** This service runs an unofficial,
> reverse-engineered WhatsApp client. It violates WhatsApp's Terms of
> Service and can get the paired number banned. It is never exposed to
> clients, never priced, and never mentioned in client-facing material.
>
> Read [`docs/pilote-baileys.md`](../../docs/pilote-baileys.md) before
> touching this.

## What it does

Holds one long-lived WhatsApp Web socket per organization, and translates
in both directions so the CRM only ever speaks Meta Cloud API:

- **Inbound** — Baileys events become Meta-shaped webhook payloads, HMAC
  signed with `WA_GATEWAY_SECRET`, POSTed to the CRM's existing
  `/api/whatsapp/webhook`. Nothing downstream branches on transport.
- **Outbound** — the CRM's Meta-shaped send payloads become Baileys
  message content.

It is a separate process because the connection is stateful, long-lived
and single-instance — none of which a Next.js route handler can be.

## Endpoints

All except `/health` require `Authorization: Bearer $WA_GATEWAY_TOKEN`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness, unauthenticated |
| `POST` | `/sessions/:orgId/connect` | Start pairing. Body `{}` for QR, `{"phoneNumber":"216…"}` for a pairing code |
| `GET` | `/sessions/:orgId` | Session snapshot |
| `DELETE` | `/sessions/:orgId` | Log out, wipe credentials, state and media |
| `POST` | `/sessions/:orgId/messages` | Send (`text` / `buttons` / `list` / `reaction`) |
| `GET`\|`HEAD` | `/sessions/:orgId/media/:mediaId` | Cached inbound media bytes |

Session states: `pairing` → `connected`, or `disconnected` (retrying with
backoff) / `logged_out` (terminal — re-pair by hand).

## Environment

| Variable | Required | Default | Notes |
|---|---|---|---|
| `WA_GATEWAY_TOKEN` | yes | — | Bearer token the CRM presents |
| `WA_GATEWAY_SECRET` | yes | — | HMAC key for outbound webhooks. Identical app-side, and **must differ** from `META_APP_SECRET` |
| `WA_WEBHOOK_URL` | yes | — | e.g. `http://app:3000/api/whatsapp/webhook` |
| `PORT` | no | `4100` | |
| `WA_DATA_DIR` | no | `/data` | Credentials, media cache, per-org state |
| `WA_INTERACTIVE_MODE` | no | `text` | `text` = numbered menu (works everywhere), `native` = WhatsApp Web buttons (unreliable) |
| `WA_IGNORE_GROUPS` | no | `true` | The CRM models one contact per conversation |
| `LOG_LEVEL` | no | `info` | |

Missing required variables are a startup crash, on purpose — a
misconfiguration should not surface as a 500 mid-demo.

## Layout

```
src/
  index.ts             HTTP surface (node:http, no framework)
  session-manager.ts   One Baileys socket per org: pairing, reconnect, send
  translate-inbound.ts Baileys message → Meta webhook payload
  translate-outbound.ts CRM send payload → Baileys content
  webhook-emitter.ts   Signs and delivers, with retry
  store.ts             Message-key index + pending numbered-menu prompts
  media-store.ts       On-disk cache for decrypted inbound media
  config.ts            Env, validated once at boot
```

Two pieces of state exist only because WhatsApp Web works differently
from the Cloud API, and are worth knowing about:

- **`store.ts` message keys** — WhatsApp addresses a message by a full
  key (`{remoteJid, id, fromMe}`), while the CRM carries only a flat id.
  Reactions and quotes need the reverse lookup. Bounded to 2 000 entries
  per org, so reactions on older messages fail with a clear error.
- **`store.ts` pending prompts** — when a Flows menu is rendered as
  numbered text, the customer answers `2` or `Tarifs`. Mapping that back
  to the option id the Flows runner expects requires remembering what we
  last offered. One-shot per contact.

## Development

```bash
npm install
npm run build
WA_GATEWAY_TOKEN=dev WA_GATEWAY_SECRET=dev \
WA_WEBHOOK_URL=http://localhost:3000/api/whatsapp/webhook \
WA_DATA_DIR=./.data \
npm start
```

Set the matching `WA_GATEWAY_*` values in the app's `.env.local` so both
sides agree.

## Notes

- Base image is `node:22-slim`, not `node:22-alpine` like the app.
  Baileys 7 pulls `whatsapp-rust-bridge`, a native addon linked against
  glibc; on musl it fails at the first socket handshake in a way that
  looks like a WhatsApp problem rather than a libc one.
- Baileys is pinned to an exact release candidate (`7.0.0-rc14`). No
  lockfile is committed — the pin in `package.json` is the contract.
- The `/data` volume holds Signal credentials. Losing it unpairs every
  session; copying it clones the WhatsApp identity. Treat it as a secret.
