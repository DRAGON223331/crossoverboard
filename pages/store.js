import { useState } from 'react';
import { getSession } from '../lib/session';
import { getUserProfile, getUserInventory } from '../lib/redis';
import { SKINS, TITLES } from '../lib/storeCatalog';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };

  const [profile, inventory] = await Promise.all([
    getUserProfile(session.user.id),
    getUserInventory(session.user.id),
  ]);

  return {
    props: {
      user: session.user,
      initialPoints: profile?.points ?? 0,
      initialInventory: inventory,
    },
  };
}

function GiftModal({ item, name, onClose, onSent, t }) {
  const [targetId, setTargetId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gift', itemId: item.id, targetUserId: targetId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.storeGiftFailed);
      onSent(data.points);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="store-gift-overlay" onClick={onClose}>
      <div className="store-gift-modal fade-in-up" onClick={(e) => e.stopPropagation()}>
        <h3>{t.storeGiftTitle(name)}</h3>
        <p className="lede" style={{ marginBottom: 14 }}>{t.storeGiftLede}</p>
        <div className="field" style={{ marginBottom: 0 }}>
          <input
            type="text"
            placeholder={t.storeGiftIdPlaceholder}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          />
        </div>
        {error && <div className="banner error" style={{ marginTop: 14 }}>{error}</div>}
        <div className="store-gift-actions">
          <button type="button" className="btn glow" onClick={send} disabled={sending || !targetId.trim()}>
            {sending ? t.storeGiftSending : t.storeGiftSend}
          </button>
          <button type="button" className="btn secondary" onClick={onClose} disabled={sending}>
            {t.storeGiftCancel}
          </button>
        </div>
      </div>
    </div>
  );
}

function StoreItemCard({ item, points, inventory, t, onBuy, onEquip, onUnequip, onGift, busyId }) {
  const meta = t.storeItems[item.id] || { name: item.id, desc: '' };
  const owned = inventory.owned.includes(item.id);
  const equipped = item.category === 'skin' ? inventory.equippedSkin === item.id : inventory.equippedTitle === item.id;
  const canAfford = points >= item.price;
  const busy = busyId === item.id;

  return (
    <article className={`store-item-card fade-in-up${owned ? ' owned' : ''}`}>
      <div className="store-item-icon">{item.icon}</div>
      {equipped ? (
        <span className="store-badge equipped">{t.storeEquipped}</span>
      ) : owned ? (
        <span className="store-badge">{t.storeOwned}</span>
      ) : null}
      <div className="store-item-name">{meta.name}</div>
      <div className="store-item-desc">{meta.desc}</div>
      <div className="store-item-footer">
        <span className="store-item-price">{item.price === 0 ? t.storeFree : `${item.price} ${t.homePoints}`}</span>
        <div className="store-item-actions">
          {owned ? (
            !equipped && (
              <button type="button" className="btn secondary" disabled={busy} onClick={() => onEquip(item)}>
                {t.storeEquip}
              </button>
            )
          ) : (
            <>
              <button type="button" className="btn glow" disabled={busy || !canAfford} onClick={() => onBuy(item)}>
                {busy ? t.storeBuying : canAfford ? t.storeBuy : t.storeNotEnoughPoints}
              </button>
              <button type="button" className="btn secondary" disabled={busy} onClick={() => onGift(item, meta.name)}>
                {t.storeGiftButton}
              </button>
            </>
          )}
          {equipped && item.category === 'title' && (
            <button type="button" className="btn secondary" disabled={busy} onClick={onUnequip}>
              {t.storeUnequip}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Store({ user, initialPoints, initialInventory }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState('skins');
  const [points, setPoints] = useState(initialPoints);
  const [inventory, setInventory] = useState(initialInventory);
  const [status, setStatus] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [giftTarget, setGiftTarget] = useState(null); // { item, name }

  async function handleBuy(item) {
    setBusyId(item.id);
    setStatus(null);
    try {
      const res = await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buy', itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.storeBuyFailed);
      setInventory(data.inventory);
      setPoints(data.points);
      setStatus({ type: 'ok', text: t.storeBuySuccess });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  async function handleEquip(item) {
    setBusyId(item.id);
    try {
      const res = await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'equip', itemId: item.id }),
      });
      const data = await res.json();
      if (res.ok) setInventory(data.inventory);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnequipTitle() {
    const res = await fetch('/api/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unequipTitle' }),
    });
    const data = await res.json();
    if (res.ok) setInventory(data.inventory);
  }

  const items = tab === 'skins' ? SKINS : TITLES;

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

      <NavBar active="store" />
      <h1 className="page-title fade-in-up d1">{t.storeTitle}</h1>
      <p className="lede fade-in-up d1">{t.storeLede}</p>

      <div className="store-balance-card fade-in-up d2">
        <span className="store-balance-label">{t.storeBalance}</span>
        <span className="store-balance-num">{points}</span>
      </div>

      <div className="tab-row fade-in-up d2">
        <button type="button" className={`tab${tab === 'skins' ? ' active' : ''}`} onClick={() => setTab('skins')}>
          {t.storeTabSkins}
        </button>
        <button type="button" className={`tab${tab === 'titles' ? ' active' : ''}`} onClick={() => setTab('titles')}>
          {t.storeTabTitles}
        </button>
      </div>

      {status && <div className={`banner ${status.type}`}>{status.text}</div>}

      <div className="store-grid fade-in-up d3">
        {items.map((item) => (
          <StoreItemCard
            key={item.id}
            item={item}
            points={points}
            inventory={inventory}
            t={t}
            busyId={busyId}
            onBuy={handleBuy}
            onEquip={handleEquip}
            onUnequip={handleUnequipTitle}
            onGift={(it, name) => setGiftTarget({ item: it, name })}
          />
        ))}
      </div>

      {giftTarget && (
        <GiftModal
          item={giftTarget.item}
          name={giftTarget.name}
          t={t}
          onClose={() => setGiftTarget(null)}
          onSent={(newPoints) => {
            setPoints(newPoints);
            setGiftTarget(null);
            setStatus({ type: 'ok', text: t.storeGiftSuccess });
          }}
        />
      )}
    </div>
  );
}
