export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send('DISCORD_CLIENT_ID is not configured.');
  }

  const permissions = process.env.DISCORD_BOT_PERMISSIONS || '268435456';
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'bot applications.commands',
    permissions,
  });

  res.redirect(302, `https://discord.com/oauth2/authorize?${params.toString()}`);
}
