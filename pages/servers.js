import Link from 'next/link';
import { getSession } from '../lib/session';
import { fetchManageableMutualGuilds, guildIconUrl } from '../lib/discord';
import { isOwner } from '../lib/owner';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';
import AccountMenu from '../components/AccountMenu';
import { avatarProxyUrl } from '../lib/profiles';

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
  const avatarUrl32 = user?.avatarUrl || (user?.id ? avatarProxyUrl(user.id, user.avatar, 32) : null);
  const avatarUrl96 = user?.avatarUrl || (user?.id ? avatarProxyUrl(user.id, user.avatar, 96) : null);

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
          <AccountMenu user={user} />
        </div>
      </div>

      <NavBar active="servers" />

      <Link href="/profile" prefetch className="profile-card profile-card-link fade-in-up d1">
        {avatarUrl96 ? (
          <div className="profile-avatar-wrap">
            <img src={avatarUrl96} alt="" className="profile-avatar" onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) fallback.style.display = 'grid';
            }} />
            <div className="profile-avatar profile-avatar-fallback" style={{display: 'none'}}>
              {user.username.slice(0, 1)}
            </div>
          </div>
        ) : (
          <div className="profile-avatar profile-avatar-fallback">{user.username.slice(0, 1)}</div>
        )}
        <div className="profile-info">
          <div className="profile-name">{user.username}</div>
          <div className="profile-row no-border">
            <span className="profile-key">{t.accountId}</span>
            <code className="profile-val">{user.id}</code>
          </div>
          <div className="profile-row">
            <span className="profile-key">{t.accountRole}</span>
            <span className="profile-val">{showOwnerLinks ? t.roleOwner : t.roleMember}</span>
          </div>
          <div className="profile-row">
            <span className="profile-key">{t.manageableServers}</span>
            <span className="profile-val">{guilds.length}</span>
          </div>
        </div>
        <span className="profile-card-arrow">{t.viewProfile} →</span>
      </Link>

      <h1 className="fade-in-up d1">{t.yourServers}</h1>
      <p className="lede fade-in-up d2">{t.yourServersLede}</p>

      {showOwnerLinks && (
        <p className="owner-link fade-in-up d2">
          <Link href="/owner/blocklist" prefetch>{t.ownerBlocklistLink}</Link>
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
            <Link href={`/servers/${g.id}`} prefetch className="server-card">
              {g.icon ? (
                <img src={g.icon} alt="" />
              ) : (
                <div className="guild-fallback">{g.name.slice(0, 1)}</div>
              )}
              <div className="name">{g.name}</div>
              <span className="manage-tag">{t.manage} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
