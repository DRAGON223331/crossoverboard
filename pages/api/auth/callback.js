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
      user: { id: user.id, username: user.username, avatar: user.avatar },
    });

    res.setHeader('Set-Cookie', [cookie, 'oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0']);
    res.writeHead(302, { Location: '/servers' });
    res.end();
  } catch (err) {
    console.error('OAuth callback failed:', err.message);
    res.writeHead(302, { Location: '/?error=login_failed' });
    res.end();
  }
};
