# Auto Reaction Bot

A Telegram bot that automatically reacts to messages in channels, groups, and private chats with emoji reactions. Ported from a Vercel/Cloudflare serverless deployment to Replit's pnpm workspace stack.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (scaffold, not used by bot)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/routes/bot.ts` — webhook handler + landing page route
- `artifacts/api-server/src/lib/bot-handler.ts` — core Telegram update processing logic
- `artifacts/api-server/src/lib/telegram-bot-api.ts` — Telegram Bot API client
- `artifacts/api-server/src/lib/bot-constants.ts` — messages and HTML landing page
- `artifacts/api-server/src/lib/bot-helper.ts` — emoji splitting, chat ID parsing, random reaction

## Architecture decisions

- Bot webhook endpoint: `POST /api/bot/webhook` — Telegram sends updates here
- Landing page: `GET /api/bot/` — served at root (redirected from `/`)
- Health check: `GET /api/healthz` — used for production health monitoring
- The bot is entirely stateless — no database needed; all config via environment variables

## Product

A Telegram bot that automatically reacts to messages with emojis. Supports:
- DMs, groups, channels
- Customizable emoji list
- Random reaction level for groups (0-10)
- Restricted chat list (chats where bot won't react)
- `/start`, `/reactions`, `/donate` commands

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Set the Telegram webhook URL to `https://<your-domain>/api/bot/webhook` after deploying
- Required env vars must be set before the bot will work: `BOT_TOKEN`, `BOT_USERNAME`, `EMOJI_LIST`
- `RANDOM_LEVEL` and `RESTRICTED_CHATS` are optional

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | Yes | Telegram bot token from BotFather |
| `BOT_USERNAME` | Yes | Bot username (without @) |
| `EMOJI_LIST` | Yes | String of emojis the bot reacts with |
| `RANDOM_LEVEL` | No | Group reaction randomness 0-10 (default: 0) |
| `RESTRICTED_CHATS` | No | Comma-separated chat IDs to skip |

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
