import '../styles/globals.css';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { LanguageProvider, useLanguage } from '../lib/i18n';
import { UnreadProvider } from '../components/ChatNotifier';

function StartupOverlay({ onComplete }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let timer;
    try {
      const alreadyShown = window.sessionStorage.getItem('cx-startup-seen');
      if (alreadyShown) {
        setVisible(false);
        onComplete();
        return;
      }
      window.sessionStorage.setItem('cx-startup-seen', '1');
    } catch {
      // If storage is unavailable, still show the animation for this load.
    }

    // Keep the intro short so it does not feel like page/network latency.
    timer = window.setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 350);

    return () => window.clearTimeout(timer);
  }, [onComplete]);

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
        <div className="startup-loading">{t.startupLoading}</div>
      </div>
    </div>
  );
}

export default function App({ Component, pageProps }) {
  const [siteVisible, setSiteVisible] = useState(false);
  const completeStartup = () => setSiteVisible(true);

  return (
    <LanguageProvider>
      <Head>
        <title>Crossover</title>
      </Head>
      <UnreadProvider>
        <StartupOverlay onComplete={completeStartup} />
        {siteVisible && <Component {...pageProps} />}
      </UnreadProvider>
    </LanguageProvider>
  );
}
