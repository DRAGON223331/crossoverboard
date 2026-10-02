// Display name + avatar of Discord users, for the chat and friends pages.
//
// The bot's friend list only stores a plain username, so the real profile is
// read from Discord (bot token, GET /users/{id}) and cached in Redis for 6
// hours — one lookup per person per 6h instead of one per poll. A tiny
// in-memory layer on top saves the Redis round trip on warm serverless
// instances. If Discord is unreachable we fall back to the stored username and
// the default Discord avatar; nothing breaks.

const { remotePipeline } = require('./redis');

const API = 'https://discord.com/api/v10';
const REDIS_TTL = 6 * 60 * 60; // seconds
const MEM_TTL = 5 * 60 * 1000; // ms
const FAIL_TTL = 60 * 1000; // ms — don't hammer Discord if a lookup just failed
const FETCH_BATCH = 8;

const key = (id) => `crossover:chat:profile:${id}`;
const mem = new Map(); // id -> { until, profile }

function avatarProxyUrl(id, hash, size = 128) {
  if (!id) return null;
  const params = new URLSearchParams({ id: String(id), size: String(size) });
  if (hash) params.set('avatar', String(hash));
  return `/api/avatar?${params.toString()}`;
}

function avatarUrl(id, hash, size = 128) {
  if (hash) {
    const ext = hash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${id}/${hash}.${ext}?size=${size}`;
  }
  // Discord's default avatar: one of 6, picked from the user id.
  let index = 0;
  try { index = Number((BigInt(id) >> 22n) % 6n); } catch { /* keep 0 */ }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function fallback(id, storedName) {
  return { id, name: storedName || 'Unknown', username: storedName || null, avatar: avatarUrl(id, null) };
}

async function fetchFromDiscord(id) {
  if (!process.env.DISCORD_BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN is not set.');
  const res = await fetch(`${API}/users/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Discord user lookup failed: HTTP ${res.status}`);
  const u = await res.json();
  return {
    id,
    name: u.global_name || u.username,
    username: u.username,
    avatar: avatarUrl(id, u.avatar),
  };
}

/**
 * ids: array of Discord user ids
 * storedNames: optional { id: username } used only if Discord can't be reached
 * Returns { id: { id, name, username, avatar } } for every requested id.
 */
async function getProfiles(ids, storedNames = {}) {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = {};
  const now = Date.now();

  let missing = [];
  for (const id of unique) {
    const hit = mem.get(id);
    if (hit && hit.until > now) out[id] = hit.profile;
    else missing.push(id);
  }
  if (missing.length === 0) return out;

  // Redis layer
  try {
    const [cached] = await remotePipeline([['MGET', ...missing.map(key)]]);
    const stillMissing = [];
    missing.forEach((id, i) => {
      let profile = null;
      try { profile = cached?.[i] ? JSON.parse(cached[i]) : null; } catch { /* refetch */ }
      if (profile) {
        out[id] = profile;
        mem.set(id, { until: now + MEM_TTL, profile });
      } else {
        stillMissing.push(id);
      }
    });
    missing = stillMissing;
  } catch {
    // Redis hiccup: go straight to Discord.
  }

  // Discord layer (a few at a time)
  const toCache = [];
  for (let i = 0; i < missing.length; i += FETCH_BATCH) {
    const batch = missing.slice(i, i + FETCH_BATCH);
    const results = await Promise.allSettled(batch.map(fetchFromDiscord));
    results.forEach((r, j) => {
      const id = batch[j];
      if (r.status === 'fulfilled') {
        out[id] = r.value;
        mem.set(id, { until: Date.now() + MEM_TTL, profile: r.value });
        toCache.push(['SET', key(id), JSON.stringify(r.value), 'EX', String(REDIS_TTL)]);
      } else {
        const fb = fallback(id, storedNames[id]);
        out[id] = fb;
        mem.set(id, { until: Date.now() + FAIL_TTL, profile: fb });
      }
    });
  }
  if (toCache.length) await remotePipeline(toCache).catch(() => {});

  return out;
}

/** Adds name / avatar to a list from getFriends(), keeping the stored username as a fallback. */
async function withProfiles(friends) {
  if (!friends.length) return friends;
  const stored = Object.fromEntries(friends.map((f) => [f.id, f.username]));
  const profiles = await getProfiles(friends.map((f) => f.id), stored);
  return friends.map((f) => ({
    ...f,
    name: profiles[f.id].name,
    username: profiles[f.id].username || f.username,
    avatar: profiles[f.id].avatar,
  }));
}

module.exports = { getProfiles, withProfiles, avatarUrl, avatarProxyUrl };
