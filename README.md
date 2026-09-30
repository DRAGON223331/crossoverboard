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

## 💎 Premium tab (per server)

Every server page has a **Premium** tab (`/servers/<id>/premium`). It reads the
same Redis keys as the bot (`crossover:premium`, `crossover:game-themes`):

- **No active Premium** → the tab is visible but locked (blurred preview + 🔒).
  Premium can only be granted/extended by the bot owner (`!premium add …`);
  the dashboard never grants it.
- **Active Premium** → edit allowed members, Mafia / Musical Chairs player
  limits and game colors. Members + limits: server owner (or bot owner) only,
  same rule as `!premium`. Colors: also anyone on the Premium member list,
  same rule as `!gametheme`. Other admins get a read-only view.

**Bot side:** `handlers/premium.js` and `handlers/gameTheme.js` now poll Redis
every 10 s (like prefix/language do), so dashboard edits reach the running bot
without a restart. Deploy the updated bot too, or the bot will only see the
changes after its next restart.

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


## Add Crossover invite permissions

The dashboard's **Add Crossover** button uses the exact same permission bitfield as the bot's own `!invite` command:

`327222946833`

That covers the permissions declared in `handlers/invite.js` (game play, cross-server chat, server setup, and notification roles). The dashboard does not fall back to a different permission value.

## Discord permissions required

The dashboard uses two different identities:

- **Logged-in user OAuth token:** used for checking that the user can manage the guild and for reading AutoMod rules. The user must have **Manage Server** or **Administrator**. Discord documents AutoMod access as requiring Manage Server/Administrator.
- **Bot token:** used to inspect the bot's member roles, channel permissions, list channels, rename/create the game room, and perform bot-side operations.

The game-room health check resolves the bot's actual user ID through `/users/@me` before requesting `/guilds/{guildId}/members/{botUserId}`. It does not use `/members/@me`, which Discord rejects for this endpoint.


### AutoMod permissions
The dashboard reads Discord AutoMod rules using the dashboard bot token. The bot must have **Manage Server** (or **Administrator**) in the target server. Using the logged-in user's OAuth bearer token for `/guilds/:guild_id/auto-moderation/rules` can return `401 Unauthorized`, so the dashboard intentionally does not use that token for AutoMod.


## Chat (`/chat`)

Real-time chat between mutual friends, inside the dashboard. It reuses the
bot's friend list and block list, so only people who are friends in
Crossover can talk, and blocking/unfriending closes the chat.

- **No new setup** — same Upstash Redis, same env vars. Data lives under
  `crossover:chat:*` keys and never touches the bot's JSON blobs.
- **Saved history** — last 300 messages per conversation, so an offline
  friend sees everything when they come back (the bot's `!chat` relay loses
  messages if the other side is away).
- **Display name + avatar**: read from Discord with the bot token (`lib/profiles.js`) and cached in Redis for 6 hours, so it costs one lookup per person per 6h. Falls back to the stored username and Discord's default avatar if Discord can't be reached.
- **Presence, unread badges, typing indicator, "Seen" receipts**, optimistic
  sending with retry, day separators, Arabic/RTL support, mobile layout.
- **Anti-flood**: 12 messages per 10 seconds per user; 1000 characters max.
- **How "live" works**: Vercel functions can't hold WebSockets, so the page
  polls (every 2s for the open conversation, 6s for the friends list, 15s
  for the nav badge) and pauses while the tab is hidden. Each poll is 1–2
  Redis round trips (Upstash `/pipeline`).
- The friends page now has a 💬 button that opens `/chat?with=<friendId>`.

The bot's own `!chat` / `!end` DM relay is untouched and keeps working.

Files: `lib/chat.js`, `pages/api/chat/[action].js`, `pages/chat.js`,
`components/ChatBadge.js` (+ small edits in `lib/redis.js`, `lib/i18n.js`,
`components/NavBar.js`, `pages/friends.js`, `styles/globals.css`).

### Chat extras: edit, delete, reply, reactions, notifications

- **Reply** (↩): the message keeps a short quote of the original; clicking the quote scrolls to it.
  If the original is later deleted, the quote says so and its text is removed from storage too.
- **Edit** (✎, own messages): reuses the input box ("Editing message", Esc cancels); shows an "edited" mark.
- **Delete** (🗑️, own messages): removes it for both people. A tombstone stays so replies and ids remain valid,
  and it stops counting as unread for a friend who never opened it.
- **Reactions**: 👍 ❤️ 😂 😮 😢 🔥 (list in `lib/chatShared.js`, checked on the server). Same emoji again removes it.
  On a mouse the action bar appears on hover; on touch, tap the message.
- **How old messages stay in sync**: every edit / delete / reaction bumps `crossover:chat:rev:<conv>`.
  A poll whose `rev` is out of date gets the whole latest page again; unchanged polls stay as cheap as before.
  Each message is updated with an atomic compare-and-swap (`EVAL` + `LPOS` + `LSET`), so two people reacting at
  the same moment cannot overwrite each other. This needs `EVAL` on your Upstash database (available on all plans).
- **Discord DM when you are away**: if a message arrives and the receiver has not been on the dashboard for ~45 s,
  the bot (same `DISCORD_BOT_TOKEN`, no change to the bot itself) sends one DM with a link to the chat.
  At most one DM per conversation per 10 minutes (`DM_COOLDOWN` in `lib/chat.js`). The DM never contains the message
  text. It is skipped silently if the person has DMs closed or shares no server with the bot.
- **Tab title + sound**: `(3) Crossover` while there are unread messages, updated even from a background tab
  (`components/ChatNotifier.js`, one poller shared with the nav badge). The 🔔 button above the friends list turns on a
  soft two-note ping when the unread total increases; it is off by default and remembered in the browser.
