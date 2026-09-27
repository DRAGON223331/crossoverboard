# Crossover Dashboard (standalone, Vercel-ready)

A separate web app — not part of the bot's own process — that lets a server
admin log in with Discord and change the bot's per-guild settings (prefix,
game room channel, language, cross-server play) from a form instead of
typing `!settings` in Discord.

It talks to Discord only over REST (login, guild list, channel rename) and
to the **same Upstash Redis database the bot itself uses** — so it never
needs a live gateway connection and can run as short-lived serverless
functions on Vercel.

## How it stays in sync with the bot

The bot (running separately, e.g. on Pella) only used to read these
settings once at startup. It has been updated (see `handlers/remoteStore.js`
→ `startAutoRefresh`, used by `handlers/prefix.js`, `handlers/language.js`,
`handlers/gameRoom.js`, and `handlers/onlineMode.js`) to re-read **all
four** settings from Redis every 10 seconds, so a change saved here — prefix,
language, game room, or cross-server play — shows up in the running bot
within 10 seconds, no bot restart needed.

## One-time setup

### 1. Discord application

Use the **same application** as the bot (Discord Developer Portal → your
app → OAuth2):
- Note the **Client ID** and generate/copy a **Client Secret**.
- Under **Redirects**, add: `https://<your-vercel-domain>/api/auth/callback`
  (you'll know the exact domain after step 3's first deploy — you can add it
  afterwards, then redeploy).

### 2. Upstash Redis

Use the **same database** the bot's `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` point to (console.upstash.com → your database →
REST API). If the bot doesn't have Upstash configured yet, set it up there
first (see the bot's own `handlers/remoteStore.js`) — both apps must point
at the exact same database, or the dashboard will be editing settings the
bot never reads.

### 3. Deploy to Vercel

1. Push this folder to its own GitHub repo (or upload it directly in the
   Vercel dashboard).
2. In Vercel: **New Project** → import the repo → it auto-detects Next.js.
3. Add these Environment Variables before the first deploy (Project →
   Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `DISCORD_CLIENT_ID` | from step 1 |
   | `DISCORD_CLIENT_SECRET` | from step 1 |
   | `DISCORD_BOT_TOKEN` | the bot's own token (same as the bot's `DISCORD_TOKEN`) |
   | `DASHBOARD_BASE_URL` | `https://<your-vercel-domain>` (no trailing slash) |
   | `SESSION_SECRET` | any long random string — generate with `openssl rand -hex 32` |
   | `UPSTASH_REDIS_REST_URL` | from step 2 |
   | `UPSTASH_REDIS_REST_TOKEN` | from step 2 |

4. Deploy. Copy the `https://....vercel.app` domain Vercel gives you into
   `DASHBOARD_BASE_URL` (redeploy if you added it after the first deploy)
   and into the Discord Developer Portal redirect from step 1.

### 4. Bot permissions

The bot must already have **Manage Channels** in a server for the "rename
the game room channel" feature to work there — this is already requested by
the bot's own `!invite` link, so nothing extra is needed if the server owner
used that link.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the real values
npm run dev
```

Set `DASHBOARD_BASE_URL=http://localhost:3000` for local testing, and add
`http://localhost:3000/api/auth/callback` as an extra Redirect in the
Discord Developer Portal.

## What this does NOT do (by design)

- It cannot create a brand-new game-room channel or run `!chcreate` — only
  point the bot at an **existing** text channel (`!chset`) and optionally
  rename it (`!chname`). Creating channels from here can be added later if
  you want it.
- It only lists servers where you have **Manage Server** or **Administrator**
  permission and the bot is already a member — it can't add the bot to a
  new server (use the bot's own `!invite` command for that).
- Login sessions last 7 days (matching Discord's own access-token lifetime)
  with no refresh-token flow yet — after 7 days you'll need to sign in
  again.


## Discord permissions required

The dashboard uses two different identities:

- **Logged-in user OAuth token:** used for checking that the user can manage the guild and for reading AutoMod rules. The user must have **Manage Server** or **Administrator**. Discord documents AutoMod access as requiring Manage Server/Administrator.
- **Bot token:** used to inspect the bot's member roles, channel permissions, list channels, rename/create the game room, and perform bot-side operations.

The game-room health check resolves the bot's actual user ID through `/users/@me` before requesting `/guilds/{guildId}/members/{botUserId}`. It does not use `/members/@me`, which Discord rejects for this endpoint.


### AutoMod permissions
The dashboard reads Discord AutoMod rules using the dashboard bot token. The bot must have **Manage Server** (or **Administrator**) in the target server. Using the logged-in user's OAuth bearer token for `/guilds/:guild_id/auto-moderation/rules` can return `401 Unauthorized`, so the dashboard intentionally does not use that token for AutoMod.
