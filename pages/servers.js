import { getSession } from '../lib/session';
import { fetchManageableMutualGuilds, guildIconUrl } from '../lib/discord';
import { isOwner } from '../lib/owner';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };

  let guilds = [];
  let loadError = null;
  try {
    guilds = await fetchManageableMutualGuilds(session.accessToken);
  } catch (err) {
    loadError = err.message;
  }

  return {
    props: {
      user: session.user,
      loadError,
      guilds: guilds.map((g) => ({ id: g.id, name: g.name, icon: guildIconUrl(g) })),
      showOwnerLinks: isOwner(session),
    },
  };
}

export default function Servers({ user, guilds, loadError, showOwnerLinks }) {
  const { t } = useLanguage();
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`
    : null;

  return (
    <div className="shell">
      <div className="topline fade-in-down">
        <div className="brand">
          Crossover <span>{t.brandSuffix}</span>
        </div>
        <div className="topline-right">
          <LanguageSwitcher />
          <div className="user-chip">
            <a href="/profile" className="user-link">
              {avatarUrl && <img src={avatarUrl} alt="" />}
              {user.username}
            </a>
            <a href="/api/auth/logout">{t.signOut}</a>
          </div>
        </div>
      </div>

      <h1 className="fade-in-up d1">{t.yourServers}</h1>
      <p className="lede fade-in-up d2">{t.yourServersLede}</p>

      {showOwnerLinks && (
        <p className="owner-link fade-in-up d2">
          <a href="/owner/blocklist">{t.ownerBlocklistLink}</a>
        </p>
      )}

      {loadError && (
        <div className="banner error fade-in-up">
          {t.couldNotLoad} {loadError}
        </div>
      )}

      {!loadError && guilds.length === 0 && (
        <p className="empty fade-in-up">
          {t.noServersFoundPre} <code>!invite</code> {t.noServersFoundPost}
        </p>
      )}

      <ul className="server-grid">
        {guilds.map((g, i) => (
          <li key={g.id} className="stagger-in" style={{ animationDelay: `${Math.min(i, 12) * 0.04}s` }}>
            <a href={`/servers/${g.id}`} className="server-card">
              {g.icon ? (
                <img src={g.icon} alt="" />
              ) : (
                <div className="guild-fallback">{g.name.slice(0, 1)}</div>
              )}
              <div className="name">{g.name}</div>
              <span className="manage-tag">{t.manage} →</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
