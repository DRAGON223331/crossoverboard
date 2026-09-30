import { getSession } from '../../../lib/session';
import { getUserGuildAccess, fetchGuild, fetchGuildMember, searchGuildMembers } from '../../../lib/discord';
import { isOwner } from '../../../lib/owner';
import {
  isActive,
  getViewerAccess,
  getPremiumOverview,
  getGuildEntry,
  addMember,
  removeMember,
  setLimits,
  setThemes,
} from '../../../lib/premium';

function avatarUrl(user) {
  return user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : null;
}

// Same label the bot stores when it grants access (`member.user.tag ?? username`).
function userTag(user) {
  return user?.discriminator && user.discriminator !== '0' ? `${user.username}#${user.discriminator}` : user?.username || null;
}

function parseUserId(raw) {
  const text = String(raw || '').trim();
  return text.match(/^<@!?(\d{17,20})>$/)?.[1] || text.match(/^(\d{17,20})$/)?.[1] || null;
}

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in.' });

  const { guildId } = req.query;
  if (!/^\d{17,20}$/.test(String(guildId))) return res.status(400).json({ error: 'Bad server id.' });

  // Re-checked on every request, never trusted from the client.
  const access = await getUserGuildAccess(session.accessToken, guildId);
  if (!access.canManage) return res.status(403).json({ error: 'You do not manage this server.' });

  const viewer = { userId: session.user.id, isServerOwner: access.isServerOwner, isBotOwner: isOwner(session) };

  try {
    const entry = await getGuildEntry(guildId);
    const perms = getViewerAccess(entry, viewer);

    // ── Member search (powers the "add member" box) ──────────────────────
    if (req.method === 'GET') {
      if (!perms.members) return res.status(403).json({ error: 'Only the server owner can add members.' });
      const q = String(req.query.q || '').trim().slice(0, 32);
      if (q.length < 2) return res.status(200).json({ results: [] });
      try {
        const found = await searchGuildMembers(guildId, q, 8);
        const results = found
          .filter((m) => m?.user && !m.user.bot)
          .map((m) => ({
            id: m.user.id,
            username: m.user.username,
            display: m.nick || m.user.global_name || m.user.username,
            avatar: avatarUrl(m.user),
          }));
        return res.status(200).json({ results });
      } catch {
        // Member search can be unavailable (bot lacks the members intent). The UI falls back to "paste an ID".
        return res.status(200).json({ results: [], unavailable: true });
      }
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).end();
    }

    if (!isActive(entry)) return res.status(403).json({ error: 'Server Premium is not active for this server.' });

    const { action } = req.body || {};
    const ownerOnly = 'Only the server owner can change this.';

    if (action === 'addMember') {
      if (!perms.members) return res.status(403).json({ error: ownerOnly });
      const userId = parseUserId(req.body.userId);
      if (!userId) return res.status(400).json({ error: 'Enter a valid user ID or mention.' });
      const [guild, member] = await Promise.all([fetchGuild(guildId), fetchGuildMember(guildId, userId)]);
      if (!member || member.user?.bot) {
        return res.status(400).json({ error: 'That user is not a member of this server (or is a bot).' });
      }
      if (userId === guild.owner_id) {
        return res.status(400).json({ error: 'The server owner already has Premium automatically.' });
      }
      await addMember(guildId, userId, userTag(member.user));
    } else if (action === 'removeMember') {
      if (!perms.members) return res.status(403).json({ error: ownerOnly });
      const userId = parseUserId(req.body.userId);
      if (!userId) return res.status(400).json({ error: 'Bad user id.' });
      await removeMember(guildId, userId);
    } else if (action === 'saveLimits') {
      if (!perms.members) return res.status(403).json({ error: ownerOnly });
      await setLimits(guildId, req.body.limits);
    } else if (action === 'saveThemes') {
      if (!perms.themes) return res.status(403).json({ error: 'You need Premium access in this server to change game colors.' });
      await setThemes(guildId, req.body.themes);
    } else {
      return res.status(400).json({ error: 'Unknown action.' });
    }

    return res.status(200).json({ overview: await getPremiumOverview(guildId, viewer) });
  } catch (err) {
    console.error('Premium update failed:', err.message);
    return res.status(err.status && err.status < 500 ? err.status : 502).json({ error: err.message });
  }
}
