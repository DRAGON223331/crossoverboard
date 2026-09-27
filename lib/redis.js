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
const PROFILE_GAME_KEYS = ['xo', 'connect4', 'rps', 'fast', 'flag', 'trivia', 'word', 'math', 'mafia', 'chairs'];
const PROFILE_GAME_LABELS = {
  xo: 'Tic Tac Toe',
  connect4: 'Connect 4',
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
  PROFILE_GAME_KEYS,
  PROFILE_GAME_LABELS,
  PROFILE_GAME_ICONS,
  remoteGetJSON,
  remoteSetJSON,
};
