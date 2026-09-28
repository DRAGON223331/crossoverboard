import { getSession } from '../../lib/session';
import {
  getUserInventory,
  purchaseItem,
  openLootBox,
  equipItem,
  purchaseItemForGift,
  getFriends,
} from '../../lib/redis';
import { getItem } from '../../lib/storeCatalog';

const ERROR_MESSAGES = {
  UNKNOWN_ITEM: 'That item does not exist.',
  ALREADY_OWNED: 'Already owned.',
  NOT_OWNED: "You don't own that yet.",
  WRONG_SLOT: 'That item cannot go there.',
  INSUFFICIENT_POINTS: 'Not enough points.',
  ALL_OWNED: 'You already own everything.',
  SELF_GIFT: "You can't gift yourself.",
  NOT_FRIENDS: 'You can only gift mutual friends — add them with !friend in Discord first.',
};

function friendlyError(err) {
  return ERROR_MESSAGES[err.code] || err.message || 'Something went wrong.';
}

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in.' });
  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const [inventory, friends] = await Promise.all([getUserInventory(userId), getFriends(userId)]);
      return res.status(200).json({ inventory, friends });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }

  const { action, itemId, slot, friendId } = req.body || {};

  try {
    if (action === 'buy') {
      if (!getItem(itemId) || getItem(itemId).lootOnly) return res.status(400).json({ error: 'Unknown item.' });
      const inventory = await purchaseItem(userId, itemId);
      return res.status(200).json({ inventory });
    }

    if (action === 'lootbox') {
      const result = await openLootBox(userId);
      return res.status(200).json(result);
    }

    if (action === 'equip') {
      const item = getItem(itemId);
      if (!item) return res.status(400).json({ error: 'Unknown item.' });
      const inventory = await equipItem(userId, item.game, itemId);
      return res.status(200).json({ inventory });
    }

    if (action === 'unequip') {
      if (slot !== 'xo' && slot !== 'title' && slot !== 'card' && slot !== 'frame') return res.status(400).json({ error: 'Unknown slot.' });
      const inventory = await equipItem(userId, slot, null);
      return res.status(200).json({ inventory });
    }

    if (action === 'gift') {
      if (!getItem(itemId) || getItem(itemId).lootOnly) return res.status(400).json({ error: 'Unknown item.' });
      if (!friendId) return res.status(400).json({ error: 'Choose a friend to gift.' });
      const result = await purchaseItemForGift(userId, friendId, itemId);
      return res.status(200).json({ buyerPoints: result.buyerPoints });
    }

    return res.status(400).json({ error: 'Unknown store action.' });
  } catch (err) {
    return res.status(409).json({ error: friendlyError(err) });
  }
}
