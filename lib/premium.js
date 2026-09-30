// Server-side helpers for the per-server Premium panel.
//
// Reads and writes the SAME Redis keys and shapes as the bot:
//   crossover:premium      → handlers/premium.js      { users, guilds: { id: { until, members, gameLimits, ... } } }
//   crossover:game-themes  → handlers/gameTheme.js    { guildId: { all, mafia, chairs } }
// The bot re-reads both every 10 seconds, so edits made here reach it live.
//
// This dashboard can NEVER grant or extend Premium — that stays a bot-owner
// action (`!premium add ...`). It only edits the settings of a server that
// already has active Premium.

const { remoteGetJSON, remoteSetJSON } = require('./redis');

const PREMIUM_KEY = 'crossover:premium';
const THEMES_KEY = 'crossover:game-themes';

// Mirrors THEMES in the bot's handlers/gameTheme.js.
const THEMES = {
  default: { name: 'Default', color: '#5865F2' },
  gold: { name: 'Gold', color: '#F1C40F' },
  emerald: { name: 'Emerald', color: '#2ECC71' },
  purple: { name: 'Purple', color: '#9B59B6' },
  galaxy: { name: 'Galaxy', color: '#5B4BDB' },
  crimson: { name: 'Crimson', color: '#E74C3C' },
};
const THEME_SCOPES = ['all', 'mafia', 'chairs'];

// Same ranges the bot's `!premium players` command enforces.
const LIMITS = {
  mafia: { min: 4, max: 100, def: 20 },
  chairs: { min: 3, max: 100, def: 20 },
};
const MAX_MEMBERS = 100;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isActive(entry) {
  return Boolean(entry) && (!entry.until || entry.until > Date.now());
}

async function readPremiumStore() {
  const raw = await remoteGetJSON(PREMIUM_KEY, {});
  return {
    ...raw,
    users: isPlainObject(raw.users) ? raw.users : {},
    guilds: isPlainObject(raw.guilds) ? raw.guilds : {},
  };
}

// Same clamp as the bot's getGuildGameLimit().
function limitFor(entry, game) {
  const value = Number(entry?.gameLimits?.[game]);
  if (!Number.isInteger(value)) return LIMITS[game].def;
  return Math.min(100, Math.max(1, value));
}

/**
 * What the logged-in user may do here.
 *
 * The Premium settings on the site are ONLY for people the server owner
 * chose from the bot (`!premium add @user`), plus the server owner and the bot
 * owner. Having "Manage Server" in Discord gives NO access on its own.
 *
 *  - open:    may open the Premium tab at all (owner, bot owner, or a member on the list).
 *  - themes:  may change game colors — same rule as `!gametheme`.
 *  - limits:  may change Mafia / Musical Chairs player limits — owner only, same rule as `!premium players`.
 *  - members: always false. The allowed-members list is managed ONLY from the bot
 *             (`!premium add / remove`); the site shows it read-only.
 */
function getViewerAccess(entry, viewer) {
  if (!isActive(entry)) return { open: false, members: false, limits: false, themes: false };
  const elevated = Boolean(viewer.isServerOwner || viewer.isBotOwner);
  const isMember = Boolean(viewer.inGuild !== false && entry.members?.[viewer.userId]);
  const open = elevated || isMember;
  return { open, members: false, limits: elevated, themes: open };
}

/**
 * Can this person see the Premium tab? Server owner and bot owner always can
 * (they also see the locked preview when the server has no Premium); everyone
 * else only if the server's Premium is active AND the owner added them.
 */
function canOpenPremiumTab(entry, viewer) {
  if (viewer.isServerOwner || viewer.isBotOwner) return true;
  return getViewerAccess(entry, viewer).open;
}

/** Everything the Premium page renders. Serializable (goes straight into page props). */
async function getPremiumOverview(guildId, viewer) {
  const [store, themesStore] = await Promise.all([readPremiumStore(), remoteGetJSON(THEMES_KEY, {})]);
  const entry = store.guilds[guildId] || null;
  const status = !entry ? 'none' : isActive(entry) ? 'active' : 'expired';

  const base = {
    status,
    until: entry?.until || null,
    presets: THEMES,
    ranges: LIMITS,
  };

  // Locked: show the defaults as a preview, but never any of this server's stored data.
  if (status !== 'active') {
    return {
      ...base,
      members: [],
      limits: { mafia: LIMITS.mafia.def, chairs: LIMITS.chairs.def },
      themes: { all: null, mafia: null, chairs: null },
      access: { open: false, members: false, limits: false, themes: false },
    };
  }

  const members = Object.entries(isPlainObject(entry.members) ? entry.members : {})
    .map(([id, m]) => ({ id, tag: m?.tag || null, at: m?.at || 0 }))
    .sort((a, b) => b.at - a.at);

  const saved = isPlainObject(themesStore[guildId]) ? themesStore[guildId] : {};
  const themes = {};
  for (const scope of THEME_SCOPES) themes[scope] = typeof saved[scope] === 'string' ? saved[scope] : null;

  return {
    ...base,
    members,
    limits: { mafia: limitFor(entry, 'mafia'), chairs: limitFor(entry, 'chairs') },
    themes,
    access: getViewerAccess(entry, viewer),
  };
}

async function getGuildEntry(guildId) {
  const store = await readPremiumStore();
  return store.guilds[guildId] || null;
}

/** Read-modify-write of one guild's premium entry. Refuses if the server has no ACTIVE premium. */
async function mutateGuildEntry(guildId, mutate) {
  const store = await readPremiumStore();
  const entry = store.guilds[guildId];
  if (!isActive(entry)) throw httpError(403, 'Server Premium is not active for this server.');
  if (!isPlainObject(entry.members)) entry.members = {};
  if (!isPlainObject(entry.gameLimits)) entry.gameLimits = {};
  mutate(entry);
  await remoteSetJSON(PREMIUM_KEY, store);
}

async function addMember(guildId, userId, tag) {
  await mutateGuildEntry(guildId, (entry) => {
    if (!entry.members[userId] && Object.keys(entry.members).length >= MAX_MEMBERS) {
      throw httpError(400, `You can add at most ${MAX_MEMBERS} members.`);
    }
    entry.members[userId] = { tag: tag || null, at: entry.members[userId]?.at || Date.now() };
  });
}

async function removeMember(guildId, userId) {
  let removed = false;
  await mutateGuildEntry(guildId, (entry) => {
    if (entry.members[userId]) {
      delete entry.members[userId];
      removed = true;
    }
  });
  return removed;
}

async function setLimits(guildId, input) {
  const next = {};
  for (const game of Object.keys(LIMITS)) {
    if (input?.[game] === undefined) continue;
    const value = Number(input[game]);
    const { min, max } = LIMITS[game];
    if (!Number.isInteger(value) || value < min || value > max) {
      throw httpError(400, `Player limit for ${game === 'mafia' ? 'Mafia' : 'Musical Chairs'} must be a whole number from ${min} to ${max}.`);
    }
    next[game] = value;
  }
  await mutateGuildEntry(guildId, (entry) => {
    Object.assign(entry.gameLimits, next);
  });
}

// Preset key, or "#RRGGBB" — exactly what the bot's setTheme() stores. null/'' clears it.
function normalizeTheme(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (THEMES[text.toLowerCase()]) return text.toLowerCase();
  const hex = text.replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toUpperCase()}`;
  throw httpError(400, 'Pick a preset or a 6-digit HEX color such as #00FF88.');
}

async function setThemes(guildId, input) {
  const current = await remoteGetJSON(THEMES_KEY, {});
  const all = isPlainObject(current) ? current : {};
  const mine = isPlainObject(all[guildId]) ? { ...all[guildId] } : {};

  for (const scope of THEME_SCOPES) {
    if (input?.[scope] === undefined) continue;
    const value = normalizeTheme(input[scope]);
    if (value === null) delete mine[scope];
    else mine[scope] = value;
  }

  if (Object.keys(mine).length) all[guildId] = mine;
  else delete all[guildId];
  await remoteSetJSON(THEMES_KEY, all);
}

module.exports = {
  THEMES,
  LIMITS,
  isActive,
  getViewerAccess,
  canOpenPremiumTab,
  getPremiumOverview,
  getGuildEntry,
  addMember,
  removeMember,
  setLimits,
  setThemes,
};
