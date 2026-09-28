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
    rarity: 'common',
    game: 'xo',
    price: 20,
    en: 'Cross',
    ar: 'كروس',
    x: { id: '1552398127204536330', name: 'crossX' },
    o: { id: '1552397710332657795', name: 'crossO' },
  },
  crossgold: {
    rarity: 'common',
    game: 'xo',
    price: 50,
    en: 'CrossGold',
    ar: 'كروس جولد',
    x: { id: '1554045375047008286', name: 'crossXGold' },
    o: { id: '1554045403979321446', name: 'crossOGold' },
  },
  crossgalaxy: {
    rarity: 'rare',
    // Sold in the store, but can also drop from Loot Boxes.
    game: 'xo',
    price: 400,
    en: 'CrossGalaxy',
    ar: 'كروس جالاكسي',
    x: { id: '1554056368829501542', name: 'crossXGalaxy' },
    o: { id: '1554056452182777947', name: 'crossOGalaxy' },
  },
};

const TITLES = {
  title_rookie: { rarity: 'common', game: TITLE_SLOT, price: 10, icon: '🌱', en: 'Rookie', ar: 'مبتدئ' },
  title_strategist: { rarity: 'common', game: TITLE_SLOT, price: 30, icon: '🧠', en: 'Strategist', ar: 'الاستراتيجي' },
  title_lightning: { rarity: 'common', game: TITLE_SLOT, price: 40, icon: '⚡', en: 'Lightning', ar: 'البرق' },
  title_champion: { rarity: 'rare', game: TITLE_SLOT, price: 60, icon: '🏆', en: 'Champion', ar: 'البطل' },
  title_xo_king: { rarity: 'rare', game: TITLE_SLOT, price: 100, icon: '👑', en: 'XO King', ar: 'ملك الـ XO' },
  title_legend: { rarity: 'legendary', game: TITLE_SLOT, price: 200, icon: '🔥', en: 'Legend', ar: 'الأسطورة' },
};

// Loot-Box-only titles — must match the bot.
Object.assign(TITLES, {
  title_lucky: { rarity: 'common', lootOnly: true, game: TITLE_SLOT, price: null, icon: '🍀', en: 'Lucky', ar: 'محظوظ' },
  title_gambler: { rarity: 'rare', lootOnly: true, game: TITLE_SLOT, price: null, icon: '🎰', en: 'Gambler', ar: 'المقامر' },
  title_dragon: { rarity: 'legendary', lootOnly: true, game: TITLE_SLOT, price: null, icon: '🐉', en: 'Dragon', ar: 'التنين' },
});

// Profile cards — the look of the !profile card. Must match CARDS in the bot's
// handlers/shop.js. Equipped in the `card` slot. `image` is the preview in
// public/cards/ (the bot draws the real card itself).
const CARD_SLOT = 'card';
const CARDS = {
  card_gold: { rarity: 'common', game: CARD_SLOT, price: 350, icon: '🪪', image: '/cards/gold.png', en: 'Gold Card', ar: 'كارت ذهبي' },
  card_galaxy: { rarity: 'rare', game: CARD_SLOT, price: 600, icon: '🌌', image: '/cards/galaxy.png', en: 'Galaxy Card', ar: 'كارت جالاكسي' },
};

// Avatar frames — drawn around the avatar on the !profile card. Must match
// FRAMES in the bot's handlers/shop.js. Equipped in the `frame` slot.
const FRAME_SLOT = 'frame';
const FRAMES = {
  frame_fire: { rarity: 'rare', game: FRAME_SLOT, price: 400, icon: '🔥', image: '/frames/fire.png', en: 'Fire Frame', ar: 'فريم النار' },
  frame_crown: { rarity: 'legendary', game: FRAME_SLOT, price: 800, icon: '👑', image: '/frames/crown.png', en: 'Crown Frame', ar: 'فريم التاج' },
};

// Same "coming soon" teaser the !store embed shows.
const COMING_SOON = [
  { icon: '⚡', en: 'Boosts', ar: 'معززات' },
];

const ITEMS = { ...SKINS, ...TITLES, ...CARDS, ...FRAMES };
const ITEMS_BY_ID = new Map(Object.entries(ITEMS));

// ── Loot Box — must match handlers/shop.js in the bot ─────────────────────
// Costs LOOT_BOX_COST points (or a free box earned from a 7-day daily streak).
// The rarity is rolled first, then a random item of that rarity. A duplicate
// costs the points and gives nothing back. After PITY_THRESHOLD duplicates in a
// row the next box is guaranteed to be an item the player doesn't own.
const LOOT_BOX_COST = 300;
const PITY_THRESHOLD = 3;

const RARITIES = {
  common: { weight: 70, en: 'Common', ar: 'عادي' },
  rare: { weight: 25, en: 'Rare', ar: 'نادر' },
  legendary: { weight: 5, en: 'Legendary', ar: 'أسطوري' },
};

function rollLootBox(ownedItems = [], guaranteedNew = false) {
  const pool = Object.entries(ITEMS).filter(([id]) => !guaranteedNew || !ownedItems.includes(id));
  const byRarity = {};
  for (const [id, item] of pool) (byRarity[item.rarity] ||= []).push(id);

  const rarities = Object.keys(RARITIES).filter((r) => byRarity[r]?.length);
  if (!rarities.length) return null;

  let pick = Math.random() * rarities.reduce((sum, r) => sum + RARITIES[r].weight, 0);
  let chosen = rarities[rarities.length - 1];
  for (const r of rarities) {
    pick -= RARITIES[r].weight;
    if (pick <= 0) { chosen = r; break; }
  }
  const ids = byRarity[chosen];
  return ids[Math.floor(Math.random() * ids.length)];
}

function getItem(itemId) {
  return ITEMS_BY_ID.get(itemId) || null;
}

function isTitle(item) {
  return item.game === TITLE_SLOT;
}

function isCard(item) {
  return item.game === CARD_SLOT;
}

function isFrame(item) {
  return item.game === FRAME_SLOT;
}

function emojiUrl(emoji, size = 40) {
  return `https://cdn.discordapp.com/emojis/${emoji.id}.png?size=${size}`;
}

module.exports = { LOOT_BOX_COST, PITY_THRESHOLD, RARITIES, rollLootBox, SKINS, TITLES, CARDS, FRAMES, ITEMS, COMING_SOON, TITLE_SLOT, CARD_SLOT, FRAME_SLOT, getItem, isTitle, isCard, isFrame, emojiUrl };
