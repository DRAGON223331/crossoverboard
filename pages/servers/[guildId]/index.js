import { useState } from 'react';
import { getSession } from '../../../lib/session';
import { userCanManageGuild, fetchGuildTextChannels, fetchUserGuilds } from '../../../lib/discord';
import { getGuildSettings } from '../../../lib/redis';
import { useLanguage } from '../../../lib/i18n';
import LanguageSwitcher from '../../../components/LanguageSwitcher';

export async function getServerSideProps({ req, params }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };

  const { guildId } = params;
  const allowed = await userCanManageGuild(session.accessToken, guildId);
  if (!allowed) return { redirect: { destination: '/servers', permanent: false } };

  const [settings, channels, userGuilds] = await Promise.all([
    getGuildSettings(guildId),
    fetchGuildTextChannels(guildId),
    fetchUserGuilds(session.accessToken),
  ]);
  const guild = userGuilds.find((g) => g.id === guildId);

  return {
    props: {
      user: session.user,
      guildId,
      guildName: guild?.name || 'This server',
      initialSettings: settings,
      channels: channels.map((c) => ({ id: c.id, name: c.name })),
    },
  };
}

export default function GuildSettings({ user, guildId, guildName, initialSettings, channels }) {
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
            <a href="/profile" className="user-link">{user.username}</a>
            <a href="/api/auth/logout">{t.signOut}</a>
          </div>
        </div>
      </div>

      <a href="/servers" className="back-link fade-in-up">← {t.allServers}</a>
      <h1 className="page-title fade-in-up d1">{guildName}</h1>
      <p className="lede fade-in-up d1">{t.changesLive}</p>

      <div className="guild-layout fade-in-up d2">
        <nav className="guild-sidebar">
          <span className="tab active">⚙️ {t.tabManage}</span>
          <a className="tab" href={`/servers/${guildId}/leaderboard`}>🏆 {t.tabLeaderboard}</a>
        </nav>

        <div className="guild-content">
          {status && <div className={`banner ${status.type} fade-in-up`}>{status.text}</div>}

          <form onSubmit={handleSave} className="panel">
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
      </div>
    </div>
  );
}
