// Legacy avatar proxy kept for compatibility. Profile UI now uses Discord CDN URLs directly.
export default async function handler(req, res) {
  const { id, avatar, size = '128' } = req.query;
  if (!/^\d{5,25}$/.test(String(id || ''))) return res.status(400).send('Invalid Discord user id');
  const hash = avatar ? String(avatar) : '';
  if (hash && !/^[a-zA-Z0-9_]+$/.test(hash)) return res.status(400).send('Invalid avatar hash');

  let n = Number(size);
  if (![32, 64, 96, 128, 256, 512].includes(n)) n = 128;

  let index = 0;
  try { index = Number((BigInt(id) >> 22n) % 6n); } catch {}
  const url = hash
    ? `https://cdn.discordapp.com/avatars/${id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=${n}`
    : `https://cdn.discordapp.com/embed/avatars/${index}.png`;

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!upstream.ok) return res.status(upstream.status).send('Avatar unavailable');
    const type = upstream.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(502).send('Avatar proxy failed');
  }
}
