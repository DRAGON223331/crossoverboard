import '../styles/globals.css';
import { useEffect, useState } from 'react';
import { LanguageProvider } from '../lib/i18n';

function StartupOverlay() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let timer;
    try {
      const alreadyShown = window.sessionStorage.getItem('cx-startup-seen');
      if (alreadyShown) {
        setVisible(false);
        return;
      }
      window.sessionStorage.setItem('cx-startup-seen', '1');
    } catch {
      // If storage is unavailable, still show the animation once for this load.
    }

    timer = window.setTimeout(() => setVisible(false), 1050);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="startup-overlay" aria-hidden="true">
      <div className="startup-grid" />
      <div className="startup-glow" />
      <div className="startup-content">
        <div className="startup-logo-wrap">
          <img src="/crossover-logo.png" alt="" className="startup-logo" />
          <span className="startup-ring startup-ring-one" />
          <span className="startup-ring startup-ring-two" />
        </div>
        <div className="startup-name">CROSSOVER</div>
        <div className="startup-line"><span /></div>
        <div className="startup-loading">LOADING DASHBOARD</div>
      </div>
    </div>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <LanguageProvider>
      <StartupOverlay />
      <Component {...pageProps} />
    </LanguageProvider>
  );
}
