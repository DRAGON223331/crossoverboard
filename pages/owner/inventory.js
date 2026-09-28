import { useState, useRef, useCallback } from 'react';
import { getSession } from '../../lib/session';
import { isOwner } from '../../lib/owner';
import { SKINS, TITLES, CARDS } from '../../lib/storeCatalog';
import { useLanguage } from '../../lib/i18n';
import LanguageSwitcher from '../../components/LanguageSwitcher';

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };
  if (!isOwner(session)) return { redirect: { destination: '/servers', permanent: false } };

  return { props: { user: session.user } };
}

export default function OwnerInventory({ user }) {
  const { t, lang } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null); // { userId, name }
  const [inventory, setInventory] = useState(null);
  const [pointsInput, setPointsInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const searchTimer = useRef(null);

  const runSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/players?limit=8&offset=0&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok) setResults(data.rows);
    } finally {
      setSearching(false);
    }
  }, []);

  function onQueryChange(value) {
    setQuery(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => runSearch(value), 280);
  }

  async function selectPlayer(row) {
    setStatus(null);
    setSelected({ userId: row.userId, name: row.name });
    setInventory(null);
    try {
      const res = await fetch(`/api/owner/inventory?userId=${encodeURIComponent(row.userId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInventory(data.inventory);
      setPointsInput(String(data.inventory.points));
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    }
  }

  async function post(body) {
    const res = await fetch('/api/owner/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selected.userId, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }

  async function runAction(body, okText) {
    setBusy(true);
    setStatus(null);
    try {
      const data = await post(body);
      setInventory(data.inventory);
      setPointsInput(String(data.inventory.points));
      setStatus({ type: 'ok', text: okText });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
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

      <a href="/servers" className="back-link fade-in-up">← {t.allServers}</a>
      <h1 className="page-title fade-in-up d1">{t.ownerInventoryTitle}</h1>
      <p className="lede fade-in-up d1">{t.ownerInventoryLede}</p>

      <div className="panel fade-in-up d2">
        <div className="field" style={{ marginBottom: 0 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t.playersSearchPlaceholder}
          />
        </div>
        {searching && <p className="hint">{t.playersLoadingMore}</p>}
        {results.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {results.map((row) => (
              <div className="toggle-row" key={row.userId}>
                <div>
                  <strong>{row.name}</strong>
                  <span className="hint no-top" style={{ display: 'block' }}>{t.playersLevel} {row.level} · {row.points} {t.homePoints}</span>
                </div>
                <button type="button" className="btn secondary" onClick={() => selectPlayer(row)}>
                  {t.ownerInventorySelect}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {status && <div className={`banner ${status.type}`}>{status.text}</div>}

      {selected && inventory && (
        <div className="panel fade-in-up d3" style={{ marginTop: 18 }}>
          <h2 style={{ marginTop: 0 }}>{selected.name} <span className="hint no-top">· <code className="mono">{selected.userId}</code></span></h2>

          <div className="field">
            <label>{t.ownerInventoryPoints}</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                inputMode="numeric"
                value={pointsInput}
                onChange={(e) => setPointsInput(e.target.value.replace(/[^0-9]/g, ''))}
              />
              <button
                type="button"
                className="btn glow"
                disabled={busy || pointsInput === ''}
                onClick={() => runAction({ action: 'setPoints', points: Number(pointsInput) }, t.ownerInventorySaved)}
              >
                {t.saveChanges}
              </button>
            </div>
          </div>

          <h3>{t.storeSectionSkins}</h3>
          {Object.entries(SKINS).map(([id, skin]) => {
            const owned = inventory.items.includes(id);
            const equipped = inventory.equipped?.xo === id;
            return (
              <div className="toggle-row" key={id}>
                <div>{lang === 'ar' ? skin.ar : skin.en} — XO {equipped && <span className="hint no-top">({t.storeEquipped})</span>}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!owned && (
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => runAction({ action: 'grant', itemId: id }, t.ownerInventoryGranted)}>{t.ownerInventoryGrant}</button>
                  )}
                  {owned && !equipped && (
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => runAction({ action: 'equip', itemId: id }, t.ownerInventoryEquipped)}>{t.storeEquip}</button>
                  )}
                  {owned && (
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => runAction({ action: 'revoke', itemId: id }, t.ownerInventoryRevoked)}>{t.ownerInventoryRevoke}</button>
                  )}
                </div>
              </div>
            );
          })}

          <h3>{t.storeSectionTitles}</h3>
          {Object.entries(TITLES).map(([id, title]) => {
            const owned = inventory.items.includes(id);
            const equipped = inventory.equipped?.title === id;
            return (
              <div className="toggle-row" key={id}>
                <div>{title.icon} {lang === 'ar' ? title.ar : title.en} {equipped && <span className="hint no-top">({t.storeEquipped})</span>}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!owned && (
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => runAction({ action: 'grant', itemId: id }, t.ownerInventoryGranted)}>{t.ownerInventoryGrant}</button>
                  )}
                  {owned && !equipped && (
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => runAction({ action: 'equip', itemId: id }, t.ownerInventoryEquipped)}>{t.storeEquip}</button>
                  )}
                  {owned && equipped && (
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => runAction({ action: 'unequip', slot: 'title' }, t.ownerInventoryEquipped)}>{t.storeUnequip}</button>
                  )}
                  {owned && (
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => runAction({ action: 'revoke', itemId: id }, t.ownerInventoryRevoked)}>{t.ownerInventoryRevoke}</button>
                  )}
                </div>
              </div>
            );
          })}

          <h3>{t.storeSectionCards}</h3>
          {Object.entries(CARDS).map(([id, card]) => {
            const owned = inventory.items.includes(id);
            const equipped = inventory.equipped?.card === id;
            return (
              <div className="toggle-row" key={id}>
                <div>{card.icon} {lang === 'ar' ? card.ar : card.en} {equipped && <span className="hint no-top">({t.storeEquipped})</span>}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!owned && (
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => runAction({ action: 'grant', itemId: id }, t.ownerInventoryGranted)}>{t.ownerInventoryGrant}</button>
                  )}
                  {owned && !equipped && (
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => runAction({ action: 'equip', itemId: id }, t.ownerInventoryEquipped)}>{t.storeEquip}</button>
                  )}
                  {owned && equipped && (
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => runAction({ action: 'unequip', slot: 'card' }, t.ownerInventoryEquipped)}>{t.storeUnequip}</button>
                  )}
                  {owned && (
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => runAction({ action: 'revoke', itemId: id }, t.ownerInventoryRevoked)}>{t.ownerInventoryRevoke}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
