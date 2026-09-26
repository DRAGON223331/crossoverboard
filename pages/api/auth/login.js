import crypto from 'crypto';
import { getOAuthUrl } from '../../../lib/discord';

// Checked up front so a missing env var shows up as a clear message on the
// page instead of Vercel's generic, unhelpful "500 Internal Server Error".
const REQUIRED_ENV_VARS = ['DISCORD_CLIENT_ID', 'DASHBOARD_BASE_URL'];

export default function handler(req, res) {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    return res
      .status(500)
      .send(`Missing environment variable(s) on this Vercel project: ${missing.join(', ')}. Add them under Project -> Settings -> Environment Variables, then redeploy.`);
  }

  try {
    // A random, short-lived CSRF-style state value, stored in its own cookie
    // and checked again in the callback below.
    const state = crypto.randomBytes(16).toString('hex');
    const secure = process.env.DASHBOARD_BASE_URL?.startsWith('https://') ? '; Secure' : '';
    res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
    res.writeHead(302, { Location: getOAuthUrl(state) });
    res.end();
  } catch (err) {
    console.error('Login redirect failed:', err);
    res.status(500).send(`Login failed to start: ${err.message}`);
  }
};
