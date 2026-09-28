import { useState } from 'react';
import { getSession } from '../lib/session';
import { getUserInventory, getFriends } from '../lib/redis';
import { SKINS, TITLES, COMING_SOON, emojiUrl } from '../lib/storeCatalog';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };

  const [inventory, friends] = await Promise.all([
    getUserInventory(session.user.id),
    getFriends(session.user.id),
  ]);

  return {
    props: { user: session.user, initialInventory: inventory, initialFriends: friends },
  };
}

function SkinPreview({ skin }) {
  if (!skin) return <span style={{ fontSize: 20 }}>❌ ⭕</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <img src={emojiUrl(skin.x)} alt="" width={28} height={28} />
      <img src={emojiUrl(skin.o)} alt="" width={28} height={28} />
    </span>
  );
}

function GiftModal({ item, name, friends, onClose, onSent, t }) {
  const [friendId, setFriendId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    if (!friendId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gift', itemId: item.id, friendId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.storeGiftFailed);
      onSent(data.buyerPoints);
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

        {friends.length === 0 ? (
          <div className="banner error">{t.storeNoFriends}</div>
        ) : (
          <div className="field" style={{ marginBottom: 0 }}>
            <select value={friendId} onChange={(e) => setFriendId(e.target.value)}>
              <option value="">{t.storeGiftChooseFriend}</option>
              {friends.map((f) => (
                <option key={f.id} value={f.id}>{f.username ? `@${f.username}` : f.id}</option>
              ))}
            </select>
          </div>
        )}

        {error && <div className="banner error" style={{ marginTop: 14 }}>{error}</div>}

        <div className="store-gift-actions">
          {friends.length > 0 && (
            <button type="button" className="btn glow" onClick={send} disabled={sending || !friendId}>
              {sending ? t.storeGiftSending : t.storeGiftSend}
            </button>
          )}
          <button type="button" className="btn secondary" onClick={onClose} disabled={sending}>
            {t.storeGiftCancel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkinCard({ id, skin, inventory, t, lang, busyId, onBuy, onEquip, onGift }) {
  const owned = inventory.items.includes(id);
  const equipped = inventory.equipped?.xo === id;
  const name = lang === 'ar' ? skin.ar : skin.en;
  const busy = busyId === id;

  return (
    <article className={`store-item-card fade-in-up${owned ? ' owned' : ''}`}>
      <div className="store-item-icon"><SkinPreview skin={skin} /></div>
      {equipped ? (
        <span className="store-badge equipped">{t.storeEquipped}</span>
      ) : owned ? (
        <span className="store-badge">{t.storeOwned}</span>
      ) : null}
      <div className="store-item-name">{name} — XO</div>
      <div className="store-item-footer">
        <span className="store-item-price">{skin.price} {t.storePoints}</span>
        <div className="store-item-actions">
          {owned ? (
            !equipped && (
              <button type="button" className="btn secondary" disabled={busy} onClick={() => onEquip('xo', id)}>
                {t.storeEquip}
              </button>
            )
          ) : (
            <>
              <button type="button" className="btn glow" disabled={busy} onClick={() => onBuy(id)}>
                {busy ? t.storeBuying : t.storeBuy}
              </button>
              <button type="button" className="btn secondary" disabled={busy} onClick={() => onGift({ id }, name)}>
                {t.storeGiftButton}
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function TitleCard({ id, title, inventory, t, lang, busyId, onBuy, onEquip, onGift }) {
  const owned = inventory.items.includes(id);
  const equipped = inventory.equipped?.title === id;
  const name = lang === 'ar' ? title.ar : title.en;
  const busy = busyId === id;

  return (
    <article className={`store-item-card fade-in-up${owned ? ' owned' : ''}`}>
      <div className="store-item-icon" style={{ fontSize: 28 }}>{title.icon}</div>
      {equipped ? (
        <span className="store-badge equipped">{t.storeEquipped}</span>
      ) : owned ? (
        <span className="store-badge">{t.storeOwned}</span>
      ) : null}
      <div className="store-item-name">{name}</div>
      <div className="store-item-footer">
        <span className="store-item-price">{title.price} {t.storePoints}</span>
        <div className="store-item-actions">
          {owned ? (
            equipped ? (
              <button type="button" className="btn secondary" disabled={busy} onClick={() => onEquip('title', null)}>
                {t.storeUnequip}
              </button>
            ) : (
              <button type="button" className="btn secondary" disabled={busy} onClick={() => onEquip('title', id)}>
                {t.storeEquip}
              </button>
            )
          ) : (
            <>
              <button type="button" className="btn glow" disabled={busy} onClick={() => onBuy(id)}>
                {busy ? t.storeBuying : t.storeBuy}
              </button>
              <button type="button" className="btn secondary" disabled={busy} onClick={() => onGift({ id }, name)}>
                {t.storeGiftButton}
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Store({ user, initialInventory, initialFriends }) {
  const { t, lang } = useLanguage();
  const [inventory, setInventory] = useState(initialInventory);
  const [friends] = useState(initialFriends);
  const [status, setStatus] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [giftTarget, setGiftTarget] = useState(null); // { item: {id}, name }

  async function post(body) {
    const res = await fetch('/api/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }

  async function handleBuy(itemId) {
    setBusyId(itemId);
    setStatus(null);
    try {
      const data = await post({ action: 'buy', itemId });
      setInventory(data.inventory);
      setStatus({ type: 'ok', text: t.storeBuySuccess });
    } catch (err) {
      setStatus({ type: 'error', text: err.message === 'Not enough points.' ? t.storeNotEnoughPoints : (err.message || t.storeBuyFailed) });
    } finally {
      setBusyId(null);
    }
  }

  async function handleEquip(slot, itemId) {
    setBusyId(itemId || slot);
    try {
      const data = itemId ? await post({ action: 'equip', itemId }) : await post({ action: 'unequip', slot });
      setInventory(data.inventory);
    } catch {
      // Leave the current state showing rather than clearing it on a network hiccup.
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

      <NavBar active="store" />
      <h1 className="page-title fade-in-up d1">{t.storeTitle}</h1>
      <p className="lede fade-in-up d1">{t.storeLede}</p>

      <div className="store-balance-card fade-in-up d2">
        <span className="store-balance-label">{t.storeBalance}</span>
        <span className="store-balance-num">{inventory.points}</span>
      </div>

      {status && <div className={`banner ${status.type}`}>{status.text}</div>}

      <h2 className="fade-in-up d2">{t.storeSectionSkins}</h2>
      <div className="store-grid fade-in-up d3">
        {Object.entries(SKINS).map(([id, skin]) => (
          <SkinCard
            key={id} id={id} skin={skin} inventory={inventory} t={t} lang={lang} busyId={busyId}
            onBuy={handleBuy} onEquip={handleEquip} onGift={(item, name) => setGiftTarget({ item, name })}
          />
        ))}
      </div>

      <h2 className="fade-in-up d2" style={{ marginTop: 28 }}>{t.storeSectionTitles}</h2>
      <div className="store-grid fade-in-up d3">
        {Object.entries(TITLES).map(([id, title]) => (
          <TitleCard
            key={id} id={id} title={title} inventory={inventory} t={t} lang={lang} busyId={busyId}
            onBuy={handleBuy} onEquip={handleEquip} onGift={(item, name) => setGiftTarget({ item, name })}
          />
        ))}
      </div>

      <h2 className="fade-in-up d2" style={{ marginTop: 28 }}>{t.storeSectionComingSoon}</h2>
      <div className="panel fade-in-up d3">
        {COMING_SOON.map((c) => (
          <div key={c.en} className="toggle-row players-locked-row">
            <div>{c.icon} {lang === 'ar' ? c.ar : c.en}</div>
            <span className="hint no-top">{t.storeComingSoonNote}</span>
          </div>
        ))}
      </div>

      <p className="players-hint">{t.storeFootnote}</p>

      {giftTarget && (
        <GiftModal
          item={giftTarget.item}
          name={giftTarget.name}
          friends={friends}
          t={t}
          onClose={() => setGiftTarget(null)}
          onSent={(buyerPoints) => {
            setInventory((prev) => ({ ...prev, points: buyerPoints }));
            setGiftTarget(null);
            setStatus({ type: 'ok', text: t.storeGiftSuccess });
          }}
        />
      )}
    </div>
  );
}
