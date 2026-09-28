// ── Store catalog ────────────────────────────────────────────────────────
// Copied straight from the bot's own handlers/shop.js — same ids, prices,
// names, icons, and (for skins) the same custom Discord emoji. Keep this in
// sync by hand if the bot's SKINS/TITLES ever change; there's no shared
// package between the two repos.
//
// A skin's `x`/`o` are a custom emoji's { id, name } — not showable as plain
// text. The dashboard renders them as <img> tags against Discord's CDN
// (https://cdn.discordapp.com/emojis/{id}.png), which works for any public
// custom emoji regardless of which server it lives on.

const TITLE_SLOT = 'title';

const SKINS = {
  cross: {
    game: 'xo',
    price: 20,
    en: 'Cross',
    ar: 'كروس',
    x: { id: '1552398127204536330', name: 'crossX' },
    o: { id: '1552397710332657795', name: 'crossO' },
  },
  crossgold: {
    game: 'xo',
    price: 50,
    en: 'CrossGold',
    ar: 'كروس جولد',
    x: { id: '1554045375047008286', name: 'crossXGold' },
    o: { id: '1554045403979321446', name: 'crossOGold' },
  },
};

const TITLES = {
  title_rookie: { game: TITLE_SLOT, price: 10, icon: '🌱', en: 'Rookie', ar: 'مبتدئ' },
  title_strategist: { game: TITLE_SLOT, price: 30, icon: '🧠', en: 'Strategist', ar: 'الاستراتيجي' },
  title_lightning: { game: TITLE_SLOT, price: 40, icon: '⚡', en: 'Lightning', ar: 'البرق' },
  title_champion: { game: TITLE_SLOT, price: 60, icon: '🏆', en: 'Champion', ar: 'البطل' },
  title_xo_king: { game: TITLE_SLOT, price: 100, icon: '👑', en: 'XO King', ar: 'ملك الـ XO' },
  title_legend: { game: TITLE_SLOT, price: 200, icon: '🔥', en: 'Legend', ar: 'الأسطورة' },
};

// Same "coming soon" teaser the !store embed shows.
const COMING_SOON = [
  { icon: '🖼️', en: 'Profile Frames', ar: 'إطارات الملف الشخصي' },
  { icon: '⚡', en: 'Boosts', ar: 'معززات' },
];

const ITEMS = { ...SKINS, ...TITLES };
const ITEMS_BY_ID = new Map(Object.entries(ITEMS));

// Loot Box — must match handlers/shop.js in the bot. Costs LOOT_BOX_COST points
// and drops one random item (weight = 1 / √price, so cheap items drop more often).
// A duplicate costs the points and gives nothing back.
const LOOT_BOX_COST = 300;

function rollLootBox() {
  const entries = Object.entries(ITEMS).map(([id, item]) => [id, 1 / Math.sqrt(item.price)]);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let pick = Math.random() * total;
  for (const [id, weight] of entries) {
    pick -= weight;
    if (pick <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

function getItem(itemId) {
  return ITEMS_BY_ID.get(itemId) || null;
}

function isTitle(item) {
  return item.game === TITLE_SLOT;
}

function emojiUrl(emoji, size = 40) {
  return `https://cdn.discordapp.com/emojis/${emoji.id}.png?size=${size}`;
}

module.exports = { LOOT_BOX_COST, rollLootBox, SKINS, TITLES, ITEMS, COMING_SOON, TITLE_SLOT, getItem, isTitle, emojiUrl };
