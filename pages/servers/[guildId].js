import { useState } from 'react';
import { getSession } from '../../lib/session';
import { userCanManageGuild, fetchGuildTextChannels, fetchUserGuilds } from '../../lib/discord';
import { getGuildSettings, getGuildStats, getGuildLeaderboard } from '../../lib/redis';
import { useLanguage } from '../../lib/i18n';
import LanguageSwitcher from '../../components/LanguageSwitcher';

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
  const { t } = useLanguage();
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
      if (!res.ok) throw new Error(data.error || t.saveFailed);
      setStatus({ type: 'ok', text: t.savedOk });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="shell">
      <div className="topline fade-in-down">
        <div className="brand">
          Crossover <span>{t.brandSuffix}</span>
        </div>
        <div className="topline-right">
          <LanguageSwitcher />
          <div className="user-chip">
            {user.username}
            <a href="/api/auth/logout">{t.signOut}</a>
          </div>
        </div>
      </div>

      <a href="/servers" className="back-link fade-in-up">← {t.allServers}</a>
      <h1 className="page-title fade-in-up d1">{guildName}</h1>
      <p className="lede fade-in-up d1">{t.changesLive}</p>

      <div className="stats-row fade-in-up d2">
        <div className="stat-box">
          <div className="stat-num">{stats.today}</div>
          <div className="stat-label">{t.gamesToday}</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{stats.last7Days}</div>
          <div className="stat-label">{t.last7Days}</div>
        </div>
      </div>

      <div className="field fade-in-up d2">
        <label>{t.leaderboard}</label>
        {leaderboard.rows.length === 0 ? (
          <div className="empty">{t.noScores}</div>
        ) : (
          <table className="board">
            <tbody>
              {leaderboard.rows.map((row, i) => (
                <tr key={row.userId} className="stagger-in" style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}>
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
          <div className="hint">{t.rankedTotal(leaderboard.total, leaderboard.rows.length)}</div>
        )}
      </div>

      {status && <div className={`banner ${status.type} fade-in-up`}>{status.text}</div>}

      <form onSubmit={handleSave} className="fade-in-up d3">
        <div className="field">
          <label htmlFor="prefix">{t.commandPrefix}</label>
          <input
            id="prefix"
            type="text"
            value={prefix}
            maxLength={5}
            onChange={(e) => setPrefix(e.target.value)}
          />
          <div className="hint">{t.prefixExample(prefix || '!')}</div>
        </div>

        <div className="field">
          <label htmlFor="language">{t.language}</label>
          <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">{t.english}</option>
            <option value="ar">{t.arabic}</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="channel">{t.gameRoomChannel}</label>
          <select
            id="channel"
            value={channelId}
            onChange={(e) => {
              setChannelId(e.target.value);
              const chosen = channels.find((c) => c.id === e.target.value);
              if (chosen) setRenameTo(chosen.name);
            }}
          >
            <option value="">{t.unchanged}</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
          <div className="hint">{t.channelHint}</div>
        </div>

        {channelId && (
          <div className="field fade-in-up">
            <label htmlFor="renameTo">{t.renameTo}</label>
            <input id="renameTo" type="text" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
          </div>
        )}

        <div className="toggle-row">
          <div>
            <h2>{t.crossServerPlay}</h2>
            <div className="hint no-top">{t.crossServerHint}</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={onlineEnabled} onChange={(e) => setOnlineEnabled(e.target.checked)} />
            <span className="track" />
          </label>
        </div>

        <div className="save-bar">
          <button className="btn glow" type="submit" disabled={saving}>
            {saving ? t.saving : t.saveChanges}
          </button>
        </div>
      </form>
    </div>
  );
}
