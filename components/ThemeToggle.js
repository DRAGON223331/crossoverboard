import { useEffect, useState } from 'react';
import { useLanguage } from '../lib/i18n';

export default function ThemeToggle() {
  const { t } = useLanguage();
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('cx-theme');
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem('cx-theme', theme); } catch {}
  }, [theme]);

  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button className="icon-btn" type="button" onClick={() => setTheme(next)} aria-label={theme === 'dark' ? t.lightMode : t.darkMode} title={theme === 'dark' ? t.lightMode : t.darkMode}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
