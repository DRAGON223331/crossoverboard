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
//   crossover:chat:rev:<conv>        INT   bumped on every edit / delete / reaction / clear, so an
//                                          open chat knows it must re-read old messages too
//   crossover:chat:dm:<conv>:<u>     STR   "already notified by Discord DM" flag, expires by itself
//
// A message is JSON: { id, from, text, at, cid?, reply?, edited?, reactions?, deleted? }
//   reply     { id, from, text }        snapshot of the message being answered (text is scrubbed on delete)
//   edited    timestamp of the last edit
//   reactions { "👍": [userId, ...] }
//   deleted   true = tombstone (text removed, id kept so ids stay contiguous and replies can say "deleted")
//
// Friendship / block checks reuse the bot's own friendlist + blocklist, so a
// chat can only exist between two people who are friends in the bot too.

const { remotePipeline, getFriends, areBlocked } = require('./redis');
const { getProfiles } = require('./profiles');
const { sendDirectMessage } = require('./discord');
const { MAX_LEN, REPLY_SNIPPET, REACTIONS } = require('./chatShared');

const MAX_HISTORY = 300; // messages kept per conversation
const PAGE = 60; // messages returned per request
const ONLINE_TTL = 45; // seconds a heartbeat keeps someone "online"
const TYPING_TTL = 5; // seconds a typing flag lasts
const RATE_WINDOW = 10; // seconds
const RATE_MAX = 12; // actions (send / edit / react / delete) per window
const DM_COOLDOWN = 10 * 60; // seconds between Discord DM notifications for one conversation

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
  rev: (c) => `${P}rev:${c}`,
  dm: (c, u) => `${P}dm:${c}:${u}`,
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
  if (friends.length === 0) return { friends: [], totalUnread: 0, me: (await getProfiles([userId]))[userId] };

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

  const stored = Object.fromEntries(friends.map((f) => [f.id, f.username]));
  const profiles = await getProfiles([userId, ...friends.map((f) => f.id)], stored);

  let totalUnread = 0;
  const rows = friends.map((f, i) => {
    const last = parseMessages(results[3 + i])[0] || null;
    const count = unread[f.id] || 0;
    totalUnread += count;
    return {
      id: f.id,
      name: profiles[f.id].name,
      username: profiles[f.id].username || f.username,
      avatar: profiles[f.id].avatar,
      online: Boolean(onlineFlags[i]),
      unread: count,
      last: last
        ? { text: last.deleted ? '' : String(last.text || '').slice(0, 80), deleted: Boolean(last.deleted), from: last.from, at: last.at }
        : null,
    };
  });

  // Conversations with a message first (newest on top), then the rest by name.
  rows.sort((a, b) => {
    const at = (b.last?.at || 0) - (a.last?.at || 0);
    if (at) return at;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  return { friends: rows, totalUnread, me: profiles[userId] };
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
 *
 * Edits, deletes and reactions change OLD messages, which "newer than afterId"
 * would never show. So every such change bumps a per-conversation `rev`; when
 * the caller's `knownRev` no longer matches, the whole latest page is returned
 * (`full: true`) and the client reconciles it. Nothing changed = same cheap poll.
 */
async function getThread(userId, friendId, afterId = 0, knownRev = null) {
  await assertCanChat(userId, friendId);
  const conv = convId(userId, friendId);

  const [, raw, friendOnline, friendTyping, readMap, revRaw, firstRaw] = await remotePipeline([
    ['SET', k.online(userId), '1', 'EX', String(ONLINE_TTL)],
    ['LRANGE', k.msgs(conv), String(-PAGE), '-1'],
    ['EXISTS', k.online(friendId)],
    ['EXISTS', k.typing(conv, friendId)],
    ['HGETALL', k.read(conv)],
    ['GET', k.rev(conv)],
    ['LINDEX', k.msgs(conv), '0'],
  ]);

  const rev = Number(revRaw) || 0;
  const full = !afterId || knownRev === null || knownRev !== rev;

  const all = parseMessages(raw);
  const messages = full ? all : all.filter((m) => m.id > afterId);
  const latestId = all.length ? all[all.length - 1].id : 0;
  const firstId = parseMessages(firstRaw ? [firstRaw] : [])[0]?.id || 0; // oldest message still stored

  // Mark everything up to the newest message as read by me.
  const writes = [];
  if (latestId) writes.push(['HSET', k.read(conv), userId, String(latestId)]);
  writes.push(['HDEL', k.unread(userId), friendId]);
  await remotePipeline(writes);

  const readObj = {};
  for (let i = 0; i < (readMap || []).length; i += 2) readObj[readMap[i]] = Number(readMap[i + 1]) || 0;

  let profile = null;
  if (!afterId) {
    const friends = await getFriends(userId);
    const stored = { [friendId]: friends.find((f) => f.id === friendId)?.username };
    profile = (await getProfiles([friendId], stored))[friendId];
  }

  return {
    profile,
    messages,
    full,
    rev,
    firstId,
    online: Boolean(friendOnline),
    typing: Boolean(friendTyping),
    friendReadUpTo: readObj[friendId] || 0,
  };
}

function cleanText(rawText) {
  const text = String(rawText ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) throw chatError('EMPTY', 'Write something first.');
  if (text.length > MAX_LEN) throw chatError('TOO_LONG', `Messages can be up to ${MAX_LEN} characters.`);
  return text;
}

/** One shared anti-flood budget for send / edit / delete / react. */
async function takeRate(userId) {
  const [rate] = await remotePipeline([['INCR', k.rate(userId)]]);
  if (rate === 1) await remotePipeline([['EXPIRE', k.rate(userId), String(RATE_WINDOW)]]);
  if (rate > RATE_MAX) throw chatError('RATE_LIMIT', 'Slow down a little — you are sending too fast.', 429);
}

/** First N characters, without cutting an emoji / surrogate pair in half. */
function snippet(text, n = REPLY_SNIPPET) {
  return Array.from(String(text || '')).slice(0, n).join('');
}

async function readAllMessages(conv) {
  const [raw] = await remotePipeline([['LRANGE', k.msgs(conv), String(-MAX_HISTORY), '-1']]);
  return raw || [];
}

// Replace one list entry only if it still holds exactly the text we read
// (compare-and-swap, atomic inside Redis). Two people reacting to the same
// message at the same moment can therefore never overwrite each other.
const CAS_SCRIPT =
  "local i = redis.call('LPOS', KEYS[1], ARGV[1]) if i then redis.call('LSET', KEYS[1], i, ARGV[2]) return 1 end return 0";

/**
 * Read-modify-write of ONE message. `mutate(message)` returns the new message,
 * or null for "nothing to change", and may throw a chatError. Retries a few
 * times if someone else changed the same message in between.
 */
async function mutateMessage(conv, id, mutate) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const raw = await readAllMessages(conv);
    let rawMsg = null;
    let msg = null;
    for (let i = raw.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(raw[i]);
        if (parsed.id === id) {
          rawMsg = raw[i];
          msg = parsed;
          break;
        }
      } catch {
        // skip a corrupt entry
      }
    }
    if (!msg) throw chatError('NOT_FOUND', 'That message no longer exists.', 404);

    const next = mutate(msg);
    if (!next) return msg;

    const [swapped] = await remotePipeline([['EVAL', CAS_SCRIPT, '1', k.msgs(conv), rawMsg, JSON.stringify(next)]]);
    if (Number(swapped) === 1) {
      await remotePipeline([['INCR', k.rev(conv)]]);
      return next;
    }
  }
  throw chatError('BUSY', 'That message is changing right now — try again.', 409);
}

async function sendMessage(userId, friendId, rawText, clientId, replyToId = null) {
  const text = cleanText(rawText);

  await assertCanChat(userId, friendId);
  await takeRate(userId);

  const conv = convId(userId, friendId);

  // A reply keeps a short snapshot of the original. It is built HERE from the
  // stored message (never trusted from the browser), and skipped if the
  // original is gone or already deleted.
  let reply = null;
  const rid = Number(replyToId);
  if (Number.isInteger(rid) && rid > 0) {
    const target = parseMessages(await readAllMessages(conv)).find((m) => m.id === rid);
    if (target && !target.deleted) reply = { id: target.id, from: target.from, text: snippet(target.text) };
  }

  const [id] = await remotePipeline([['INCR', k.seq(conv)]]);

  const message = { id, from: userId, text, at: Date.now() };
  if (reply) message.reply = reply;
  if (typeof clientId === 'string' && clientId.length <= 40) message.cid = clientId;

  const results = await remotePipeline([
    ['RPUSH', k.msgs(conv), JSON.stringify(message)],
    ['LTRIM', k.msgs(conv), String(-MAX_HISTORY), '-1'],
    ['HINCRBY', k.unread(friendId), userId, '1'],
    ['HSET', k.read(conv), userId, String(id)], // I have obviously seen my own message
    ['DEL', k.typing(conv, userId)],
    ['EXISTS', k.online(friendId)], // is the friend on the site right now?
  ]);

  if (!results[results.length - 1]) await notifyByDiscordDM(userId, friendId, conv);

  return message;
}

/**
 * Tells an away friend, by Discord DM from the bot, that a message is waiting.
 * Limited to one DM per conversation per DM_COOLDOWN so a long back-and-forth
 * can never spam them. It carries NO message text on purpose — deleting a
 * message in the chat must really remove it, not leave a copy inside a DM.
 * Any failure (DMs closed, Discord down…) is swallowed: a notification must
 * never make a send fail.
 */
async function notifyByDiscordDM(userId, friendId, conv) {
  try {
    const [claimed] = await remotePipeline([['SET', k.dm(conv, friendId), '1', 'NX', 'EX', String(DM_COOLDOWN)]]);
    if (claimed !== 'OK') return;

    const name = (await getProfiles([userId]))[userId]?.name || 'Someone';
    const base = String(process.env.DASHBOARD_BASE_URL || '').replace(/\/+$/, '');
    const link = base ? `${base}/chat?with=${userId}` : null;
    await sendDirectMessage(friendId, {
      content:
        `💬 أرسل لك **${name}** رسالة جديدة على Crossover.\n` +
        `💬 **${name}** sent you a new message on Crossover.` +
        (link ? `\n<${link}>` : ''),
      allowed_mentions: { parse: [] },
    });
  } catch {
    // ignore — see above
  }
}

async function editMessage(userId, friendId, messageId, rawText) {
  const text = cleanText(rawText);
  await assertCanChat(userId, friendId);
  await takeRate(userId);

  return mutateMessage(convId(userId, friendId), Number(messageId), (m) => {
    if (m.from !== userId) throw chatError('NOT_YOURS', 'You can only edit your own messages.', 403);
    if (m.deleted) throw chatError('DELETED', 'That message was deleted.');
    if (m.text === text) return null;
    return { ...m, text, edited: Date.now() };
  });
}

async function deleteMessage(userId, friendId, messageId) {
  await assertCanChat(userId, friendId);
  await takeRate(userId);

  const conv = convId(userId, friendId);
  const id = Number(messageId);
  let alreadyDeleted = false;

  const result = await mutateMessage(conv, id, (m) => {
    if (m.from !== userId) throw chatError('NOT_YOURS', 'You can only delete your own messages.', 403);
    if (m.deleted) {
      alreadyDeleted = true;
      return null;
    }
    // Tombstone: keep id / author / time, drop everything else.
    return { id: m.id, from: m.from, at: m.at, deleted: true };
  });
  if (alreadyDeleted) return result;

  // 1) Replies quoting this message must not keep its text.
  const quoting = parseMessages(await readAllMessages(conv)).filter((m) => m.reply?.id === id && !m.reply.deleted);
  for (const m of quoting.slice(0, 25)) {
    await mutateMessage(conv, m.id, (cur) =>
      cur.reply && !cur.reply.deleted ? { ...cur, reply: { id: cur.reply.id, from: cur.reply.from, deleted: true } } : null
    ).catch(() => {});
  }

  // 2) If the friend never saw it, it must not stay in their unread count.
  const [readUpTo] = await remotePipeline([['HGET', k.read(conv), friendId]]);
  if (id > (Number(readUpTo) || 0)) {
    const [left] = await remotePipeline([['HINCRBY', k.unread(friendId), userId, '-1']]);
    if (Number(left) <= 0) await remotePipeline([['HDEL', k.unread(friendId), userId]]);
  }

  return result;
}

async function reactToMessage(userId, friendId, messageId, emoji) {
  if (!REACTIONS.includes(emoji)) throw chatError('BAD_REACTION', 'That reaction is not available.');
  await assertCanChat(userId, friendId);
  await takeRate(userId);

  return mutateMessage(convId(userId, friendId), Number(messageId), (m) => {
    if (m.deleted) throw chatError('DELETED', 'That message was deleted.');
    const reactions = { ...(m.reactions || {}) };
    const who = new Set(reactions[emoji] || []);
    if (who.has(userId)) who.delete(userId);
    else who.add(userId);
    if (who.size) reactions[emoji] = [...who];
    else delete reactions[emoji];

    const next = { ...m };
    if (Object.keys(reactions).length) next.reactions = reactions;
    else delete next.reactions;
    return next;
  });
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
    ['INCR', k.rev(conv)],
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
  editMessage,
  deleteMessage,
  reactToMessage,
  setTyping,
  clearConversation,
  heartbeat,
};
