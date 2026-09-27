import { useState } from 'react';
import { getSession } from '../../lib/session';
import { userCanManageGuild, fetchGuildTextChannels, fetchUserGuilds } from '../../lib/discord';
import { getGuildSettings, getGuildStats, getGuildLeaderboard } from '../../lib/redis';

export async function getServerSideProps({ req, params }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };

  const { guildId } = params;
  const allowed = await userCanManageGuild(session.accessToken, guildId);
  if (!allowed) return { redirect: { destination: '/servers', permanent: false } };

  const [settings, channels, userGuilds, stats, leaderboard] = await Promise.all([
    getGuildSettings(guildId),
    fetchGuildTextChannels(guildId),
    fetchUserGuilds(session.accessToken),
    getGuildStats(guildId),
    getGuildLeaderboard(guildId),
  ]);
  const guild = userGuilds.find((g) => g.id === guildId);

  return {
    props: {
      user: session.user,
      guildId,
      guildName: guild?.name || 'This server',
      initialSettings: settings,
      channels: channels.map((c) => ({ id: c.id, name: c.name })),
      stats,
      leaderboard,
    },
  };
}

export default function GuildSettings({ user, guildId, guildName, initialSettings, channels, stats, leaderboard }) {
  const [prefix, setPrefix] = useState(initialSettings.prefix);
  const [language, setLanguage] = useState(initialSettings.language);
  const [onlineEnabled, setOnlineEnabled] = useState(initialSettings.onlineEnabled);
  const [channelId, setChannelId] = useState(initialSettings.room.channelId || '');
  const [renameTo, setRenameTo] = useState(initialSettings.room.name);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/settings/${guildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, language, onlineEnabled, channelId: channelId || undefined, renameTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed.');
      setStatus({ type: 'ok', text: 'Saved. The bot picks this up within 10 seconds.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="shell">
      <div className="topline">
        <div className="brand">Crossover <span>Dashboard</span></div>
        <div className="user-chip">
          {user.username}
          <a href="/api/auth/logout">Sign out</a>
        </div>
      </div>

      <a href="/servers" style={{ fontSize: 16, color: 'var(--muted)' }}>← All servers</a>
      <h1 style={{ marginTop: 12 }}>{guildName}</h1>
      <p className="lede">Changes here go straight to the bot&apos;s database — no restart needed.</p>

      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-num">{stats.today}</div>
          <div className="stat-label">Games today</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{stats.last7Days}</div>
          <div className="stat-label">Last 7 days</div>
        </div>
      </div>

      <div className="field">
        <label>Leaderboard</label>
        {leaderboard.rows.length === 0 ? (
          <div className="empty">No one has scored here yet.</div>
        ) : (
          <table className="board">
            <tbody>
              {leaderboard.rows.map((row, i) => (
                <tr key={row.userId}>
                  <td className="rank">{i + 1}</td>
                  <td className="name">{row.name}</td>
                  <td className="pts">{row.points} pts</td>
                  <td className="wl">{row.w}W/{row.l}L</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {leaderboard.total > leaderboard.rows.length && (
          <div className="hint">{leaderboard.total} ranked players total — showing the top {leaderboard.rows.length}.</div>
        )}
      </div>

      {status && <div className={`banner ${status.type}`}>{status.text}</div>}

      <form onSubmit={handleSave}>
        <div className="field">
          <label htmlFor="prefix">Command prefix</label>
          <input id="prefix" type="text" value={prefix} maxLength={5}
            onChange={(e) => setPrefix(e.target.value)} />
          <div className="hint">Example: <code>{prefix || '!'}help</code></div>
        </div>

        <div className="field">
          <label htmlFor="language">Language</label>
          <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="channel">Game room channel</label>
          <select id="channel" value={channelId} onChange={(e) => {
            setChannelId(e.target.value);
            const chosen = channels.find((c) => c.id === e.target.value);
            if (chosen) setRenameTo(chosen.name);
          }}>
            <option value="">— unchanged —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>#{c.name}</option>
            ))}
          </select>
          <div className="hint">Points the bot at an existing text channel — it won&apos;t create one from here.</div>
        </div>

        {channelId && (
          <div className="field">
            <label htmlFor="renameTo">Rename that channel to</label>
            <input id="renameTo" type="text" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
          </div>
        )}

        <div className="toggle-row">
          <div>
            <h2>Cross-server play</h2>
            <div className="hint" style={{ marginTop: 0 }}>Lets this server&apos;s players match with other servers.</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={onlineEnabled} onChange={(e) => setOnlineEnabled(e.target.checked)} />
            <span className="track" />
          </label>
        </div>

        <div className="save-bar">
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}
