// Web chat between mutual friends.
//
// Storage (all under crossover:chat:* so it never touches the bot's JSON blobs):
//   crossover:chat:msgs:<a>_<b>      LIST  of JSON messages, newest last, capped at MAX_HISTORY
//   crossover:chat:seq:<a>_<b>       INT   per-conversation message counter (message id)
//   crossover:chat:unread:<userId>   HASH  friendId -> unread count
//   crossover:chat:read:<a>_<b>      HASH  userId   -> last message id that user has seen
//   crossover:chat:online:<userId>   STR   heartbeat, expires by itself (ONLINE_TTL)
//   crossover:chat:typing:<conv>:<u> STR   "is typing" flag, expires by itself (TYPING_TTL)
//   crossover:chat:rate:<userId>     INT   anti-flood counter, expires by itself
//
// Friendship / block checks reuse the bot's own friendlist + blocklist, so a
// chat can only exist between two people who are friends in the bot too.

const { remotePipeline, getFriends, areBlocked } = require('./redis');

const MAX_HISTORY = 300; // messages kept per conversation
const PAGE = 60; // messages returned per request
const MAX_LEN = 1000; // characters per message
const ONLINE_TTL = 45; // seconds a heartbeat keeps someone "online"
const TYPING_TTL = 5; // seconds a typing flag lasts
const RATE_WINDOW = 10; // seconds
const RATE_MAX = 12; // messages per window

const P = 'crossover:chat:';

function convId(a, b) {
  return [a, b].sort().join('_');
}

const k = {
  msgs: (c) => `${P}msgs:${c}`,
  seq: (c) => `${P}seq:${c}`,
  unread: (u) => `${P}unread:${u}`,
  read: (c) => `${P}read:${c}`,
  online: (u) => `${P}online:${u}`,
  typing: (c, u) => `${P}typing:${c}:${u}`,
  rate: (u) => `${P}rate:${u}`,
};

function chatError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function parseMessages(raw) {
  return (raw || [])
    .map((entry) => {
      try {
        return JSON.parse(entry);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** Throws unless `friendId` is a mutual friend of `userId` and no block exists. */
async function assertCanChat(userId, friendId) {
  if (!friendId || typeof friendId !== 'string' || friendId === userId) {
    throw chatError('BAD_FRIEND', 'Choose a friend to chat with.');
  }
  const friends = await getFriends(userId);
  if (!friends.some((f) => f.id === friendId)) {
    throw chatError('NOT_FRIENDS', 'You are not friends with this player.', 403);
  }
  if (await areBlocked(userId, friendId)) {
    throw chatError('BLOCKED', 'A block is in place between you two.', 403);
  }
}

/** Marks the caller as online. Cheap; called on every poll. */
async function heartbeat(userId) {
  await remotePipeline([['SET', k.online(userId), '1', 'EX', String(ONLINE_TTL)]]);
}

/**
 * Everything the left-hand list needs, in 2 Redis round trips no matter how
 * many friends there are: friends, presence, unread counts, last message.
 */
async function getInbox(userId) {
  const friends = await getFriends(userId);
  if (friends.length === 0) return { friends: [], totalUnread: 0 };

  const convs = friends.map((f) => convId(userId, f.id));

  const results = await remotePipeline([
    ['SET', k.online(userId), '1', 'EX', String(ONLINE_TTL)],
    ['HGETALL', k.unread(userId)],
    ['MGET', ...friends.map((f) => k.online(f.id))],
    ...convs.map((c) => ['LRANGE', k.msgs(c), '-1', '-1']),
  ]);

  const unreadFlat = results[1] || [];
  const unread = {};
  for (let i = 0; i < unreadFlat.length; i += 2) unread[unreadFlat[i]] = Number(unreadFlat[i + 1]) || 0;

  const onlineFlags = results[2] || [];

  let totalUnread = 0;
  const rows = friends.map((f, i) => {
    const last = parseMessages(results[3 + i])[0] || null;
    const count = unread[f.id] || 0;
    totalUnread += count;
    return {
      id: f.id,
      username: f.username,
      online: Boolean(onlineFlags[i]),
      unread: count,
      last: last ? { text: last.text.slice(0, 80), from: last.from, at: last.at } : null,
    };
  });

  // Conversations with a message first (newest on top), then the rest by name.
  rows.sort((a, b) => {
    const at = (b.last?.at || 0) - (a.last?.at || 0);
    if (at) return at;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return (a.username || '').localeCompare(b.username || '');
  });

  return { friends: rows, totalUnread };
}

/** Only the unread total — used by the small badge in the nav bar. */
async function getUnreadTotal(userId) {
  const [, unreadFlat] = await remotePipeline([
    ['SET', k.online(userId), '1', 'EX', String(ONLINE_TTL)],
    ['HGETALL', k.unread(userId)],
  ]);
  let total = 0;
  for (let i = 1; i < (unreadFlat || []).length; i += 2) total += Number(unreadFlat[i]) || 0;
  return total;
}

/**
 * One poll of an open conversation. Returns messages newer than `afterId`
 * (or the latest page when afterId is 0), whether the friend is online /
 * typing, and how far the friend has read. Opening a conversation also clears
 * its unread counter and records "seen" for the friend's read receipts.
 */
async function getThread(userId, friendId, afterId = 0) {
  await assertCanChat(userId, friendId);
  const conv = convId(userId, friendId);

  const [, raw, friendOnline, friendTyping, readMap] = await remotePipeline([
    ['SET', k.online(userId), '1', 'EX', String(ONLINE_TTL)],
    ['LRANGE', k.msgs(conv), String(-PAGE), '-1'],
    ['EXISTS', k.online(friendId)],
    ['EXISTS', k.typing(conv, friendId)],
    ['HGETALL', k.read(conv)],
  ]);

  const all = parseMessages(raw);
  const messages = afterId ? all.filter((m) => m.id > afterId) : all;
  const latestId = all.length ? all[all.length - 1].id : 0;

  // Mark everything up to the newest message as read by me.
  const writes = [];
  if (latestId) writes.push(['HSET', k.read(conv), userId, String(latestId)]);
  writes.push(['HDEL', k.unread(userId), friendId]);
  await remotePipeline(writes);

  const readObj = {};
  for (let i = 0; i < (readMap || []).length; i += 2) readObj[readMap[i]] = Number(readMap[i + 1]) || 0;

  return {
    messages,
    online: Boolean(friendOnline),
    typing: Boolean(friendTyping),
    friendReadUpTo: readObj[friendId] || 0,
  };
}

async function sendMessage(userId, userName, friendId, rawText, clientId) {
  const text = String(rawText ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) throw chatError('EMPTY', 'Write something first.');
  if (text.length > MAX_LEN) throw chatError('TOO_LONG', `Messages can be up to ${MAX_LEN} characters.`);

  await assertCanChat(userId, friendId);

  const [rate] = await remotePipeline([['INCR', k.rate(userId)]]);
  if (rate === 1) await remotePipeline([['EXPIRE', k.rate(userId), String(RATE_WINDOW)]]);
  if (rate > RATE_MAX) throw chatError('RATE_LIMIT', 'Slow down a little — you are sending too fast.', 429);

  const conv = convId(userId, friendId);
  const [id] = await remotePipeline([['INCR', k.seq(conv)]]);

  const message = { id, from: userId, name: userName || null, text, at: Date.now() };
  if (typeof clientId === 'string' && clientId.length <= 40) message.cid = clientId;

  await remotePipeline([
    ['RPUSH', k.msgs(conv), JSON.stringify(message)],
    ['LTRIM', k.msgs(conv), String(-MAX_HISTORY), '-1'],
    ['HINCRBY', k.unread(friendId), userId, '1'],
    ['HSET', k.read(conv), userId, String(id)], // I have obviously seen my own message
    ['DEL', k.typing(conv, userId)],
  ]);

  return message;
}

async function setTyping(userId, friendId) {
  await assertCanChat(userId, friendId);
  await remotePipeline([['SET', k.typing(convId(userId, friendId), userId), '1', 'EX', String(TYPING_TTL)]]);
}

/** Deletes the whole history of one conversation (both sides). */
async function clearConversation(userId, friendId) {
  await assertCanChat(userId, friendId);
  const conv = convId(userId, friendId);
  await remotePipeline([
    ['DEL', k.msgs(conv)],
    ['DEL', k.read(conv)],
    ['HDEL', k.unread(userId), friendId],
    ['HDEL', k.unread(friendId), userId],
  ]);
}

module.exports = {
  MAX_LEN,
  getInbox,
  getUnreadTotal,
  getThread,
  sendMessage,
  setTyping,
  clearConversation,
  heartbeat,
};
