// Every call here is a plain REST request (with either the user's OAuth
// token or the bot's own token) — nothing here needs a live gateway
// connection, which is exactly why this can run as short-lived serverless
// functions on Vercel instead of a long-running process.

const API = 'https://discord.com/api/v10';

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

function redirectUri() {
  return `${process.env.DASHBOARD_BASE_URL.replace(/\/+$/, '')}/api/auth/callback`;
}

function getOAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
  });
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Discord token exchange failed: HTTP ${res.status}`);
  return res.json(); // { access_token, refresh_token, expires_in, ... }
}

async function fetchCurrentUser(accessToken) {
  const res = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord /users/@me failed: HTTP ${res.status}`);
  return res.json();
}

/** Guilds the LOGGED-IN USER belongs to (their OAuth token). */
async function fetchUserGuilds(accessToken) {
  const res = await fetch(`${API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord /users/@me/guilds (user) failed: HTTP ${res.status}`);
  return res.json();
}

/**
 * Guilds the BOT itself is in (bot token). Discord paginates this at 200 per
 * page; fine for a single-bot dashboard unless the bot is in 200+ servers.
 */
async function fetchBotGuilds() {
  const res = await fetch(`${API}/users/@me/guilds?limit=200`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Discord /users/@me/guilds (bot) failed: HTTP ${res.status}`);
  return res.json();
}

function canManageGuild(permissionsString) {
  try {
    const bits = BigInt(permissionsString);
    return (bits & ADMINISTRATOR) === ADMINISTRATOR || (bits & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}

/**
 * Guilds that BOTH the user can manage AND the bot is in — the exact set
 * this dashboard is allowed to show/edit settings for.
 */
async function fetchManageableMutualGuilds(accessToken) {
  const [userGuilds, botGuilds] = await Promise.all([fetchUserGuilds(accessToken), fetchBotGuilds()]);
  const botGuildIds = new Set(botGuilds.map((g) => g.id));
  return userGuilds.filter((g) => botGuildIds.has(g.id) && canManageGuild(g.permissions));
}

/** Confirms the user still has manage-permission on ONE specific guild (re-checked server-side before every write). */
async function userCanManageGuild(accessToken, guildId) {
  const userGuilds = await fetchUserGuilds(accessToken);
  const guild = userGuilds.find((g) => g.id === guildId);
  return Boolean(guild && canManageGuild(guild.permissions));
}

/** All text channels in a guild, via the bot's own token (needed for the "pick the game room" dropdown). */
async function fetchGuildTextChannels(guildId) {
  const res = await fetch(`${API}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Discord guild channels failed: HTTP ${res.status}`);
  const channels = await res.json();
  return channels.filter((c) => c.type === 0); // 0 = GUILD_TEXT
}

/** Renames an existing channel (bot token) — equivalent to the bot's own !chname. */
async function renameChannel(channelId, newName) {
  const res = await fetch(`${API}/channels/${channelId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok) throw new Error(`Discord channel rename failed: HTTP ${res.status}`);
  return res.json();
}

function guildIconUrl(guild) {
  if (!guild.icon) return null;
  const ext = guild.icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=64`;
}

module.exports = {
  getOAuthUrl,
  exchangeCodeForToken,
  fetchCurrentUser,
  fetchUserGuilds,
  fetchBotGuilds,
  fetchManageableMutualGuilds,
  userCanManageGuild,
  fetchGuildTextChannels,
  renameChannel,
  guildIconUrl,
};
