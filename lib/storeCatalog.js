// ── Store catalog ────────────────────────────────────────────────────────
// IMPORTANT: this is a NEW catalog invented for the dashboard — the bot's own
// !store/!shop command was not available to mirror here (see lib/redis.js's
// header comment on why everything else in this file copies the bot's exact
// Redis key/value shapes). Buying/gifting/equipping below reads and writes a
// brand-new `crossover:inventory` key (see lib/redis.js). For the bot itself
// to actually show a bought skin in a game thread or a bought title under a
// name, its own code needs to read that same key — right now this only
// updates the dashboard's and Redis's view of who owns what.
//
// Prices spend from the same `points` balance `!profile` shows in Discord,
// and (like the bot's own economy per PROFILE_POINTS_PER_LEVEL) buying never
// lowers a level, because spent points move into `record.spent`, which
// levels also count.

const SKINS = [
  { id: 'skin_classic', category: 'skin', price: 0, icon: '⭕❌', default: true },
  { id: 'skin_fire', category: 'skin', price: 150, icon: '🔥❄️' },
  { id: 'skin_animals', category: 'skin', price: 150, icon: '🐱🐶' },
  { id: 'skin_space', category: 'skin', price: 250, icon: '🚀🌙' },
  { id: 'skin_royal', category: 'skin', price: 400, icon: '👑💎' },
  { id: 'skin_neon', category: 'skin', price: 400, icon: '💚💜' },
];

const TITLES = [
  { id: 'title_rookie', category: 'title', price: 100, icon: '🎮' },
  { id: 'title_champion', category: 'title', price: 300, icon: '🏆' },
  { id: 'title_legend', category: 'title', price: 600, icon: '🌟' },
  { id: 'title_grandmaster', category: 'title', price: 900, icon: '👑' },
  { id: 'title_unstoppable', category: 'title', price: 500, icon: '🔥' },
  { id: 'title_comeback', category: 'title', price: 350, icon: '🔄' },
];

const STORE_ITEMS = [...SKINS, ...TITLES];
const STORE_ITEMS_BY_ID = new Map(STORE_ITEMS.map((item) => [item.id, item]));
const DEFAULT_SKIN_ID = 'skin_classic';

function getItem(itemId) {
  return STORE_ITEMS_BY_ID.get(itemId) || null;
}

module.exports = { SKINS, TITLES, STORE_ITEMS, getItem, DEFAULT_SKIN_ID };
