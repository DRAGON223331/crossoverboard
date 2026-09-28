import { getSession } from '../../../lib/session';
import {
  getInbox,
  getUnreadTotal,
  getThread,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  setTyping,
  clearConversation,
} from '../../../lib/chat';

// One route for the whole chat feature:
//   GET  /api/chat/inbox                      friends + presence + unread + last message
//   GET  /api/chat/unread                     just the unread total (nav badge)
//   GET  /api/chat/thread?friendId=&after=&rev=   new messages of one conversation
//                                             (the whole latest page again if `rev` is stale)
//   POST /api/chat/send   { friendId, text, clientId, replyTo? }
//   POST /api/chat/edit   { friendId, messageId, text }
//   POST /api/chat/delete { friendId, messageId }
//   POST /api/chat/react  { friendId, messageId, emoji }   (same emoji again = remove it)
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
        const revParam = req.query.rev === undefined ? null : parseInt(req.query.rev, 10);
        const knownRev = Number.isFinite(revParam) ? revParam : null;
        return res.status(200).json(await getThread(user.id, friendId, after, knownRev));
      }
      return res.status(404).json({ error: 'Unknown chat action.' });
    }

    if (req.method === 'POST') {
      const { friendId, text, clientId, replyTo, messageId, emoji } = req.body || {};
      if (action === 'send') {
        const message = await sendMessage(user.id, friendId, text, clientId, replyTo);
        return res.status(200).json({ message });
      }
      if (action === 'edit') {
        return res.status(200).json({ message: await editMessage(user.id, friendId, messageId, text) });
      }
      if (action === 'delete') {
        return res.status(200).json({ message: await deleteMessage(user.id, friendId, messageId) });
      }
      if (action === 'react') {
        return res.status(200).json({ message: await reactToMessage(user.id, friendId, messageId, emoji) });
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
