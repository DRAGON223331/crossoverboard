import { useState } from 'react';
import { getSession } from '../../../lib/session';
import { getUserGuildAccess } from '../../../lib/discord';
import { getPremiumOverview, getGuildEntry, canOpenPremiumTab } from '../../../lib/premium';
import { isOwner } from '../../../lib/owner';
import { useLanguage } from '../../../lib/i18n';
import LanguageSwitcher from '../../../components/LanguageSwitcher';

export async function getServerSideProps({ req, params }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };

  const { guildId } = params;
  const access = await getUserGuildAccess(session.accessToken, guildId);
  const viewer = {
    userId: session.user.id,
    isServerOwner: access.isServerOwner,
    isBotOwner: isOwner(session),
    inGuild: access.inGuild,
  };

  // Premium settings are only for the server owner, the bot owner, and members the
  // owner added from the bot (`!premium add`). Manage Server alone is not enough.
  const entry = await getGuildEntry(guildId);
  if (!canOpenPremiumTab(entry, viewer)) {
    return { redirect: { destination: access.canManage ? `/servers/${guildId}` : '/servers', permanent: false } };
  }

  const overview = await getPremiumOverview(guildId, viewer);

  return { props: { user: session.user, guildId, guildName: access.name, overview } };
}

function fmtDate(ms, lang) {
  // Fixed timezone so the server render and the browser render always match.
  return new Date(ms).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function resolveColor(value, allValue, presets) {
  const v = value || allValue || 'default';
  if (presets[v]) return presets[v].color;
  return /^#[0-9a-f]{6}$/i.test(v) ? v : presets.default.color;
}

function ThemeRow({ scope, label, value, allValue, presets, disabled, onChange, t }) {
  const isHex = typeof value === 'string' && value.startsWith('#');
  const activeKey = value || (scope === 'all' ? 'default' : null);
  const shown = resolveColor(value, allValue, presets);
  return (
    <div className="theme-row">
      <div className="theme-label">
        <span className="theme-dot" style={{ background: shown }} />
        {label}
      </div>
      <div className="theme-options">
        {scope !== 'all' && (
          <button type="button" className={`chip ${!value ? 'active' : ''}`} disabled={disabled} onClick={() => onChange(null)}>
            {t.premThemeFollow}
          </button>
        )}
        {Object.entries(presets).map(([key, preset]) => (
          <button
            key={key}
            type="button"
            className={`swatch ${activeKey === key ? 'active' : ''}`}
            style={{ background: preset.color }}
            title={preset.name}
            aria-label={preset.name}
            disabled={disabled}
            onClick={() => onChange(key)}
          />
        ))}
        <label
          className={`swatch custom ${isHex ? 'active' : ''} ${disabled ? 'is-disabled' : ''}`}
          style={isHex ? { background: value } : undefined}
          title={t.premThemeCustom}
        >
          <input
            type="color"
            value={shown.toLowerCase()}
            disabled={disabled}
            aria-label={t.premThemeCustom}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
          />
        </label>
      </div>
    </div>
  );
}

export default function GuildPremium({ user, guildId, guildName, overview }) {
  const { t, lang } = useLanguage();
  const [ov, setOv] = useState(overview);
  const [limits, setLimits] = useState(overview.limits);
  const [themes, setThemes] = useState(overview.themes);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }
  const [busy, setBusy] = useState(null);

  const locked = ov.status !== 'active';
  const canLimits = !locked && ov.access.limits;
  const canThemes = !locked && ov.access.themes;
  const readOnlyNotice = !locked && !ov.access.limits;

  async function call(action, payload, okText, busyKey) {
    setBusy(busyKey);
    setStatus(null);
    try {
      const res = await fetch(`/api/premium/${guildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setOv(data.overview);
      setStatus({ type: 'ok', text: okText });
      return data.overview;
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
      return null;
    } finally {
      setBusy(null);
    }
  }

  const limitsValid = Object.entries(ov.ranges).every(([game, { min, max }]) => {
    const raw = limits[game];
    const n = Number(raw);
    return raw !== '' && Number.isInteger(n) && n >= min && n <= max;
  });
  const limitsDirty = Object.keys(ov.ranges).some((game) => Number(limits[game]) !== ov.limits[game]);
  const themesDirty = JSON.stringify(themes) !== JSON.stringify(ov.themes);
  const hasAnyTheme = Object.values(themes).some(Boolean) || Object.values(ov.themes).some(Boolean);

  async function saveLimits() {
    const payload = { mafia: Number(limits.mafia), chairs: Number(limits.chairs) };
    const next = await call('saveLimits', { limits: payload }, t.premLimitsSaved, 'limits');
    if (next) setLimits(next.limits);
  }

  async function saveThemes(values, okText) {
    const next = await call('saveThemes', { themes: values }, okText, 'themes');
    if (next) setThemes(next.themes);
  }

  const gameRows = [
    { game: 'mafia', icon: '🕵️', label: t.premMafia },
    { game: 'chairs', icon: '🪑', label: t.premChairs },
  ];

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
      <p className="lede fade-in-up d1">{t.premLede}</p>

      <div className="guild-layout fade-in-up d2">
        <nav className="guild-sidebar">
          <a className="tab" href={`/servers/${guildId}`}>⚙️ {t.tabManage}</a>
          <a className="tab" href={`/servers/${guildId}/leaderboard`}>🏆 {t.tabLeaderboard}</a>
          <span className="tab active">💎 {t.tabPremium}{locked ? ' 🔒' : ''}</span>
        </nav>

        <div className="guild-content">
          {status && <div className={`banner ${status.type} fade-in-up`}>{status.text}</div>}
          {readOnlyNotice && <div className="banner info">{t.premOwnerOnly}</div>}

          <div className="panel prem-status">
            <div>
              <div className="prem-kicker">💎 {t.premTitle}</div>
              <div className="prem-status-line">
                {ov.status === 'active' && (ov.until ? t.premExpires(fmtDate(ov.until, lang)) : t.premPermanent)}
                {ov.status === 'expired' && t.premLockedExpired(fmtDate(ov.until, lang))}
                {ov.status === 'none' && t.premLockedNone}
              </div>
            </div>
            <span className={`health-pill ${ov.status === 'active' ? 'healthy' : ov.status === 'expired' ? 'warning' : 'neutral'}`}>
              {ov.status === 'active' ? t.premActive : ov.status === 'expired' ? t.premExpired : t.premNone}
            </span>
          </div>

          <div className={`prem-wrap ${locked ? 'locked' : ''}`}>
            {locked && (
              <div className="prem-lock" role="status">
                <div className="prem-lock-card">
                  <div className="prem-lock-icon">🔒</div>
                  <strong>{t.premLockedTitle}</strong>
                </div>
              </div>
            )}

            <div className="prem-body" aria-disabled={locked}>
              {/* ── Allowed members ─────────────────────────────── */}
              <section className="panel prem-section">
                <h2>👥 {t.premMembersTitle}</h2>
                <p className="prem-hint">{t.premMembersHint}</p>

                <p className="prem-hint">{t.premMembersBotOnly}</p>

                <div className="member-list">
                  {ov.members.length === 0 && <div className="prem-hint">{t.premNoMembers}</div>}
                  {ov.members.map((m) => (
                    <div className="member-row" key={m.id}>
                      <div className="member-names">
                        <strong>{m.tag || m.id}</strong>
                        <span>
                          {m.id}
                          {m.at ? ` · ${t.premAddedOn(fmtDate(m.at, lang))}` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Player limits ───────────────────────────────── */}
              <section className="panel prem-section">
                <h2>🎮 {t.premLimitsTitle}</h2>
                <p className="prem-hint">{t.premLimitsHint}</p>
                {gameRows.map(({ game, icon, label }) => {
                  const { min, max } = ov.ranges[game];
                  const raw = limits[game];
                  return (
                    <div className="limit-row" key={game}>
                      <div className="limit-head">
                        <strong>{icon} {label}</strong>
                        <span className="prem-hint">{t.premPlayers(min, max)}</span>
                      </div>
                      <div className="limit-controls">
                        <input
                          type="range"
                          min={min}
                          max={max}
                          value={raw === '' ? min : Math.min(max, Math.max(min, Number(raw) || min))}
                          disabled={!canLimits}
                          onChange={(e) => setLimits({ ...limits, [game]: e.target.value })}
                        />
                        <input
                          type="number"
                          className="limit-num"
                          min={min}
                          max={max}
                          value={raw}
                          disabled={!canLimits}
                          onChange={(e) => setLimits({ ...limits, [game]: e.target.value })}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="prem-actions">
                  <button
                    className="btn glow"
                    type="button"
                    disabled={!canLimits || !limitsDirty || !limitsValid || busy === 'limits'}
                    onClick={saveLimits}
                  >
                    {busy === 'limits' ? t.saving : t.premLimitsSave}
                  </button>
                </div>
              </section>

              {/* ── Game colors ─────────────────────────────────── */}
              <section className="panel prem-section">
                <h2>🎨 {t.premThemesTitle}</h2>
                <p className="prem-hint">{t.premThemesHint}</p>
                {!locked && !canThemes && <p className="prem-hint">{t.premThemesNoAccess}</p>}
                <ThemeRow scope="all" label={t.premThemeAll} value={themes.all} allValue={themes.all} presets={ov.presets} disabled={!canThemes} t={t} onChange={(v) => setThemes({ ...themes, all: v })} />
                <ThemeRow scope="mafia" label={`🕵️ ${t.premMafia}`} value={themes.mafia} allValue={themes.all} presets={ov.presets} disabled={!canThemes} t={t} onChange={(v) => setThemes({ ...themes, mafia: v })} />
                <ThemeRow scope="chairs" label={`🪑 ${t.premChairs}`} value={themes.chairs} allValue={themes.all} presets={ov.presets} disabled={!canThemes} t={t} onChange={(v) => setThemes({ ...themes, chairs: v })} />
                <div className="prem-actions">
                  <button
                    className="btn glow"
                    type="button"
                    disabled={!canThemes || !themesDirty || busy === 'themes'}
                    onClick={() => saveThemes(themes, t.premThemesSaved)}
                  >
                    {busy === 'themes' ? t.saving : t.premThemesSave}
                  </button>
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={!canThemes || !hasAnyTheme || busy === 'themes'}
                    onClick={() => saveThemes({ all: null, mafia: null, chairs: null }, t.premThemesSaved)}
                  >
                    {t.premThemesReset}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
