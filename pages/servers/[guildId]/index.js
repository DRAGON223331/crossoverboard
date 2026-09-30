import { useEffect, useState } from 'react';
import { getSession } from '../../../lib/session';
import { getGuildEntry, canOpenPremiumTab } from '../../../lib/premium';
import { isOwner } from '../../../lib/owner';
import { fetchGuildTextChannels, fetchUserGuilds } from '../../../lib/discord';
import { getGuildSettings } from '../../../lib/redis';
import { useLanguage } from '../../../lib/i18n';
import LanguageSwitcher from '../../../components/LanguageSwitcher';

export async function getServerSideProps({ req, params }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };

  const { guildId } = params;
  // Fetch the user's guild list once and reuse it for both authorization and
  // the display name. The previous flow fetched /users/@me/guilds twice.
  const [settings, channels, userGuilds] = await Promise.all([
    getGuildSettings(guildId),
    fetchGuildTextChannels(guildId),
    fetchUserGuilds(session.accessToken),
  ]);
  const guild = userGuilds.find((g) => g.id === guildId);
  const permissions = guild ? BigInt(guild.permissions || '0') : 0n;
  const canManage = guild && ((permissions & 0x8n) === 0x8n || (permissions & 0x20n) === 0x20n);
  if (!canManage) return { redirect: { destination: '/servers', permanent: false } };

  const premiumEntry = await getGuildEntry(guildId);
  const showPremiumTab = canOpenPremiumTab(premiumEntry, {
    userId: session.user.id,
    isServerOwner: guild.owner === true,
    isBotOwner: isOwner(session),
    inGuild: true,
  });

  const roomHealth = null;
  const automod = null;

  return {
    props: {
      user: session.user,
      guildId,
      guildName: guild?.name || 'This server',
      initialSettings: settings,
      channels: channels.map((c) => ({ id: c.id, name: c.name })),
      initialRoomHealth: roomHealth,
      initialAutomod: automod,
      showPremiumTab,
    },
  };
}

export default function GuildSettings({ user, guildId, guildName, initialSettings, channels, initialRoomHealth, initialAutomod, showPremiumTab }) {
  const { t } = useLanguage();
  const [prefix, setPrefix] = useState(initialSettings.prefix);
  const [language, setLanguage] = useState(initialSettings.language);
  const [onlineEnabled, setOnlineEnabled] = useState(initialSettings.onlineEnabled);
  const [channelId, setChannelId] = useState(initialSettings.room.channelId || '');
  const [renameTo, setRenameTo] = useState(initialSettings.room.name);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }
  const [saving, setSaving] = useState(false);
  const [roomHealth, setRoomHealth] = useState(initialRoomHealth);
  const [automod, setAutomod] = useState(initialAutomod);
  const [loadingHealth, setLoadingHealth] = useState(!initialRoomHealth);
  const [actionBusy, setActionBusy] = useState(null);

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
      if (data.settings) {
        setPrefix(data.settings.prefix);
        setLanguage(data.settings.language);
        setOnlineEnabled(data.settings.onlineEnabled);
        setChannelId(data.settings.room.channelId || '');
        setRenameTo(data.settings.room.name || '');
      }
      if (data.roomHealth) setRoomHealth(data.roomHealth);
      if (data.automod) setAutomod(data.automod);
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action, successText) {
    setActionBusy(action);
    setStatus(null);
    try {
      const res = await fetch(`/api/settings/${guildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed.');
      if (data.settings) {
        setPrefix(data.settings.prefix);
        setLanguage(data.settings.language);
        setOnlineEnabled(data.settings.onlineEnabled);
        setChannelId(data.settings.room.channelId || '');
        setRenameTo(data.settings.room.name || '');
      }
      if (data.roomHealth) setRoomHealth(data.roomHealth);
      if (data.automod) setAutomod(data.automod);
      setStatus({ type: 'ok', text: successText });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
      if (err.message.toLowerCase().includes('already exists')) {
        refreshHealth();
      }
    } finally {
      setActionBusy(null);
    }
  }

  async function refreshHealth() {
    setLoadingHealth(true);
    try {
      const res = await fetch(`/api/settings/${guildId}`);
      const data = await res.json();
      if (res.ok) {
        setRoomHealth(data.roomHealth || null);
        setAutomod(data.automod || null);
      }
    } catch {} finally {
      setLoadingHealth(false);
    }
  }

  useEffect(() => {
    refreshHealth();
  }, [guildId]);

  return (
    <div className="shell">
      <div className="topline fade-in-down">
        <div className="brand">
          <img src="/crossover-logo.png" alt="" className="brand-logo" />
          Crossover <span>{t.brandSuffix}</span>
        </div>
        <div className="topline-right">
          <div className="top-actions">
            <a className="btn secondary top-invite" href="/api/invite">{t.addCrossover}</a>
            <LanguageSwitcher />
          </div>
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
          {showPremiumTab && <a className="tab" href={`/servers/${guildId}/premium`}>💎 {t.tabPremium}</a>}
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


            <div className="health-grid">
              <div className="health-card">
                <div className="health-card-head">
                  <div>
                    <div className="health-kicker">🩺 {t.roomHealthTitle}</div>
                    <h2>{roomHealth?.channelName ? `#${roomHealth.channelName}` : t.roomHealthMissing}</h2>
                  </div>
                  <span className={`health-pill ${roomHealth?.status === 'healthy' ? 'healthy' : roomHealth?.status === 'permissions' ? 'warning' : 'danger'}`}>
                    {loadingHealth ? t.checking : roomHealth?.status === 'healthy' ? t.healthHealthy : roomHealth?.status === 'permissions' ? t.healthPermissions : t.healthMissing}
                  </span>
                </div>
                <p className="hint no-top">
                  {roomHealth?.message || t.roomHealthChecking}
                </p>
                {roomHealth && roomHealth.status !== 'healthy' && (
                  <div className="health-perms">
                    <span>View Channel {roomHealth.viewChannel ? '✓' : '✕'}</span>
                    <span>Send Messages {roomHealth.sendMessages ? '✓' : '✕'}</span>
                  </div>
                )}
                <div className="health-actions">
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={refreshHealth}
                    disabled={loadingHealth}
                  >↻ {t.checkAgain}</button>
                  {roomHealth?.status === 'missing' && (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => runAction('recreateRoom', t.roomRecreated)}
                      disabled={actionBusy === 'recreateRoom'}
                    >♻️ {actionBusy === 'recreateRoom' ? t.working : t.recreateRoom}</button>
                  )}
                </div>
              </div>

              <div className="health-card">
                <div className="health-card-head">
                  <div>
                    <div className="health-kicker">🚫 {t.automodTitle}</div>
                    <h2>{t.automodCustomWords}</h2>
                  </div>
                  <span className={`health-pill ${automod?.enabled === true ? 'healthy' : automod?.enabled === false ? 'neutral' : 'warning'}`}>
                    {automod?.enabled === true ? t.enabled : automod?.enabled === false ? t.disabled : t.unavailable}
                  </span>
                </div>
                <p className="hint no-top">{t.automodReadonly}</p>
                {automod?.error && <p className="hint no-top">{automod.error}</p>}
              </div>
            </div>

            <div className="save-bar">
              <button className="btn glow" type="submit" disabled={saving}>
                {saving ? t.saving : t.saveChanges}
              </button>
            </div>
          </form>
          <section className="danger-zone">
            <div className="danger-line"><span>{t.dangerZone}</span></div>
            <p className="danger-copy">{t.dangerLede}</p>
            <div className="danger-grid">
              <button type="button" className="danger-btn" disabled={actionBusy} onClick={() => runAction('resetPrefix', t.resetDone)}>{t.resetPrefix}</button>
              <button type="button" className="danger-btn" disabled={actionBusy} onClick={() => runAction('resetLanguage', t.resetDone)}>{t.resetLanguage}</button>
              <button type="button" className="danger-btn" disabled={actionBusy} onClick={() => runAction('resetRoom', t.resetDone)}>{t.resetRoom}</button>
              <button type="button" className="danger-btn" disabled={actionBusy} onClick={() => runAction('resetOnline', t.resetDone)}>{t.resetOnline}</button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
