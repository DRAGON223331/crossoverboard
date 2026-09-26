import { getSession } from '../../../lib/session';
import { userCanManageGuild, fetchGuildTextChannels, renameChannel } from '../../../lib/discord';
import { getGuildSettings, setGuildValue, KEYS } from '../../../lib/redis';

// Mirrors the bot's own handlers/prefix.js validatePrefix() rules, so a
// prefix saved here is guaranteed to also be accepted there.
const MAX_PREFIX_LENGTH = 5;
function validatePrefix(candidate) {
  if (!candidate) return 'The prefix can\u2019t be empty.';
  if (/\s/.test(candidate)) return 'The prefix can\u2019t contain spaces.';
  if (candidate.length > MAX_PREFIX_LENGTH) return `The prefix can be at most ${MAX_PREFIX_LENGTH} characters long.`;
  if (candidate.startsWith('@') || candidate.startsWith('#')) return 'The prefix can\u2019t start with @ or #.';
  return null;
}

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in.' });

  const { guildId } = req.query;

  // Re-checked on every request (not trusted from the client) — this is the
  // one thing standing between "any logged-in user" and "only an admin of
  // this specific server".
  const allowed = await userCanManageGuild(session.accessToken, guildId);
  if (!allowed) return res.status(403).json({ error: 'You do not manage this server.' });

  if (req.method === 'GET') {
    try {
      const [settings, channels] = await Promise.all([getGuildSettings(guildId), fetchGuildTextChannels(guildId)]);
      return res.status(200).json({ settings, channels });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { prefix, language, onlineEnabled, channelId, renameTo } = req.body || {};
    try {
      if (prefix !== undefined) {
        const error = validatePrefix(prefix);
        if (error) return res.status(400).json({ error });
        await setGuildValue(KEYS.prefixes, guildId, prefix);
      }

      if (language !== undefined) {
        if (language !== 'en' && language !== 'ar') return res.status(400).json({ error: 'Unsupported language.' });
        await setGuildValue(KEYS.languages, guildId, language);
      }

      if (onlineEnabled !== undefined) {
        await setGuildValue(KEYS.onlineMode, guildId, Boolean(onlineEnabled));
      }

      // Point the game room at a different existing channel (equivalent to
      // the bot's own !chset), optionally renaming it too (!chname).
      if (channelId) {
        const channels = await fetchGuildTextChannels(guildId);
        const channel = channels.find((c) => c.id === channelId);
        if (!channel) return res.status(400).json({ error: 'That channel was not found in this server.' });

        let finalName = channel.name;
        if (renameTo && renameTo !== channel.name) {
          const renamed = await renameChannel(channelId, renameTo);
          finalName = renamed.name;
        }
        await setGuildValue(KEYS.roomNames, guildId, { channelId, name: finalName });
      }

      const settings = await getGuildSettings(guildId);
      return res.status(200).json({ settings });
    } catch (err) {
      console.error('Settings update failed:', err.message);
      return res.status(502).json({ error: err.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
};
