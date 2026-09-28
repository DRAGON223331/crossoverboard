import { getSession } from '../../lib/session';
import { getFriends, addFriend, removeFriend } from '../../lib/redis';
import { withProfiles } from '../../lib/profiles';

const ERROR_MESSAGES = {
  SELF_FRIEND: "You can't add yourself.",
  BLOCKED: 'A block is in place between you two.',
  NOT_FOUND: "That player hasn't played Crossover yet.",
  ALREADY_FRIENDS: 'You are already friends.',
};

function friendlyError(err) {
  return ERROR_MESSAGES[err.code] || err.message || 'Something went wrong.';
}

// Writes straight to crossover:friendlist in the same shape the bot's own
// !friend command leaves behind (see lib/redis.js#addFriend/removeFriend),
// so a friend added here shows up to the bot — and in !inv's gift flow —
// exactly like one added in Discord.
export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in.' });
  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const friends = await withProfiles(await getFriends(userId));
      return res.status(200).json({ friends });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }

  const { action, friendId } = req.body || {};
  if (!friendId || typeof friendId !== 'string') return res.status(400).json({ error: 'Choose a player.' });

  try {
    if (action === 'add') {
      const friends = await withProfiles(await addFriend(userId, friendId));
      return res.status(200).json({ friends });
    }

    if (action === 'remove') {
      const friends = await withProfiles(await removeFriend(userId, friendId));
      return res.status(200).json({ friends });
    }

    return res.status(400).json({ error: 'Unknown friends action.' });
  } catch (err) {
    return res.status(409).json({ error: friendlyError(err) });
  }
}
