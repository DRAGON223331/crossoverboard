import { getSession } from '../lib/session';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';
import AccountMenu from '../components/AccountMenu';

// Public page — no login required, so anyone can check what the bot can do
// before (or without) signing in. If they're already logged in we still show
// their user chip in the top bar for a consistent feel with the rest of the
// dashboard.
export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  return { props: { user: session?.user ?? null } };
}

function CommandCard({ cmd, title, desc }) {
  return (
    <div className="cmd-card stagger-in">
      <code>!{cmd}</code>
      <div className="cmd-title">{title}</div>
      <div className="cmd-desc">{desc}</div>
    </div>
  );
}

export default function Commands({ user }) {
  const { t } = useLanguage();

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
          {user ? (
          <AccountMenu user={user} />
          ) : (
            <a className="btn secondary" href="/api/auth/login">{t.signIn}</a>
          )}
        </div>
      </div>

      <NavBar active="commands" />
      <h1 className="page-title fade-in-up d1">{t.commandsTitle}</h1>
      <p className="lede fade-in-up d1">{t.commandsLede}</p>

      <section className="cmd-section fade-in-up d2">
        <h2>{t.commandsGamesTitle}</h2>
        <p className="lede">{t.commandsGamesLede}</p>
        <div className="cmd-grid">
          {t.commands.games.map((c) => (
            <CommandCard key={c.cmd} {...c} />
          ))}
        </div>
      </section>

      <section className="cmd-section fade-in-up d3">
        <h2>{t.commandsGeneralTitle}</h2>
        <p className="lede">{t.commandsGeneralLede}</p>
        <div className="cmd-grid">
          {t.commands.general.map((c) => (
            <CommandCard key={c.cmd} {...c} />
          ))}
        </div>
      </section>

      <section className="cmd-section fade-in-up d4">
        <h2>{t.commandsAdminTitle}</h2>
        <p className="lede">{t.commandsAdminLede}</p>
        <div className="cmd-grid">
          {t.commands.admin.map((c) => (
            <CommandCard key={c.cmd} {...c} />
          ))}
        </div>
      </section>
    </div>
  );
}
