import { getSession } from '../../../lib/session';
import { isOwner } from '../../../lib/owner';
import {
  getUserProfile,
  getUserInventory,
  equipItem,
  adminSetPoints,
  adminGrantItem,
  adminRevokeItem,
} from '../../../lib/redis';
import { getItem } from '../../../lib/storeCatalog';

const ERROR_MESSAGES = {
  INVALID_POINTS: 'Points must be a whole number, 0 or more.',
  UNKNOWN_ITEM: 'That item does not exist.',
  ALREADY_OWNED: 'Already owned.',
  NOT_OWNED: "They don't own that.",
  WRONG_SLOT: 'That item cannot go there.',
};

function friendlyError(err) {
  return ERROR_MESSAGES[err.code] || err.message || 'Something went wrong.';
}

// The website's stand-in for hand-editing a player's !inv: same underlying
// score record, just reached through a form instead of raw Redis access.
// Owner-only — see isOwner() — since it can change anyone's balance/items.
export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in.' });
  if (!isOwner(session)) return res.status(403).json({ error: 'Owner only.' });

  if (req.method === 'GET') {
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    if (!userId) return res.status(400).json({ error: 'Missing userId.' });
    try {
      const [profile, inventory] = await Promise.all([getUserProfile(userId), getUserInventory(userId)]);
      if (!profile) return res.status(404).json({ error: "That player hasn't played Crossover yet." });
      return res.status(200).json({ name: profile.name, inventory });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }

  const { userId, action, points, itemId, slot } = req.body || {};
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId.' });

  try {
    if (action === 'setPoints') {
      const inventory = await adminSetPoints(userId, points);
      return res.status(200).json({ inventory });
    }

    if (action === 'grant') {
      if (!getItem(itemId)) return res.status(400).json({ error: 'Unknown item.' });
      const inventory = await adminGrantItem(userId, itemId);
      return res.status(200).json({ inventory });
    }

    if (action === 'revoke') {
      const inventory = await adminRevokeItem(userId, itemId);
      return res.status(200).json({ inventory });
    }

    if (action === 'equip') {
      const item = getItem(itemId);
      if (!item) return res.status(400).json({ error: 'Unknown item.' });
      const inventory = await equipItem(userId, item.game, itemId);
      return res.status(200).json({ inventory });
    }

    if (action === 'unequip') {
      if (slot !== 'xo' && slot !== 'title' && slot !== 'card') return res.status(400).json({ error: 'Unknown slot.' });
      const inventory = await equipItem(userId, slot, null);
      return res.status(200).json({ inventory });
    }

    return res.status(400).json({ error: 'Unknown inventory action.' });
  } catch (err) {
    return res.status(409).json({ error: friendlyError(err) });
  }
}
