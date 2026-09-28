// Tiny helper around Upstash Redis' REST API — deliberately a near-exact
// copy of the bot's own handlers/remoteStore.js, using the SAME REMOTE_KEY
// names and value shapes, so this dashboard and the bot (running elsewhere,
// e.g. on Pella) read and write the exact same settings.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const configured = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

async function remoteGet(key) {
  if (!configured) throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set.');
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Upstash GET ${key} failed: HTTP ${res.status}`);
  const data = await res.json();
  return typeof data.result === 'string' ? data.result : null;
}

async function remoteSetJSON(key, value) {
  if (!configured) throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set.');
  const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`Upstash SET ${key} failed: HTTP ${res.status}`);
  return true;
}


/**
 * Runs several raw Redis commands in ONE round trip (Upstash REST /pipeline).
 * Used by lib/chat.js — chat keeps real Redis lists/hashes instead of one big
 * JSON blob, so sending a message never rewrites the whole friend list.
 * Returns the array of results in the same order as `commands`.
 */
async function remotePipeline(commands) {
  if (!configured) throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set.');
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash pipeline failed: HTTP ${res.status}`);
  const data = await res.json();
  return data.map((entry) => {
    if (entry && entry.error) throw new Error(`Upstash: ${entry.error}`);
    return entry?.result;
  });
}

async function remoteGetJSON(key, fallback = {}) {
  const raw = await remoteGet(key);
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// Exact same keys the bot uses — see handlers/prefix.js, handlers/gameRoom.js,
// handlers/language.js, handlers/onlineMode.js, handlers/stats.js,
// handlers/scores.js in the bot's own repo.
const KEYS = {
  prefixes: 'crossover:prefixes', // { guildId: "!" }
  roomNames: 'crossover:roomNames', // { guildId: { channelId, name } }
  languages: 'crossover:languages', // { guildId: "en" | "ar" }
  onlineMode: 'crossover:onlineMode', // { guildId: true | false }
  stats: 'crossover:stats', // { days: { "YYYY-MM-DD": { total, games, guilds } }, guildNames }
  scores: 'crossover:scores', // { users: { userId: { name, points, w, l, d, guilds, ... } } }
  blocklist: 'crossover:blocklist', // { blockerId: { blockedId: { username, at } } }
  playersVisibility: 'crossover:playersVisibility', // { userId: bool, points: bool, ... } — see PLAYERS_VISIBILITY_DEFAULTS
  friendlist: 'crossover:friendlist', // { userId: { friendId: { username, at } } } — see handlers/friendlist.js
};

/** Reads every stored setting for one guild, applying the bot's own defaults. */
async function getGuildSettings(guildId) {
  const [prefixes, roomNames, languages, onlineMode] = await Promise.all([
    remoteGetJSON(KEYS.prefixes, {}),
    remoteGetJSON(KEYS.roomNames, {}),
    remoteGetJSON(KEYS.languages, {}),
    remoteGetJSON(KEYS.onlineMode, {}),
  ]);
  return {
    prefix: prefixes[guildId] || '!',
    room: roomNames[guildId] || { channelId: null, name: 'crossgames' },
    language: languages[guildId] === 'ar' ? 'ar' : 'en',
    onlineEnabled: onlineMode[guildId] !== false,
  };
}

/** Read-modify-write a single guild's entry inside one of the 4 maps above. */
async function setGuildValue(mapKey, guildId, value) {
  const map = await remoteGetJSON(mapKey, {});
  map[guildId] = value;
  await remoteSetJSON(mapKey, map);
}

async function resetGuildValue(mapKey, guildId) {
  const map = await remoteGetJSON(mapKey, {});
  delete map[guildId];
  await remoteSetJSON(mapKey, map);
}

// ── Stats (mirrors handlers/stats.js' day-bucketed counters) ────────────────
// Same default timezone the bot uses for "today" (handlers/stats.js,
// STATS_TIMEZONE). If the bot's host overrides that env var, "today" here
// can be up to a few hours off from the bot's own — cosmetic only.
const STATS_TIMEZONE = process.env.STATS_TIMEZONE || 'Africa/Cairo';

function dayKey(date) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: STATS_TIMEZONE }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function recentDayKeys(count) {
  const keys = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(now - i * 24 * 60 * 60 * 1000)));
  }
  return keys;
}

/**
 * Per-guild slice of the bot's global usage counters: games this server took
 * part in today and over the last 7 days. Note the bot only tracks "games
 * per day per game-kind" and "games per day per guild" separately — it never
 * crosses the two — so a per-guild "most played game" breakdown isn't
 * available here, only totals.
 */
async function getGuildStats(guildId) {
  const data = await remoteGetJSON(KEYS.stats, null);
  const days = data?.days && typeof data.days === 'object' ? data.days : {};

  const [todayKey] = recentDayKeys(1);
  const weekKeys = recentDayKeys(7);

  const today = days[todayKey]?.guilds?.[guildId] ?? 0;
  const last7Days = weekKeys.reduce((sum, key) => sum + (days[key]?.guilds?.[guildId] ?? 0), 0);

  return { today, last7Days };
}

// ── Leaderboard (mirrors handlers/scores.js' leaderboard()) ────────────────
/** Top players for one guild's board, by points earned while playing there. */
async function getGuildLeaderboard(guildId, limit = 10) {
  const data = await remoteGetJSON(KEYS.scores, null);
  const users = data?.users && typeof data.users === 'object' ? data.users : {};

  const rows = Object.entries(users)
    .map(([userId, record]) => ({
      userId,
      name: record?.name || 'Unknown',
      points: record?.guilds?.[guildId] ?? 0,
      w: record?.w ?? 0,
      l: record?.l ?? 0,
    }))
    .filter((row) => row.points > 0)
    .sort((a, b) => b.points - a.points || b.w - a.w);

  return { rows: rows.slice(0, limit), total: rows.length };
}

// ── Blocklist (mirrors handlers/blocklist.js) ───────────────────────────────
// This is PERSONAL, player-to-player data — not scoped to any server (a
// block applies across every server the two players are both in). It has no
// guildId dimension at all, so unlike everything above it can't be shown on
// a per-server settings page without leaking one player's private choice
// (and the other player's username) to an admin of some unrelated server.
// Callers must gate this behind an owner-only check — see pages/owner/.
/**
 * Flattens the whole store into one read-only list, newest first:
 * [{ blockerId, blockedId, blockedUsername, at }]. The blocker's username
 * isn't stored anywhere in this data (only the blocked user's, captured at
 * block time), so only their ID is available here.
 */
async function getAllBlocks(limit = 500) {
  const data = await remoteGetJSON(KEYS.blocklist, {});
  const rows = [];
  for (const [blockerId, blocked] of Object.entries(data || {})) {
    if (!blocked || typeof blocked !== 'object') continue;
    for (const [blockedId, entry] of Object.entries(blocked)) {
      rows.push({
        blockerId,
        blockedId,
        blockedUsername: entry?.username || null,
        at: entry?.at || 0,
      });
    }
  }
  rows.sort((a, b) => b.at - a.at);
  return { rows: rows.slice(0, limit), total: rows.length };
}

// ── Player profile (mirrors handlers/scores.js + levels.js) ────────────────
const PROFILE_GAME_KEYS = ['xo', 'connect4', 'memory', 'rps', 'fast', 'flag', 'trivia', 'word', 'math', 'mafia', 'chairs'];
const PROFILE_GAME_LABELS = {
  xo: 'Tic Tac Toe',
  connect4: 'Connect 4',
  memory: 'Memory Match',
  rps: 'Rock Paper Scissors',
  fast: 'Fastest Click',
  flag: 'Guess the Flag',
  trivia: 'Trivia',
  word: 'Guess the Word',
  math: 'Math Race',
  mafia: 'Mafia',
  chairs: 'Musical Chairs',
};
const PROFILE_GAME_ICONS = {
  xo: '⭕❌',
  connect4: '🔴🟡',
  memory: '🃏',
  rps: '🪨📄✂️',
  fast: '⚡',
  flag: '🌍',
  trivia: '🧠',
  word: '🔤',
  math: '🧮',
  mafia: '🕵️',
  chairs: '🪑',
};
const PROFILE_MAX_LEVEL = 100;
const PROFILE_POINTS_PER_LEVEL = 100;

function profileLevel(record) {
  const lifetime = Math.max(0, Number(record?.points ?? 0) + Number(record?.spent ?? 0));
  return Math.min(PROFILE_MAX_LEVEL, Math.floor(lifetime / PROFILE_POINTS_PER_LEVEL) + 1);
}

function normalizeProfileRecord(record) {
  const games = record?.games && typeof record.games === 'object' ? record.games : {};
  const achievements = Array.isArray(record?.achievements) ? record.achievements : [];
  return {
    points: Number(record?.points ?? 0),
    spent: Number(record?.spent ?? 0),
    w: Number(record?.w ?? 0),
    l: Number(record?.l ?? 0),
    d: Number(record?.d ?? 0),
    streak: Number(record?.streak ?? 0),
    best: Number(record?.best ?? 0),
    achievements,
    games,
    name: record?.name || 'Unknown',
    level: profileLevel(record),
    engines: PROFILE_GAME_KEYS.map((key) => {
      const g = games[key] || {};
      const played = Number(g.w ?? 0) + Number(g.l ?? 0) + Number(g.d ?? 0);
      return {
        key,
        label: PROFILE_GAME_LABELS[key],
        icon: PROFILE_GAME_ICONS[key],
        played,
        wins: Number(g.w ?? 0),
        losses: Number(g.l ?? 0),
        draws: Number(g.d ?? 0),
        completed: played > 0,
      };
    }),
  };
}

async function getUserProfile(userId) {
  const data = await remoteGetJSON(KEYS.scores, null);
  const record = data?.users?.[userId];
  return record ? normalizeProfileRecord(record) : null;
}

// ── Players directory (public list of everyone who has ever played) ────────
// Unlike a single profile lookup, this touches every record in KEYS.scores,
// which can be a large blob. It's read far more often than it changes (every
// /players page load, every search keystroke, every "load more" click), so
// the parsed-and-sorted result is cached in-process for a few seconds —
// the same trade-off fetchBotGuilds() makes in lib/discord.js. Worst case a
// brand-new player is a few seconds late showing up here; the bot's own
// stores are still the source of truth.
const PLAYERS_LIST_TTL = 15_000;
let playersListCache = { value: null, expiresAt: 0 };

function buildPlayerRow(userId, record) {
  const wins = Number(record?.w ?? 0);
  const losses = Number(record?.l ?? 0);
  const draws = Number(record?.d ?? 0);
  const totalGames = wins + losses + draws;
  return {
    userId,
    name: record?.name || 'Unknown',
    level: profileLevel(record),
    points: Number(record?.points ?? 0),
    wins,
    losses,
    draws,
    totalGames,
    winRate: totalGames ? Math.round((wins / totalGames) * 100) : 0,
    streak: Number(record?.streak ?? 0),
    best: Number(record?.best ?? 0),
    achievementCount: Array.isArray(record?.achievements) ? record.achievements.length : 0,
  };
}

async function buildPlayersList() {
  const data = await remoteGetJSON(KEYS.scores, null);
  const users = data?.users && typeof data.users === 'object' ? data.users : {};
  const rows = Object.entries(users).map(([userId, record]) => buildPlayerRow(userId, record));
  // Same ranking as the leaderboard: points first, then wins, as a tiebreak.
  rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
  return rows;
}

async function getCachedPlayersList() {
  const now = Date.now();
  if (playersListCache.value && playersListCache.expiresAt > now) return playersListCache.value;
  const rows = await buildPlayersList();
  playersListCache = { value: rows, expiresAt: now + PLAYERS_LIST_TTL };
  return rows;
}

/**
 * A paginated, optionally name-filtered slice of every player who has ever
 * recorded a score — what the /players page and its "load more"/search
 * calls read from. Pagination happens in memory (see getCachedPlayersList)
 * since Upstash returns the whole scores blob in one GET regardless of how
 * much of it the caller actually wants; the cache is what keeps repeated
 * calls (first paint, then every subsequent page/search) cheap.
 */
async function getPlayersDirectory({ limit = 30, offset = 0, q = '' } = {}) {
  const all = await getCachedPlayersList();
  const query = String(q || '').trim().toLowerCase();
  const filtered = query ? all.filter((row) => row.name.toLowerCase().includes(query)) : all;
  return {
    rows: filtered.slice(offset, offset + limit),
    total: filtered.length,
    grandTotal: all.length,
  };
}

// ── Players directory visibility (owner-configurable, applies to everyone) ─
// Level and the display name are intentionally NOT in here — the dashboard
// always shows both, on every player card, no matter what. Everything below
// is optional and defaults to shown except the raw Discord ID, which is the
// one genuinely identifying field.
const PLAYERS_VISIBILITY_DEFAULTS = {
  userId: false,
  points: true,
  record: true, // wins / losses / draws
  winRate: true,
  totalGames: true,
  streak: true,
  achievements: true,
};

async function getPlayersVisibility() {
  const stored = await remoteGetJSON(KEYS.playersVisibility, {});
  return { ...PLAYERS_VISIBILITY_DEFAULTS, ...stored };
}

async function setPlayersVisibility(partial) {
  const current = await getPlayersVisibility();
  const next = { ...current };
  for (const key of Object.keys(PLAYERS_VISIBILITY_DEFAULTS)) {
    if (partial && partial[key] !== undefined) next[key] = Boolean(partial[key]);
  }
  await remoteSetJSON(KEYS.playersVisibility, next);
  return next;
}

// ── Store (mirrors handlers/scores.js's inventory helpers + handlers/shop.js's
// purchase rules exactly). Skins and titles both live as plain entries in the
// SAME user record already read above — `record.items` (array of owned item
// ids) and `record.equipped` (a small map, one entry per slot: `xo` for the
// Tic Tac Toe skin, `title` for the title) — not a separate key. See
// lib/storeCatalog.js for where SKINS/TITLES/prices come from.
//
// Not a real transaction (Upstash's REST API doesn't offer one here), so two
// purchases racing in the same instant could in theory both read the same
// starting balance — the bot's own handlers/scores.js has this exact same
// property (module-level `data` mutated in place, no locking), so this
// matches it rather than being a dashboard-specific shortcut.
const { ITEMS, getItem, rollLootBox, LOOT_BOX_COST, PITY_THRESHOLD } = require('./storeCatalog');

function inventoryFromRecord(record) {
  return {
    points: Number(record?.points ?? 0),
    items: Array.isArray(record?.items) ? record.items : [],
    equipped: record?.equipped && typeof record.equipped === 'object' ? record.equipped : {},
    freeBoxes: Number(record?.freeBoxes ?? 0), // free Loot Boxes (7-day daily streak reward)
    lootMisses: Number(record?.lootMisses ?? 0), // duplicates in a row — drives the Loot Box pity
  };
}

async function getUserInventory(userId) {
  const data = await remoteGetJSON(KEYS.scores, { users: {} });
  return inventoryFromRecord(data.users?.[userId]);
}

/** Buys `itemId` for `userId` and equips it immediately — same as picking it from the !store dropdown. */
async function purchaseItem(userId, itemId) {
  const item = getItem(itemId);
  if (!item || item.lootOnly) { const err = new Error('Unknown item.'); err.code = 'UNKNOWN_ITEM'; throw err; }

  const data = await remoteGetJSON(KEYS.scores, { users: {} });
  const users = data.users && typeof data.users === 'object' ? data.users : {};
  const record = users[userId] || {};
  const items = Array.isArray(record.items) ? record.items : [];

  if (items.includes(itemId)) { const err = new Error('Already owned.'); err.code = 'ALREADY_OWNED'; throw err; }
  if (Number(record.points ?? 0) < item.price) { const err = new Error('Not enough points.'); err.code = 'INSUFFICIENT_POINTS'; throw err; }

  const equipped = record.equipped && typeof record.equipped === 'object' ? { ...record.equipped } : {};
  equipped[item.game] = itemId;

  users[userId] = {
    ...record,
    points: Number(record.points ?? 0) - item.price,
    spent: Number(record.spent ?? 0) + item.price,
    items: [...items, itemId],
    equipped,
  };
  data.users = users;
  await remoteSetJSON(KEYS.scores, data);
  return inventoryFromRecord(users[userId]);
}

/**
 * Opens a Loot Box for `userId` — handlers/shop.js's "🎁 Loot Box" button.
 * A free box (earned from a 7-day daily streak) is used first, otherwise
 * LOOT_BOX_COST points are charged. A new item is added AND equipped; a
 * duplicate gives nothing back. After PITY_THRESHOLD duplicates in a row the
 * next box is guaranteed to be new. Paid boxes grow `spent` so the level never
 * drops. Returns { inventory, itemId, duplicate, free }.
 */
async function openLootBox(userId) {
  const data = await remoteGetJSON(KEYS.scores, { users: {} });
  const users = data.users && typeof data.users === 'object' ? data.users : {};
  const record = users[userId] || {};
  const items = Array.isArray(record.items) ? record.items : [];
  const freeBoxes = Number(record.freeBoxes ?? 0);
  const free = freeBoxes > 0;

  if (!free && Number(record.points ?? 0) < LOOT_BOX_COST) { const err = new Error('Not enough points.'); err.code = 'INSUFFICIENT_POINTS'; throw err; }

  const misses = Number(record.lootMisses ?? 0);
  // Nothing left to find → don't take points for a box that can only be a duplicate.
  const ownsEverything = Object.keys(ITEMS).every((id) => items.includes(id));
  const itemId = ownsEverything ? null : rollLootBox(items, misses >= PITY_THRESHOLD);
  if (!itemId) { const err = new Error('You already own everything.'); err.code = 'ALL_OWNED'; throw err; }

  const item = getItem(itemId);
  const duplicate = items.includes(itemId);
  const equipped = record.equipped && typeof record.equipped === 'object' ? { ...record.equipped } : {};
  if (!duplicate) equipped[item.game] = itemId;

  users[userId] = {
    ...record,
    points: free ? Number(record.points ?? 0) : Number(record.points ?? 0) - LOOT_BOX_COST,
    spent: free ? Number(record.spent ?? 0) : Number(record.spent ?? 0) + LOOT_BOX_COST,
    freeBoxes: free ? freeBoxes - 1 : freeBoxes,
    lootMisses: duplicate ? misses + 1 : 0,
    items: duplicate ? items : [...items, itemId],
    equipped,
  };
  data.users = users;
  await remoteSetJSON(KEYS.scores, data);
  return { inventory: inventoryFromRecord(users[userId]), itemId, duplicate, free };
}

/** Equips an item the user already owns (or clears a slot with itemId `null`) — the !usettings dropdowns. */
async function equipItem(userId, slot, itemId) {
  const data = await remoteGetJSON(KEYS.scores, { users: {} });
  const users = data.users && typeof data.users === 'object' ? data.users : {};
  const record = users[userId] || {};
  const items = Array.isArray(record.items) ? record.items : [];

  if (itemId !== null) {
    const item = getItem(itemId);
    if (!item) { const err = new Error('Unknown item.'); err.code = 'UNKNOWN_ITEM'; throw err; }
    if (item.game !== slot) { const err = new Error('Wrong slot for this item.'); err.code = 'WRONG_SLOT'; throw err; }
    if (!items.includes(itemId)) { const err = new Error("You don't own that."); err.code = 'NOT_OWNED'; throw err; }
  }

  const equipped = record.equipped && typeof record.equipped === 'object' ? { ...record.equipped } : {};
  if (itemId === null) delete equipped[slot];
  else equipped[slot] = itemId;

  users[userId] = { ...record, equipped };
  data.users = users;
  await remoteSetJSON(KEYS.scores, data);
  return inventoryFromRecord(users[userId]);
}

/** Mutual friends only — mirrors handlers/friendlist.js's areFriends()/listFriends(). */
async function getFriendIds(userId) {
  const all = await remoteGetJSON(KEYS.friendlist, {});
  const list = all[userId];
  return list && typeof list === 'object' ? Object.keys(list) : [];
}

/** Same data as getFriendIds, but with the stored username for display — mirrors listFriends() in handlers/friendlist.js. */
async function getFriends(userId) {
  const all = await remoteGetJSON(KEYS.friendlist, {});
  const list = all[userId];
  if (!list || typeof list !== 'object') return [];
  return Object.entries(list)
    .map(([id, entry]) => ({ id, username: entry?.username ?? null, at: entry?.at ?? 0 }))
    .sort((a, b) => b.at - a.at);
}

/** Block-list check shared by addFriend — stops a friend request between two users who have blocked each other, same gate the bot's own social commands respect. */
async function areBlocked(userIdA, userIdB) {
  const data = await remoteGetJSON(KEYS.blocklist, {});
  const blockedByA = data[userIdA] && typeof data[userIdA] === 'object' ? data[userIdA] : {};
  const blockedByB = data[userIdB] && typeof data[userIdB] === 'object' ? data[userIdB] : {};
  return Boolean(blockedByA[userIdB] || blockedByB[userIdA]);
}

/**
 * Adds a mutual friendship, written to BOTH sides of KEYS.friendlist at once
 * — the exact shape !friend leaves behind in the bot's own
 * handlers/friendlist.js, so the bot (and getFriendIds/getFriends above)
 * read this exactly as if it had been added from Discord. The target must
 * already be a known player (has a score record) since that record is
 * where the display name saved next to them comes from.
 */
async function addFriend(userId, friendId) {
  if (userId === friendId) { const err = new Error("You can't friend yourself."); err.code = 'SELF_FRIEND'; throw err; }

  const [scoresData, blocked] = await Promise.all([
    remoteGetJSON(KEYS.scores, { users: {} }),
    areBlocked(userId, friendId),
  ]);
  if (blocked) { const err = new Error('A block is in place between you two.'); err.code = 'BLOCKED'; throw err; }

  const users = scoresData.users && typeof scoresData.users === 'object' ? scoresData.users : {};
  const friendRecord = users[friendId];
  if (!friendRecord) { const err = new Error("That player hasn't played Crossover yet."); err.code = 'NOT_FOUND'; throw err; }
  const userRecord = users[userId] || {};

  const friendlist = await remoteGetJSON(KEYS.friendlist, {});
  const mine = friendlist[userId] && typeof friendlist[userId] === 'object' ? { ...friendlist[userId] } : {};
  if (mine[friendId]) { const err = new Error('You are already friends.'); err.code = 'ALREADY_FRIENDS'; throw err; }
  const theirs = friendlist[friendId] && typeof friendlist[friendId] === 'object' ? { ...friendlist[friendId] } : {};

  const at = Date.now();
  mine[friendId] = { username: friendRecord.name || 'Unknown', at };
  theirs[userId] = { username: userRecord.name || 'Unknown', at };
  friendlist[userId] = mine;
  friendlist[friendId] = theirs;
  await remoteSetJSON(KEYS.friendlist, friendlist);

  return getFriends(userId);
}

/** Removes a mutual friendship from both sides of KEYS.friendlist, cleaning up an empty entry rather than leaving `{}` behind. */
async function removeFriend(userId, friendId) {
  const friendlist = await remoteGetJSON(KEYS.friendlist, {});
  const mine = friendlist[userId] && typeof friendlist[userId] === 'object' ? { ...friendlist[userId] } : {};
  const theirs = friendlist[friendId] && typeof friendlist[friendId] === 'object' ? { ...friendlist[friendId] } : {};

  delete mine[friendId];
  delete theirs[userId];

  if (Object.keys(mine).length) friendlist[userId] = mine; else delete friendlist[userId];
  if (Object.keys(theirs).length) friendlist[friendId] = theirs; else delete friendlist[friendId];

  await remoteSetJSON(KEYS.friendlist, friendlist);
  return getFriends(userId);
}

/** Buys `itemId` with `giverId`'s points but grants it to `friendId` — handlers/shop.js's "🎁 Send Gift". Requires a mutual friendship, same as the bot. */
async function purchaseItemForGift(giverId, friendId, itemId) {
  const item = getItem(itemId);
  if (!item || item.lootOnly) { const err = new Error('Unknown item.'); err.code = 'UNKNOWN_ITEM'; throw err; }
  if (giverId === friendId) { const err = new Error("You can't gift yourself."); err.code = 'SELF_GIFT'; throw err; }

  const friendIds = await getFriendIds(giverId);
  if (!friendIds.includes(friendId)) { const err = new Error('You can only gift mutual friends — add them with !friend first.'); err.code = 'NOT_FRIENDS'; throw err; }

  const data = await remoteGetJSON(KEYS.scores, { users: {} });
  const users = data.users && typeof data.users === 'object' ? data.users : {};
  const giver = users[giverId] || {};
  const friend = users[friendId] || {};
  const friendItems = Array.isArray(friend.items) ? friend.items : [];

  if (friendItems.includes(itemId)) { const err = new Error('They already own that.'); err.code = 'ALREADY_OWNED'; throw err; }
  if (Number(giver.points ?? 0) < item.price) { const err = new Error('Not enough points.'); err.code = 'INSUFFICIENT_POINTS'; throw err; }

  users[giverId] = { ...giver, points: Number(giver.points ?? 0) - item.price, spent: Number(giver.spent ?? 0) + item.price };
  users[friendId] = { ...friend, items: [...friendItems, itemId] };
  data.users = users;
  await remoteSetJSON(KEYS.scores, data);
  return { buyerPoints: users[giverId].points };
}

// ── Owner-only inventory editing (mirrors hand-editing a player's !inv) ────
// These skip the normal price/ownership rules on purpose — they're the
// dashboard's stand-in for an owner directly patching a user's record in
// Redis, which is what "editing !inv by hand" meant before this existed.
// Gate every call site behind isOwner(), same as getAllBlocks() above.

/** Sets a player's point balance directly, no purchase involved. */
async function adminSetPoints(userId, points) {
  const n = Math.floor(Number(points));
  if (!Number.isFinite(n) || n < 0) { const err = new Error('Points must be a whole number, 0 or more.'); err.code = 'INVALID_POINTS'; throw err; }

  const data = await remoteGetJSON(KEYS.scores, { users: {} });
  const users = data.users && typeof data.users === 'object' ? data.users : {};
  const record = users[userId] || {};
  users[userId] = { ...record, points: n };
  data.users = users;
  await remoteSetJSON(KEYS.scores, data);
  return inventoryFromRecord(users[userId]);
}

/** Grants `itemId` for free, bypassing price and equipping it automatically. */
async function adminGrantItem(userId, itemId) {
  const item = getItem(itemId);
  if (!item) { const err = new Error('Unknown item.'); err.code = 'UNKNOWN_ITEM'; throw err; }

  const data = await remoteGetJSON(KEYS.scores, { users: {} });
  const users = data.users && typeof data.users === 'object' ? data.users : {};
  const record = users[userId] || {};
  const items = Array.isArray(record.items) ? record.items : [];
  if (items.includes(itemId)) { const err = new Error('Already owned.'); err.code = 'ALREADY_OWNED'; throw err; }

  users[userId] = { ...record, items: [...items, itemId] };
  data.users = users;
  await remoteSetJSON(KEYS.scores, data);
  return inventoryFromRecord(users[userId]);
}

/** Takes an owned item away, clearing it out of `equipped` first if it was the one in use. */
async function adminRevokeItem(userId, itemId) {
  const data = await remoteGetJSON(KEYS.scores, { users: {} });
  const users = data.users && typeof data.users === 'object' ? data.users : {};
  const record = users[userId] || {};
  const items = Array.isArray(record.items) ? record.items : [];
  if (!items.includes(itemId)) { const err = new Error("They don't own that."); err.code = 'NOT_OWNED'; throw err; }

  const item = getItem(itemId);
  const equipped = record.equipped && typeof record.equipped === 'object' ? { ...record.equipped } : {};
  if (item && equipped[item.game] === itemId) delete equipped[item.game];

  users[userId] = { ...record, items: items.filter((id) => id !== itemId), equipped };
  data.users = users;
  await remoteSetJSON(KEYS.scores, data);
  return inventoryFromRecord(users[userId]);
}

module.exports = {
  configured,
  KEYS,
  getGuildSettings,
  setGuildValue,
  resetGuildValue,
  getGuildStats,
  getGuildLeaderboard,
  getAllBlocks,
  getUserProfile,
  getPlayersDirectory,
  getPlayersVisibility,
  setPlayersVisibility,
  PLAYERS_VISIBILITY_DEFAULTS,
  getUserInventory,
  purchaseItem,
  openLootBox,
  equipItem,
  purchaseItemForGift,
  getFriendIds,
  getFriends,
  addFriend,
  removeFriend,
  adminSetPoints,
  adminGrantItem,
  adminRevokeItem,
  PROFILE_GAME_KEYS,
  PROFILE_GAME_LABELS,
  PROFILE_GAME_ICONS,
  remoteGetJSON,
  remoteSetJSON,
  remotePipeline,
  areBlocked,
};
