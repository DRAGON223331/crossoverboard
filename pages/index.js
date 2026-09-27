import { getSession } from '../lib/session';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

export async function getServerSideProps({ req, query }) {
  const session = await getSession(req);
  if (session) return { redirect: { destination: '/home', permanent: false } };
  return { props: { error: typeof query.error === 'string' ? query.error : null } };
}

export default function Home({ error }) {
  const { t } = useLanguage();

  return (
    <div className="shell">
      <div className="topline fade-in-down">
        <div className="brand">
          <img src="/crossover-logo.png" alt="" className="brand-logo" />
          Crossover <span>{t.brandSuffix}</span>
        </div>
        <div className="top-actions">
            <a className="btn secondary top-invite" href="/api/invite">{t.addCrossover}</a>
            <LanguageSwitcher />
          </div>
      </div>

      {error && (
        <div className="banner error fade-in-up">{t.errors[error] || t.errors.generic}</div>
      )}

      <div className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" />
        <p className="kicker fade-in-up d1">{t.heroKicker}</p>
        <h1 className="fade-in-up d2">{t.heroTitle}</h1>
        <p className="lede fade-in-up d3">{t.heroLede}</p>
        <div className="hero-actions fade-in-up d4">
          <a className="btn glow" href="/api/invite">
            {t.addCrossover}
          </a>
          <a className="btn secondary" href="/home">
            {t.dashboard}
          </a>
          <a className="btn secondary" href="/api/auth/login">
            {t.signIn}
          </a>
        </div>
      </div>
    </div>
  );
}
