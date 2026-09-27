import { getSession } from '../lib/session';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

export async function getServerSideProps({ req, query }) {
  const session = await getSession(req);
  if (session) return { redirect: { destination: '/servers', permanent: false } };
  return { props: { error: typeof query.error === 'string' ? query.error : null } };
}

export default function Home({ error }) {
  const { t } = useLanguage();

  return (
    <div className="shell">
      <div className="topline fade-in-down">
        <div className="brand">
          Crossover <span>{t.brandSuffix}</span>
        </div>
        <LanguageSwitcher />
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
        <a className="btn glow fade-in-up d4" href="/api/auth/login">
          {t.signIn}
        </a>
      </div>
    </div>
  );
}
