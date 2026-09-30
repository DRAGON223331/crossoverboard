import { getSession } from '../../../lib/session';
import { getUserGuildAccess } from '../../../lib/discord';
import { isOwner } from '../../../lib/owner';
import {
  isActive,
  getViewerAccess,
  canOpenPremiumTab,
  getPremiumOverview,
  getGuildEntry,
  setLimits,
  setThemes,
} from '../../../lib/premium';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in.' });

  const { guildId } = req.query;
  if (!/^\d{17,20}$/.test(String(guildId))) return res.status(400).json({ error: 'Bad server id.' });

  // Re-checked on every request, never trusted from the client.
  // Manage Server in Discord is NOT enough: only the server owner, the bot owner,
  // and members the server owner added from the bot (`!premium add`) get in.
  const access = await getUserGuildAccess(session.accessToken, guildId);
  const viewer = {
    userId: session.user.id,
    isServerOwner: access.isServerOwner,
    isBotOwner: isOwner(session),
    inGuild: access.inGuild,
  };

  try {
    const entry = await getGuildEntry(guildId);
    if (!canOpenPremiumTab(entry, viewer)) {
      return res.status(403).json({ error: 'Premium settings are only for people the server owner added from the bot.' });
    }
    const perms = getViewerAccess(entry, viewer);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).end();
    }

    if (!isActive(entry)) return res.status(403).json({ error: 'Server Premium is not active for this server.' });

    const { action } = req.body || {};
    const ownerOnly = 'Only the server owner can change this.';

    if (action === 'addMember' || action === 'removeMember') {
      // The allowed-members list is managed ONLY from the bot.
      return res.status(403).json({ error: 'Allowed members can only be managed from the bot (!premium add / remove).' });
    } else if (action === 'saveLimits') {
      if (!perms.limits) return res.status(403).json({ error: ownerOnly });
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
