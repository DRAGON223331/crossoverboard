import { getSession } from '../../../lib/session';
import {
  getInbox,
  getUnreadTotal,
  getThread,
  sendMessage,
  setTyping,
  clearConversation,
} from '../../../lib/chat';

// One route for the whole chat feature:
//   GET  /api/chat/inbox                      friends + presence + unread + last message
//   GET  /api/chat/unread                     just the unread total (nav badge)
//   GET  /api/chat/thread?friendId=&after=    new messages of one conversation
//   POST /api/chat/send   { friendId, text, clientId }
//   POST /api/chat/typing { friendId }
//   POST /api/chat/clear  { friendId }
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in.' });
  const user = session.user;
  const { action } = req.query;

  try {
    if (req.method === 'GET') {
      if (action === 'inbox') return res.status(200).json(await getInbox(user.id));
      if (action === 'unread') return res.status(200).json({ unread: await getUnreadTotal(user.id) });
      if (action === 'thread') {
        const friendId = String(req.query.friendId || '');
        const after = Math.max(0, parseInt(req.query.after, 10) || 0);
        return res.status(200).json(await getThread(user.id, friendId, after));
      }
      return res.status(404).json({ error: 'Unknown chat action.' });
    }

    if (req.method === 'POST') {
      const { friendId, text, clientId } = req.body || {};
      if (action === 'send') {
        const name = user.global_name || user.username;
        const message = await sendMessage(user.id, name, friendId, text, clientId);
        return res.status(200).json({ message });
      }
      if (action === 'typing') {
        await setTyping(user.id, friendId);
        return res.status(200).json({ ok: true });
      }
      if (action === 'clear') {
        await clearConversation(user.id, friendId);
        return res.status(200).json({ ok: true });
      }
      return res.status(404).json({ error: 'Unknown chat action.' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message, code: err.code || null });
  }
}
