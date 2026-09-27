import { useState, useRef, useCallback } from 'react';
import { getSession } from '../lib/session';
import { isOwner } from '../lib/owner';
import { getPlayersDirectory, getPlayersVisibility } from '../lib/redis';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';

// First paint only ever renders this many cards server-side. Everything past
// that comes from /api/players on demand ("load more" / search), so a large
// player base never turns into one giant SSR payload — the page that has to
// be fast to first paint stays small no matter how many people have played.
const PAGE_SIZE = 30;

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };

  const [directory, visibility] = await Promise.all([
    getPlayersDirectory({ limit: PAGE_SIZE, offset: 0 }),
    getPlayersVisibility(),
  ]);

  return {
    props: {
      user: session.user,
      owner: isOwner(session),
      initialPlayers: directory.rows,
      initialTotal: directory.total,
      visibility,
    },
  };
}

function initials(name) {
  return String(name || '?').trim().slice(0, 1).toUpperCase() || '?';
}

function PlayerCard({ player, visibility, t, index }) {
  return (
    <article className="player-card stagger-in" style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}>
      <div className="player-card-head">
        <div className="player-card-avatar">{initials(player.name)}</div>
        <div className="player-card-name">
          <strong title={player.name}>{player.name}</strong>
          {visibility.userId && <span className="player-card-id mono">{player.userId}</span>}
        </div>
        <span className="player-card-level">{t.playersLevel} {player.level}</span>
      </div>
      <div className="player-card-stats">
        {visibility.points && <span><b>{player.points}</b> {t.homePoints}</span>}
        {visibility.record && <span><b>{player.wins}/{player.losses}/{player.draws}</b> {t.playersRecord}</span>}
        {visibility.winRate && <span><b>{player.winRate}%</b> {t.playersWinRate}</span>}
        {visibility.totalGames && <span><b>{player.totalGames}</b> {t.playersGames}</span>}
        {visibility.streak && <span><b>{player.best}</b> {t.playersStreak}</span>}
        {visibility.achievements && <span><b>{player.achievementCount}</b> {t.playersAchievements}</span>}
      </div>
    </article>
  );
}

function VisibilitySettings({ visibility, setVisibility, t }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const fields = [
    { key: 'userId', label: t.playersFieldUserId },
    { key: 'points', label: t.playersFieldPoints },
    { key: 'record', label: t.playersFieldRecord },
    { key: 'winRate', label: t.playersFieldWinRate },
    { key: 'totalGames', label: t.playersFieldTotalGames },
    { key: 'streak', label: t.playersFieldStreak },
    { key: 'achievements', label: t.playersFieldAchievements },
  ];

  async function toggle(key, checked) {
    const next = { ...visibility, [key]: checked };
    setVisibility(next);
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/players-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: checked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.playersSettingsSaveFailed);
      setVisibility(data.visibility);
      setStatus({ type: 'ok', text: t.playersSettingsSaved });
    } catch (err) {
      setVisibility(visibility);
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel fade-in-up d2">
      <button type="button" className="btn secondary" onClick={() => setOpen(!open)}>
        ⚙️ {t.playersSettingsToggle}
      </button>

      {open && (
        <div className="fade-in-up" style={{ marginTop: 18 }}>
          <h2 style={{ marginTop: 0 }}>{t.playersSettingsTitle}</h2>
          <p className="lede">{t.playersSettingsLede}</p>

          <div className="toggle-row players-locked-row">
            <div><strong>{t.playersLevel} · Display Name</strong></div>
            <span className="hint no-top">{t.playersAlwaysOn}</span>
          </div>

          <div className="players-settings-grid">
            {fields.map((field) => (
              <div className="toggle-row" key={field.key}>
                <div>{field.label}</div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={Boolean(visibility[field.key])}
                    disabled={saving}
                    onChange={(e) => toggle(field.key, e.target.checked)}
                  />
                  <span className="track" />
                </label>
              </div>
            ))}
          </div>

          {status && <div className={`banner ${status.type}`} style={{ marginTop: 16 }}>{status.text}</div>}
        </div>
      )}
    </div>
  );
}

export default function Players({ user, owner, initialPlayers, initialTotal, visibility: initialVisibility }) {
  const { t } = useLanguage();
  const [players, setPlayers] = useState(initialPlayers);
  const [total, setTotal] = useState(initialTotal);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [query, setQuery] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  const runSearch = useCallback(async (q) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/players?limit=${PAGE_SIZE}&offset=0&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok) {
        setPlayers(data.rows);
        setTotal(data.total);
      }
    } catch {
      // Leave the current list showing rather than clearing it on a network hiccup.
    } finally {
      setSearching(false);
    }
  }, []);

  function onQueryChange(value) {
    setQuery(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => runSearch(value), 280);
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/players?limit=${PAGE_SIZE}&offset=${players.length}&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok) {
        setPlayers((prev) => [...prev, ...data.rows]);
        setTotal(data.total);
      }
    } finally {
      setLoadingMore(false);
    }
  }

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

      <NavBar active="players" />
      <h1 className="page-title fade-in-up d1">{t.playersTitle}</h1>
      <p className="lede fade-in-up d1">{t.playersLede}</p>

      {owner && (
        <div style={{ marginBottom: 18 }}>
          <VisibilitySettings visibility={visibility} setVisibility={setVisibility} t={t} />
        </div>
      )}

      <div className="players-toolbar fade-in-up d2">
        <div className="players-search">
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t.playersSearchPlaceholder}
          />
        </div>
      </div>

      <div className="panel fade-in-up d3">
        {players.length === 0 ? (
          <div className="players-empty">{query ? t.playersNoResults : t.playersNoPlayers}</div>
        ) : (
          <div className="players-grid">
            {players.map((player, i) => (
              <PlayerCard key={player.userId} player={player} visibility={visibility} t={t} index={i} />
            ))}
          </div>
        )}

        {players.length > 0 && (
          <div className="players-hint">
            {searching ? t.playersLoadingMore : t.playersShownOf(players.length, total)}
          </div>
        )}

        {players.length < total && (
          <div className="players-load-more">
            <button type="button" className="btn secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? t.playersLoadingMore : t.playersLoadMore}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
