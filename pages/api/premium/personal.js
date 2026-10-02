import { getSession } from '../../../lib/session';
import { getPersonalPremium, updatePersonalPremium } from '../../../lib/personalPremium';

export const config = {
  api: { bodyParser: { sizeLimit: '500kb' } },
};

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in.' });

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ overview: await getPersonalPremium(session.user.id) });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).end();
    }

    const body = req.body || {};
    if (body.action === 'save') {
      const overview = await updatePersonalPremium(session.user.id, body);
      return res.status(200).json({ overview });
    }
    if (body.action === 'toggle') {
      const overview = await updatePersonalPremium(session.user.id, { enabled: Boolean(body.enabled) });
      return res.status(200).json({ overview });
    }
    if (body.action === 'reset') {
      const overview = await updatePersonalPremium(session.user.id, {
        color: '#3DFF8A',
        badge: null,
        title: '',
        enabled: false,
        background: 'remove',
      });
      return res.status(200).json({ overview });
    }

    return res.status(400).json({ error: 'Unknown Premium action.' });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message || 'Could not save Premium settings.' });
  }
}
