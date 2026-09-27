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


const VIEW_CHANNEL = 0x400n;
const SEND_MESSAGES = 0x800n;
const BOT_ADMINISTRATOR = 0x8n;

async function discordFetch(pathname, options = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: options.auth || `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.message || ''; } catch {}
    const err = new Error(`Discord API ${pathname} failed: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

async function fetchGuildChannel(channelId) {
  return discordFetch(`/channels/${channelId}`);
}

let botUserIdPromise = null;

/** Get the bot account's real user id once per serverless invocation. */
async function fetchBotUser() {
  if (!botUserIdPromise) {
    botUserIdPromise = discordFetch('/users/@me');
  }
  return botUserIdPromise;
}

/**
 * Discord's guild-member endpoint expects an actual USER_ID.
 * `/members/@me` is not a valid way to address the bot here and returns
 * HTTP 400 Invalid Form Body. Resolve the bot id first, then fetch its
 * member object in the target guild.
 */
async function fetchBotMember(guildId) {
  const botUser = await fetchBotUser();
  return discordFetch(`/guilds/${guildId}/members/${botUser.id}`);
}

async function fetchGuildRoles(guildId) {
  return discordFetch(`/guilds/${guildId}/roles`);
}

/**
 * Resolve View Channel / Send Messages for the bot against one channel.
 * This follows Discord's documented guild + channel-overwrite permission
 * resolution, including Administrator bypass and member-specific overwrites.
 */
async function getBotChannelPermissions(guildId, channel) {
  const [member, roles] = await Promise.all([fetchBotMember(guildId), fetchGuildRoles(guildId)]);
  const roleMap = new Map(roles.map((r) => [r.id, r]));
  const everyone = roleMap.get(guildId);
  let permissions = BigInt(everyone?.permissions || '0');

  for (const roleId of member.roles || []) {
    const role = roleMap.get(roleId);
    if (role) permissions |= BigInt(role.permissions || '0');
  }

  if ((permissions & BOT_ADMINISTRATOR) === ADMINISTRATOR) {
    return { viewChannel: true, sendMessages: true, administrator: true };
  }

  const overwrites = Array.isArray(channel.permission_overwrites) ? channel.permission_overwrites : [];
  const everyoneOverwrite = overwrites.find((o) => o.id === guildId);
  if (everyoneOverwrite) {
    permissions &= ~BigInt(everyoneOverwrite.deny || '0');
    permissions |= BigInt(everyoneOverwrite.allow || '0');
  }

  let roleAllow = 0n;
  let roleDeny = 0n;
  const memberRoleIds = new Set(member.roles || []);
  for (const overwrite of overwrites) {
    if (overwrite.type !== 0 || overwrite.id === guildId || !memberRoleIds.has(overwrite.id)) continue;
    roleAllow |= BigInt(overwrite.allow || '0');
    roleDeny |= BigInt(overwrite.deny || '0');
  }
  permissions &= ~roleDeny;
  permissions |= roleAllow;

  const memberOverwrite = overwrites.find((o) => o.type === 1 && o.id === member.user?.id);
  if (memberOverwrite) {
    permissions &= ~BigInt(memberOverwrite.deny || '0');
    permissions |= BigInt(memberOverwrite.allow || '0');
  }

  return {
    viewChannel: (permissions & VIEW_CHANNEL) === VIEW_CHANNEL,
    sendMessages: (permissions & SEND_MESSAGES) === SEND_MESSAGES,
    administrator: false,
  };
}

async function getGameRoomHealth(guildId, settings) {
  const configuredId = settings?.room?.channelId || null;
  const roomName = settings?.room?.name || 'crossgames';
  let channel = null;
  let source = 'missing';

  if (configuredId) {
    try {
      channel = await fetchGuildChannel(configuredId);
      if (channel?.guild_id !== guildId || channel.type !== 0) channel = null;
      else source = 'configured';
    } catch (err) {
      if (err.status !== 404) throw err;
    }
  }

  // The bot itself can recover by name, exactly like ensureRoom() does.
  if (!channel) {
    const channels = await fetchGuildChannels(guildId);
    channel = channels.find((c) => c.type === 0 && c.name === roomName) || null;
    if (channel) source = 'name';
  }

  if (!channel) {
    return {
      status: 'missing',
      channelId: configuredId,
      channelName: roomName,
      viewChannel: false,
      sendMessages: false,
      source,
      message: 'The configured game room does not exist.',
    };
  }

  const perms = await getBotChannelPermissions(guildId, channel);
  const healthy = perms.viewChannel && perms.sendMessages;
  return {
    status: healthy ? 'healthy' : 'permissions',
    channelId: channel.id,
    channelName: channel.name,
    viewChannel: perms.viewChannel,
    sendMessages: perms.sendMessages,
    administrator: perms.administrator,
    source,
    message: healthy
      ? 'The game room exists and the bot can view and send messages.'
      : 'The game room exists, but the bot is missing View Channel and/or Send Messages.',
  };
}

async function fetchGuildAutoModStatus(guildId) {
  // IMPORTANT: AutoMod rules are read through the bot/app authorization here.
  // A normal Discord OAuth2 user access token is not a replacement for the
  // bot token on this endpoint and can return HTTP 401 Unauthorized.
  // The bot must have Manage Server (or Administrator) in the guild.
  const rules = await discordFetch(`/guilds/${guildId}/auto-moderation/rules`);
  const customWords = rules.some(
    (rule) =>
      rule.enabled === true &&
      rule.trigger_type === 1 &&
      Array.isArray(rule.actions) &&
      rule.actions.some((action) => action.type === 1)
  );
  return {
    enabled: customWords,
    ruleCount: rules.filter((rule) => rule.enabled === true && rule.trigger_type === 1).length,
  };
}

async function createGameRoom(guildId, name = 'crossgames') {
  const channel = await discordFetch(`/guilds/${guildId}/channels`, {
    method: 'POST',
    body: JSON.stringify({
      name: name || 'crossgames',
      type: 0,
      reason: 'Crossover dashboard — recreate game room',
    }),
  });
  return channel;
}

async function fetchGuildChannels(guildId) {
  const channels = await discordFetch(`/guilds/${guildId}/channels`);
  return channels.filter((c) => c.type === 0);
}

async function deleteGuildSetting(mapKey, guildId, fallback) {
  // Kept here as a semantic helper for API callers; actual persistence lives
  // in lib/redis.js so all settings use the same remote store.
  return { mapKey, guildId, fallback };
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
  fetchGuildChannel,
  fetchBotMember,
  fetchGuildRoles,
  getBotChannelPermissions,
  getGameRoomHealth,
  fetchGuildAutoModStatus,
  createGameRoom,
  fetchGuildChannels,
  guildIconUrl,
};
