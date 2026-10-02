import { useState } from 'react';
import { getSession } from '../lib/session';
import { getPersonalPremium } from '../lib/personalPremium';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';
import AccountMenu from '../components/AccountMenu';

function fmtDate(ms, lang) {
  return new Date(ms).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

const badgeIcons = { star: '⭐', crown: '👑', diamond: '💎', heart: '❤️', bolt: '⚡', shield: '🛡️' };

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };
  const overview = await getPersonalPremium(session.user.id);
  return { props: { user: session.user, overview } };
}

export default function PersonalPremium({ user, overview }) {
  const { lang } = useLanguage();
  const [ov, setOv] = useState(overview);
  const [card, setCard] = useState(overview.card);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null);

  const locked = ov.status !== 'active';
  const dirty = JSON.stringify(card) !== JSON.stringify(ov.card);

  async function call(action, payload = {}) {
    setBusy(action);
    setStatus(null);
    try {
      const res = await fetch('/api/premium/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setOv(data.overview);
      setCard(data.overview.card);
      setStatus({ type: 'ok', text: 'Premium settings saved.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    await call('save', {
      color: card.color,
      badge: card.badge,
      title: card.title,
      enabled: card.enabled,
    });
  }

  async function handleBackground(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus({ type: 'error', text: 'Please choose an image.' });
      return;
    }
    if (file.size > 350 * 1024) {
      setStatus({ type: 'error', text: 'Background must be 350 KB or smaller.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const result = String(reader.result || '');
      const b64 = result.includes(',') ? result.split(',')[1] : result;
      await call('save', {
        color: card.color, badge: card.badge, title: card.title,
        enabled: true, backgroundBase64: b64,
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="shell">
      <div className="topline fade-in-down">
        <div className="brand">
          <img src="/crossover-logo.png" alt="" className="brand-logo" />
          Crossover <span>Dashboard</span>
        </div>
        <div className="topline-right">
          <div className="top-actions">
            <a className="btn secondary top-invite" href="/api/invite">Add Crossover</a>
            <LanguageSwitcher />
          </div>
          <AccountMenu user={user} />
        </div>
      </div>

      <NavBar active="premium" />
      <a href="/profile" className="back-link fade-in-up">← Profile</a>
      <h1 className="page-title fade-in-up d1">Personal Premium</h1>
      <p className="lede fade-in-up d1">Your personal Premium settings. These apply only to your account.</p>

      <div className="premium-layout fade-in-up d2">
        <aside className="premium-sidebar">
          <span className="tab active">💎 Personal Premium</span>
          <a className="tab" href="/profile">👤 Profile</a>
        </aside>

        <main className="premium-content">
          {status && <div className={`banner ${status.type} fade-in-up`}>{status.text}</div>}

          <div className="panel prem-status">
            <div>
              <div className="prem-kicker">💎 Personal Premium</div>
              <div className="prem-status-line">
                {ov.status === 'active' && (ov.until ? `Active — expires ${fmtDate(ov.until, lang)}` : 'Active — permanent')}
                {ov.status === 'expired' && `Your Premium expired ${fmtDate(ov.until, lang)}`}
                {ov.status === 'none' && 'Personal Premium is not active on your account.'}
              </div>
            </div>
            <span className={`health-pill ${ov.status === 'active' ? 'healthy' : ov.status === 'expired' ? 'warning' : 'neutral'}`}>
              {ov.status === 'active' ? 'ACTIVE' : ov.status === 'expired' ? 'EXPIRED' : 'LOCKED'}
            </span>
          </div>

          <div className={`prem-wrap ${locked ? 'locked' : ''}`}>
            {locked && (
              <div className="prem-lock" role="status">
                <div className="prem-lock-card">
                  <div className="prem-lock-icon">🔒</div>
                  <strong>Personal Premium required</strong>
                  <span>These settings unlock only when your own Premium is active.</span>
                  <a className="btn glow" href="/api/invite">Get Premium</a>
                </div>
              </div>
            )}

            <div className="prem-body" aria-disabled={locked}>
              <section className="panel prem-section personal-premium-card">
                <div className="personal-card-head">
                  <div>
                    <h2>🪪 Custom Profile Card</h2>
                    <p className="prem-hint">Customize the card used by your profile. Your design stays saved if Premium expires.</p>
                  </div>
                  <span className={`health-pill ${card.enabled ? 'healthy' : 'neutral'}`}>
                    {card.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>

                <div className="personal-card-preview" style={{ '--pc-color': card.color }}>
                  <div className="personal-card-avatar">{user.username.slice(0, 1).toUpperCase()}</div>
                  <div className="personal-card-copy">
                    <strong>{user.username}</strong>
                    <span>{card.title || 'Crossover Player'}</span>
                  </div>
                  <div className="personal-card-badge">{card.badge ? badgeIcons[card.badge] : '💎'}</div>
                </div>

                <div className="field">
                  <label>Card status</label>
                  <div className="toggle-row">
                    <div>
                      <strong>Use my custom card</strong>
                      <div className="hint no-top">Turn it off to use your normal/store profile card. Your design remains saved.</div>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={Boolean(card.enabled)} onChange={(e) => setCard({ ...card, enabled: e.target.checked })} disabled={locked || !card.designed} />
                      <span className="track" />
                    </label>
                  </div>
                </div>

                <div className="field">
                  <label>Accent color</label>
                  <div className="personal-color-grid">
                    {Object.entries(ov.presets).map(([key, color]) => (
                      <button key={key} type="button" className={`personal-color-chip ${card.color === color ? 'active' : ''}`} style={{ '--chip-color': color }} onClick={() => setCard({ ...card, color })} disabled={locked}>
                        <span /> {key}
                      </button>
                    ))}
                    <label className={`personal-color-chip custom ${card.color && !Object.values(ov.presets).includes(card.color) ? 'active' : ''}`} style={{ '--chip-color': card.color }}>
                      <input type="color" value={card.color || '#3DFF8A'} onChange={(e) => setCard({ ...card, color: e.target.value.toUpperCase() })} disabled={locked} />
                      <span /> Custom
                    </label>
                  </div>
                </div>

                <div className="field">
                  <label>Badge</label>
                  <div className="personal-badge-grid">
                    <button type="button" className={`chip ${!card.badge ? 'active' : ''}`} onClick={() => setCard({ ...card, badge: null })} disabled={locked}>None</button>
                    {ov.badges.map((badge) => (
                      <button key={badge} type="button" className={`chip ${card.badge === badge ? 'active' : ''}`} onClick={() => setCard({ ...card, badge })} disabled={locked}>
                        {badgeIcons[badge]} {badge}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="personal-title">Title</label>
                  <input id="personal-title" maxLength={24} value={card.title || ''} onChange={(e) => setCard({ ...card, title: e.target.value })} disabled={locked} placeholder="e.g. Chess Nerd" />
                  <div className="hint">{(card.title || '').length}/24 characters</div>
                </div>

                <div className="field">
                  <label htmlFor="personal-bg">Background image</label>
                  <input id="personal-bg" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={locked || busy === 'save'} onChange={(e) => handleBackground(e.target.files?.[0])} />
                  <div className="hint">PNG, JPG, WEBP or GIF — maximum 350 KB.</div>
                </div>

                <div className="prem-actions">
                  <button className="btn glow" type="button" disabled={locked || !dirty || busy === 'save'} onClick={save}>
                    {busy === 'save' ? 'Saving…' : 'Save Premium settings'}
                  </button>
                  <button className="btn secondary" type="button" disabled={locked || busy === 'reset'} onClick={() => call('reset')}>
                    Reset custom card
                  </button>
                </div>
              </section>

              <section className="panel prem-section">
                <h2>📅 Daily Challenge</h2>
                <p className="prem-hint">Personal Premium automatically gives you ×1.5 daily challenge points and a Streak Freeze ❄️. There is nothing to configure here.</p>
                <div className="premium-perk-grid">
                  <div><span>×1.5</span><small>Daily points</small></div>
                  <div><span>❄️</span><small>Streak Freeze</small></div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
