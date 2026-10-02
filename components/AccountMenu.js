import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../lib/i18n';
import { avatarProxyUrl } from '../lib/profiles';

export default function AccountMenu({ user }) {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const ref = useRef(null);

  useEffect(() => {
    try { setTheme(localStorage.getItem('cx-theme') || 'dark'); } catch {}
  }, []);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  function changeTheme(next) {
    setTheme(next);
    try { localStorage.setItem('cx-theme', next); document.documentElement.dataset.theme = next; window.dispatchEvent(new Event('cx-theme-change')); } catch {}
    setOpen(false);
  }

  const avatar = user?.avatarUrl || (user?.id ? avatarProxyUrl(user.id, user.avatar, 64) : null);
  return (
    <div className="account-menu-wrap" ref={ref}>
      <button type="button" className="account-trigger" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        {avatar ? <><img src={avatar} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; const fallback = e.currentTarget.nextElementSibling; if (fallback) fallback.style.display = 'grid'; }} /><span className="account-avatar-fallback" style={{display:'none'}}>{(user?.username || '?').slice(0,1).toUpperCase()}</span></> : <span className="account-avatar-fallback">{(user?.username || '?').slice(0,1).toUpperCase()}</span>}
        <span className="account-name">{user?.username}</span><span className="account-chevron">⌄</span>
      </button>
      {open && (
        <div className="account-dropdown">
          <div className="account-dropdown-head"><strong>{user?.username}</strong><span>{t.accountMenuSignedIn}</span></div>
          <Link href="/profile" onClick={() => setOpen(false)}>👤 {t.navProfile}</Link>
          <Link href="/settings" onClick={() => setOpen(false)}>⚙️ {t.settingsTitle}</Link>
          <Link href="/premium" onClick={() => setOpen(false)}>💎 {t.personalPremium}</Link>
          <div className="account-dropdown-label">{t.accountTheme}</div>
          <div className="account-theme-row">
            <button className={theme === 'dark' ? 'selected' : ''} onClick={() => changeTheme('dark')}>🌙 {t.themeDark}</button>
            <button className={theme === 'light' ? 'selected' : ''} onClick={() => changeTheme('light')}>☀️ {t.themeLight}</button>
          </div>
          <Link href="/api/auth/logout" className="account-signout">↪ {t.signOut}</Link>
        </div>
      )}
      <a className="account-signout-inline" href="/api/auth/logout">{t.signOut}</a>
    </div>
  );
}
