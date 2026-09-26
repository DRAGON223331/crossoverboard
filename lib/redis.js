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
// handlers/language.js, handlers/onlineMode.js in the bot's own repo.
const KEYS = {
  prefixes: 'crossover:prefixes', // { guildId: "!" }
  roomNames: 'crossover:roomNames', // { guildId: { channelId, name } }
  languages: 'crossover:languages', // { guildId: "en" | "ar" }
  onlineMode: 'crossover:onlineMode', // { guildId: true | false }
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

module.exports = { configured, KEYS, getGuildSettings, setGuildValue, remoteGetJSON, remoteSetJSON };
