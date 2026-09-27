// Keep this in sync with handlers/invite.js in the Crossover bot.
// This is the exact OR of every permission requested by the bot's own !invite link.
const CROSSOVER_INVITE_PERMISSIONS = '327222946833';

export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send('DISCORD_CLIENT_ID is not configured.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'bot applications.commands',
    permissions: CROSSOVER_INVITE_PERMISSIONS,
  });

  res.redirect(302, `https://discord.com/oauth2/authorize?${params.toString()}`);
}
