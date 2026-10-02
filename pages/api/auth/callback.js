import { exchangeCodeForToken, fetchCurrentUser } from '../../../lib/discord';
import { createSessionCookie } from '../../../lib/session';

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    res.writeHead(302, { Location: `/?error=${encodeURIComponent(error)}` });
    return res.end();
  }

  const expectedState = readCookie(req, 'oauth_state');
  if (!code || !state || state !== expectedState) {
    res.writeHead(302, { Location: '/?error=invalid_state' });
    return res.end();
  }

  try {
    const token = await exchangeCodeForToken(code);
    const user = await fetchCurrentUser(token.access_token);

    const cookie = await createSessionCookie({
      accessToken: token.access_token,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        // Discord returns the avatar hash during OAuth login; keep the exact
        // CDN URL in the encrypted session so every page can render it.
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${String(user.avatar).startsWith('a_') ? 'gif' : 'png'}?size=256`
          : `https://cdn.discordapp.com/embed/avatars/${(() => { try { return Number((BigInt(user.id) >> 22n) % 6n); } catch { return 0; } })()}.png?size=256`,
      },
    });

    res.setHeader('Set-Cookie', [cookie, 'oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0']);
    res.writeHead(302, { Location: '/servers' });
    res.end();
  } catch (err) {
    console.error('OAuth callback failed:', err);
    // Surfaced directly instead of a generic redirect, so a misconfigured
    // env var or a Discord API error is visible without digging through
    // Vercel's Runtime Logs.
    res.status(500).send(`Login could not complete: ${err.message}`);
  }
};
