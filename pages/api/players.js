import { getSession } from '../../lib/session';
import { getPlayersDirectory, getPlayersVisibility } from '../../lib/redis';

// Backs the /players page's initial load, its "load more" button and its
// search box. Kept as one small, cheap endpoint (see getPlayersDirectory's
// in-memory cache in lib/redis.js) so typing in the search box or paging
// through a large player base never has to re-render the whole page.
export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 60) : '';

  try {
    const [directory, visibility] = await Promise.all([
      getPlayersDirectory({ limit, offset, q }),
      getPlayersVisibility(),
    ]);
    return res.status(200).json({ ...directory, visibility });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
