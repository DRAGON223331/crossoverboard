// A small, database-free login session: the Discord OAuth access token and
// basic profile are encrypted (not just signed — the access token is a real
// secret) into an httpOnly cookie. Every page/API route decrypts it fresh;
// nothing is kept in server memory, which is required on Vercel since each
// request can hit a different, short-lived function instance.

const { EncryptJWT, jwtDecrypt } = require('jose');
const crypto = require('crypto');

const COOKIE_NAME = 'crossover_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days — matches Discord's own access token lifetime

function encryptionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short — set a long random string in your env vars.');
  }
  // SHA-256 so any length/format of SESSION_SECRET reliably becomes the 32
  // raw bytes A256GCM needs.
  return crypto.createHash('sha256').update(secret).digest();
}

async function createSessionCookie(payload) {
  const key = encryptionKey();
  const jwe = await new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .encrypt(key);

  const secure = process.env.DASHBOARD_BASE_URL?.startsWith('https://') ? '; Secure' : '';
  return `${COOKIE_NAME}=${jwe}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

/** Returns the decrypted session payload, or null if missing/invalid/expired. */
async function getSession(req) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return null;
  try {
    const key = encryptionKey();
    const { payload } = await jwtDecrypt(token, key);
    return payload; // { accessToken, user: { id, username, avatar } }
  } catch {
    return null;
  }
}

module.exports = { COOKIE_NAME, createSessionCookie, clearSessionCookie, getSession };
