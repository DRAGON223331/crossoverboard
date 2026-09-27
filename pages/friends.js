import { useState, useRef, useCallback } from 'react';
import { getSession } from '../lib/session';
import { getFriends } from '../lib/redis';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };

  const friends = await getFriends(session.user.id);

  return {
    props: { user: session.user, initialFriends: friends },
  };
}

export default function Friends({ user, initialFriends }) {
  const { t } = useLanguage();
  const [friends, setFriends] = useState(initialFriends);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [status, setStatus] = useState(null);
  const searchTimer = useRef(null);

  const friendIds = new Set(friends.map((f) => f.id));

  const runSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/players?limit=8&offset=0&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok) setResults(data.rows.filter((row) => row.userId !== user.id));
    } catch {
      // Leave the current results showing rather than clearing them on a network hiccup.
    } finally {
      setSearching(false);
    }
  }, [user.id]);

  function onQueryChange(value) {
    setQuery(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => runSearch(value), 280);
  }

  async function post(body) {
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }

  async function handleAdd(friendId) {
    setBusyId(friendId);
    setStatus(null);
    try {
      const data = await post({ action: 'add', friendId });
      setFriends(data.friends);
      setStatus({ type: 'ok', text: t.friendsAdded });
    } catch (err) {
      setStatus({ type: 'error', text: err.message || t.friendsAddFailed });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(friendId) {
    setBusyId(friendId);
    setStatus(null);
    try {
      const data = await post({ action: 'remove', friendId });
      setFriends(data.friends);
      setStatus({ type: 'ok', text: t.friendsRemoved });
    } catch (err) {
      setStatus({ type: 'error', text: err.message || t.friendsRemoveFailed });
    } finally {
      setBusyId(null);
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

      <NavBar active="friends" />
      <h1 className="page-title fade-in-up d1">{t.friendsTitle}</h1>
      <p className="lede fade-in-up d1">{t.friendsLede}</p>

      {status && <div className={`banner ${status.type}`}>{status.text}</div>}

      <div className="panel fade-in-up d2">
        <h2 style={{ marginTop: 0 }}>{t.friendsAddTitle}</h2>
        <div className="field" style={{ marginBottom: 0 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t.friendsSearchPlaceholder}
          />
        </div>

        {searching && <p className="hint">{t.playersLoadingMore}</p>}

        {!searching && query.trim() && results.length === 0 && (
          <p className="hint">{t.playersNoResults}</p>
        )}

        {results.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {results.map((row) => {
              const already = friendIds.has(row.userId);
              return (
                <div className="toggle-row" key={row.userId}>
                  <div>
                    <strong>{row.name}</strong>
                    <span className="hint no-top" style={{ display: 'block' }}>{t.playersLevel} {row.level}</span>
                  </div>
                  {already ? (
                    <span className="hint no-top">{t.friendsAlready}</span>
                  ) : (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={busyId === row.userId}
                      onClick={() => handleAdd(row.userId)}
                    >
                      {busyId === row.userId ? t.friendsAdding : t.friendsAddButton}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel fade-in-up d3" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>{t.friendsListTitle}</h2>
        {friends.length === 0 ? (
          <div className="empty">{t.friendsEmpty}</div>
        ) : (
          friends.map((f) => (
            <div className="toggle-row" key={f.id}>
              <div>
                <strong>{f.username ? `@${f.username}` : f.id}</strong>
                {f.at ? <span className="hint no-top" style={{ display: 'block' }}>{new Date(f.at).toLocaleDateString()}</span> : null}
              </div>
              <button
                type="button"
                className="btn secondary"
                disabled={busyId === f.id}
                onClick={() => handleRemove(f.id)}
              >
                {busyId === f.id ? t.friendsRemoving : t.friendsRemoveButton}
              </button>
            </div>
          ))
        )}
      </div>

      <p className="players-hint">{t.friendsFootnote}</p>
    </div>
  );
}
