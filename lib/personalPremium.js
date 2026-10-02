import { remoteGetJSON, remoteSetJSON } from './redis';

const PREMIUM_KEY = 'crossover:premium';
const CUSTOM_KEY = 'crossover:profile-custom';
const BG_PREFIX = 'crossover:profile-bg:';

const BADGES = ['star', 'crown', 'diamond', 'heart', 'bolt', 'shield'];
const COLORS = {
  gold: '#F1C40F',
  emerald: '#3DFF8A',
  purple: '#8B5CF6',
  galaxy: '#6C5CE7',
  crimson: '#DC3545',
};
const DEFAULT_COLOR = '#3DFF8A';
const MAX_TITLE = 24;
const MAX_BG_BYTES = 350 * 1024;

function active(entry) {
  return Boolean(entry) && (!entry.until || entry.until > Date.now());
}

function plain(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

export async function getPersonalPremium(userId) {
  const [premium, custom] = await Promise.all([
    remoteGetJSON(PREMIUM_KEY, {}),
    remoteGetJSON(CUSTOM_KEY, {}),
  ]);

  const entry = plain(premium.users) ? premium.users[userId] || null : null;
  const customEntry = plain(custom.users) ? custom.users[userId] || null : null;

  return {
    status: !entry ? 'none' : active(entry) ? 'active' : 'expired',
    until: entry?.until || null,
    at: entry?.at || null,
    tag: entry?.tag || null,
    note: entry?.note || null,
    card: {
      color: customEntry?.color || DEFAULT_COLOR,
      badge: BADGES.includes(customEntry?.badge) ? customEntry.badge : null,
      title: typeof customEntry?.title === 'string' ? customEntry.title.slice(0, MAX_TITLE) : '',
      enabled: customEntry ? customEntry.enabled !== false : false,
      designed: Boolean(customEntry),
      background: null,
    },
    presets: COLORS,
    badges: BADGES,
  };
}

function normalizeColor(value) {
  const raw = String(value || '').trim();
  if (COLORS[raw.toLowerCase()]) return COLORS[raw.toLowerCase()];
  const hex = raw.replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toUpperCase()}`;
  throw new Error('Pick a preset or a 6-digit HEX color such as #00FF88.');
}

function normalizeTitle(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE);
}

export async function updatePersonalPremium(userId, input = {}) {
  const premium = await remoteGetJSON(PREMIUM_KEY, {});
  const entry = plain(premium.users) ? premium.users[userId] : null;
  if (!active(entry)) {
    const err = new Error('Personal Premium is not active on this account.');
    err.status = 403;
    throw err;
  }

  const all = await remoteGetJSON(CUSTOM_KEY, {});
  all.users = plain(all.users) ? all.users : {};
  const mine = plain(all.users[userId]) ? { ...all.users[userId] } : {};

  if (input.color !== undefined) mine.color = normalizeColor(input.color);
  if (input.badge !== undefined) {
    const badge = input.badge === null || input.badge === '' || input.badge === 'none'
      ? null
      : String(input.badge).toLowerCase();
    if (badge === null) delete mine.badge;
    else if (!BADGES.includes(badge)) throw new Error('Invalid badge.');
    else mine.badge = badge;
  }
  if (input.title !== undefined) {
    const title = normalizeTitle(input.title);
    if (title) mine.title = title;
    else delete mine.title;
  }
  if (input.enabled !== undefined) {
    if (!Object.prototype.hasOwnProperty.call(mine, 'enabled') && !mine.color && !mine.badge && !mine.title) {
      throw new Error('Design your custom card first.');
    }
    mine.enabled = Boolean(input.enabled);
  }

  all.users[userId] = mine;
  await remoteSetJSON(CUSTOM_KEY, all);

  if (input.background === 'remove') {
    await remoteSetJSON(`${BG_PREFIX}${userId}`, { img: null });
  } else if (input.backgroundBase64) {
    const b64 = String(input.backgroundBase64);
    const bytes = Math.floor((b64.length * 3) / 4);
    if (bytes > MAX_BG_BYTES) throw new Error('Background must be 350 KB or smaller.');
    await remoteSetJSON(`${BG_PREFIX}${userId}`, { img: b64 });
  }

  return getPersonalPremium(userId);
}
