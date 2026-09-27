import { getSession } from '../../lib/session';
import { getUserInventory, purchaseItem, giftItem, equipItem, unequipTitle, getUserProfile } from '../../lib/redis';
import { getItem } from '../../lib/storeCatalog';

const ERROR_MESSAGES = {
  UNKNOWN_ITEM: 'That item does not exist.',
  ALREADY_OWNED: 'Already owned.',
  NOT_OWNED: "You don't own that yet.",
  INSUFFICIENT_POINTS: 'Not enough points.',
  SELF_GIFT: "You can't gift yourself.",
};

function friendlyError(err) {
  return ERROR_MESSAGES[err.code] || err.message || 'Something went wrong.';
}

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'GET') {
    try {
      const [profile, inventory] = await Promise.all([
        getUserProfile(session.user.id),
        getUserInventory(session.user.id),
      ]);
      return res.status(200).json({ points: profile?.points ?? 0, inventory });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }

  const { action, itemId, targetUserId } = req.body || {};
  const userId = session.user.id;

  try {
    if (action === 'buy') {
      if (!getItem(itemId)) return res.status(400).json({ error: 'Unknown item.' });
      const inventory = await purchaseItem(userId, itemId);
      const profile = await getUserProfile(userId);
      return res.status(200).json({ inventory, points: profile?.points ?? 0 });
    }

    if (action === 'gift') {
      if (!getItem(itemId)) return res.status(400).json({ error: 'Unknown item.' });
      const cleanTarget = String(targetUserId || '').trim();
      if (!/^\d{5,25}$/.test(cleanTarget)) return res.status(400).json({ error: 'Enter a valid Discord user ID.' });
      await giftItem(userId, cleanTarget, itemId);
      const profile = await getUserProfile(userId);
      return res.status(200).json({ points: profile?.points ?? 0 });
    }

    if (action === 'equip') {
      if (!getItem(itemId)) return res.status(400).json({ error: 'Unknown item.' });
      const inventory = await equipItem(userId, itemId);
      return res.status(200).json({ inventory });
    }

    if (action === 'unequipTitle') {
      const inventory = await unequipTitle(userId);
      return res.status(200).json({ inventory });
    }

    return res.status(400).json({ error: 'Unknown store action.' });
  } catch (err) {
    return res.status(409).json({ error: friendlyError(err) });
  }
}
