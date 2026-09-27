import { getSession } from '../../lib/session';
import { isOwner } from '../../lib/owner';
import { getPlayersVisibility, setPlayersVisibility } from '../../lib/redis';

// Level and Display Name are never part of this — they always show on the
// /players page and aren't accepted here. Everything else is a toggle the
// bot owner controls for every visitor of that page at once.
export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in.' });
  if (!isOwner(session)) return res.status(403).json({ error: 'Owner only.' });

  if (req.method === 'GET') {
    try {
      const visibility = await getPlayersVisibility();
      return res.status(200).json({ visibility });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const visibility = await setPlayersVisibility(req.body || {});
      return res.status(200).json({ visibility });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}
