import crypto from 'crypto';
import { getOAuthUrl } from '../../../lib/discord';

export default function handler(req, res) {
  // A random, short-lived CSRF-style state value, stored in its own cookie
  // and checked again in the callback below.
  const state = crypto.randomBytes(16).toString('hex');
  const secure = process.env.DASHBOARD_BASE_URL?.startsWith('https://') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
  res.writeHead(302, { Location: getOAuthUrl(state) });
  res.end();
};
