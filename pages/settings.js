import { getSession } from '../lib/session';
import { getPersonalPremium } from '../lib/personalPremium';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';
import AccountMenu from '../components/AccountMenu';
import { avatarProxyUrl } from '../lib/profiles';

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };
  let premium = { status: 'none' };
  try { premium = await getPersonalPremium(session.user.id); } catch {}
  return { props: { user: session.user, premium } };
}

export default function Settings({ user, premium }) {
  const { t, lang } = useLanguage();
  const avatar = user?.id ? avatarProxyUrl(user.id, user.avatar, 256) : null;
  const status = premium.status === 'active' ? t.premActive : premium.status === 'expired' ? t.premExpired : t.premNone;
  return (
    <div className="shell">
      <div className="topline fade-in-down">
        <div className="brand"><img src="/crossover-logo.png" alt="" className="brand-logo" />Crossover <span>{t.brandSuffix}</span></div>
        <div className="topline-right"><div className="top-actions"><a className="btn secondary top-invite" href="/api/invite">{t.addCrossover}</a><LanguageSwitcher /></div><AccountMenu user={user} /></div>
      </div>
      <NavBar active="settings" />
      <h1 className="page-title fade-in-up d1">{t.accountSettings}</h1>
      <p className="lede fade-in-up d1">{t.accountSettingsLede}</p>
      <div className="settings-grid fade-in-up d2">
        <section className="panel settings-card"><div className="section-heading"><div><h2>{t.settingsAccountTitle}</h2><p className="lede">{t.profileLede}</p></div></div>
          <div className="settings-profile"><div className="settings-avatar">{avatar ? <><img src={avatar} alt="" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='grid'; }} /><span style={{display:'none'}}>{user.username.slice(0,1)}</span></> : user.username.slice(0,1)}</div><div><strong>{user.username}</strong><span>{user.id}</span></div></div>
          <div className="settings-facts"><div><span>{t.settingsUsername}</span><strong>{user.username}</strong></div><div><span>{t.settingsDiscordId}</span><strong className="mono">{user.id}</strong></div><div><span>{t.settingsLanguage}</span><strong>{lang === 'ar' ? t.arabic : t.english}</strong></div></div>
          <div className="settings-actions"><a className="btn secondary" href="/profile">{t.settingsOpenProfile}</a></div>
        </section>
        <section className="panel settings-card"><h2>{t.appearanceTitle}</h2><p className="prem-hint">{t.appearanceLede}</p><div className="settings-theme-grid"><div><b>{t.themeTitle}</b><p className="prem-hint">{t.accountTheme}</p><div className="theme-choice-row"><span>🌙 {t.themeDark}</span><span>☀️ {t.themeLight}</span></div></div><div><b>{t.settingsLanguage}</b><p className="prem-hint">{t.language}</p><LanguageSwitcher /></div></div></section>
        <section className="panel settings-card settings-premium"><div className="section-heading"><div><h2>{t.settingsPremiumTitle}</h2><p className="lede">{t.settingsPremiumLede}</p></div><span className={`status-pill ${premium.status === 'active' ? 'success' : ''}`}>{status}</span></div><div className="settings-premium-actions"><a className="btn glow" href="/premium">{t.settingsOpenPremium}</a></div></section>
      </div>
    </div>
  );
}
