import { getSession } from '../lib/session';
import { getUserProfile } from '../lib/redis';
import { fetchManageableMutualGuilds } from '../lib/discord';
import { isOwner } from '../lib/owner';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };

  let guildCount = 0;
  let profile = null;
  try {
    const [guilds, userProfile] = await Promise.all([
      fetchManageableMutualGuilds(session.accessToken),
      getUserProfile(session.user.id),
    ]);
    guildCount = guilds.length;
    profile = userProfile;
  } catch {
    guildCount = null;
    try { profile = await getUserProfile(session.user.id); } catch {}
  }

  return {
    props: {
      user: session.user,
      guildCount,
      owner: isOwner(session),
      profile,
    },
  };
}

export default function Profile({ user, guildCount, owner }) {
  const { t } = useLanguage();
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : null;

  return (
    <div className="shell">
      <div className="topline fade-in-down">
        <div className="brand">
          <img src="/crossover-logo.png" alt="" className="brand-logo" />
          Crossover <span>{t.brandSuffix}</span>
        </div>
        <div className="topline-right">
          <LanguageSwitcher />
          <div className="user-chip">
            {user.username}
            <a href="/api/auth/logout">{t.signOut}</a>
          </div>
        </div>
      </div>

      <NavBar active="profile" />
      <h1 className="page-title fade-in-up d1">{t.profileTitle}</h1>
      <p className="lede fade-in-up d1">{t.profileLede}</p>

      <div className="profile-card fade-in-up d2">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="profile-avatar" />
        ) : (
          <div className="profile-avatar profile-avatar-fallback">{user.username.slice(0, 1)}</div>
        )}
        <div className="profile-info">
          <div className="profile-name">{user.username}</div>
          <div className="profile-row">
            <span className="profile-key">{t.accountId}</span>
            <code className="profile-val">{user.id}</code>
          </div>
          <div className="profile-row">
            <span className="profile-key">{t.accountRole}</span>
            <span className="profile-val">{owner ? t.roleOwner : t.roleMember}</span>
          </div>
          {guildCount !== null && (
            <div className="profile-row">
              <span className="profile-key">{t.manageableServers}</span>
              <span className="profile-val">{guildCount}</span>
            </div>
          )}
        </div>
      </div>


      <div className="profile-dashboard fade-in-up d3">
        <div className="profile-stat-grid">
          <div className="stat-box"><div className="stat-num">{profile?.level ?? 1}</div><div className="stat-label">{t.homeLevel}</div></div>
          <div className="stat-box"><div className="stat-num">{profile?.points ?? 0}</div><div className="stat-label">{t.homePoints}</div></div>
          <div className="stat-box"><div className="stat-num">{profile ? `${profile.w}/${profile.l}/${profile.d}` : '0/0/0'}</div><div className="stat-label">{t.homeRecord}</div></div>
          <div className="stat-box"><div className="stat-num">{profile?.achievements?.length ?? 0}/4</div><div className="stat-label">{t.homeAchievements}</div></div>
        </div>
        {profile && (
          <div className="engine-grid compact">
            {profile.engines.map((engine) => (
              <div key={engine.key} className={`engine-card ${engine.completed ? 'done' : 'todo'}`}>
                <div className="engine-icon">{engine.icon}</div>
                <div className="engine-body">
                  <div className="engine-name">{engine.label}</div>
                  <div className="engine-meta">{engine.completed ? `${engine.played} ${t.homePlayed} · ${engine.wins} ${t.homeWins}` : t.homeNotPlayedTag}</div>
                </div>
                <span className="engine-state">{engine.completed ? '✓' : '○'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="profile-actions fade-in-up d3">
        <a className="btn glow" href="/servers">{t.goToServers}</a>
        {owner && (
          <a className="btn secondary" href="/owner/blocklist">{t.ownerBlocklistLink}</a>
        )}
      </div>
    </div>
  );
}
