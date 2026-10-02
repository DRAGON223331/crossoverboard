import { getSession } from '../lib/session';
import { getUserProfile } from '../lib/redis';
import { fetchManageableMutualGuilds } from '../lib/discord';
import { isOwner } from '../lib/owner';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';
import AccountMenu from '../components/AccountMenu';
import { avatarUrl } from '../lib/profiles';

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

function achievementMeta(key, t) {
  const raw = String(key ?? '').toLowerCase();
  if (raw.includes('first') || raw.includes('win')) return { icon: '🥇', title: t.profileAchievementFirstWin };
  if (raw.includes('10') && (raw.includes('game') || raw.includes('play'))) return { icon: '🎮', title: t.profileAchievementTenGames };
  if (raw.includes('streak')) return { icon: '🔥', title: t.profileAchievementTenStreak };
  if (raw.includes('all') || raw.includes('every')) return { icon: '🌟', title: t.profileAchievementAllGames };
  return { icon: '🏆', title: String(key || t.profileAchievementUnlocked) };
}

export default function Profile({ user, guildCount, owner, profile }) {
  const { t } = useLanguage();

  const userAvatarUrl = user?.id ? avatarUrl(user.id, user.avatar, 256) : null;

  const wins = profile?.w ?? 0;
  const losses = profile?.l ?? 0;
  const draws = profile?.d ?? 0;
  const totalGames = wins + losses + draws;
  const winRate = totalGames ? Math.round((wins / totalGames) * 100) : 0;
  const currentStreak = profile?.streak ?? 0;
  const bestStreak = profile?.best ?? 0;
  const points = profile?.points ?? 0;
  const level = profile?.level ?? 1;
  const levelStart = Math.max(0, (level - 1) * 100);
  const levelProgress = Math.min(100, Math.max(0, points - levelStart));
  const achievementCount = profile?.achievements?.length ?? 0;
  const achievements = Array.isArray(profile?.achievements) ? profile.achievements : [];
  const achievementSlots = [
    { id: 'first_win', icon: '🥇', title: t.profileAchievementFirstWin, unlocked: achievementCount >= 1 },
    { id: 'ten_games', icon: '🎮', title: t.profileAchievementTenGames, unlocked: achievementCount >= 2 },
    { id: 'ten_streak', icon: '🔥', title: t.profileAchievementTenStreak, unlocked: achievementCount >= 3 },
    { id: 'all_games', icon: '🌟', title: t.profileAchievementAllGames, unlocked: achievementCount >= 4 },
  ];

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

      <NavBar active="profile" />
      <h1 className="page-title fade-in-up d1">{t.profileTitle}</h1>
      <p className="lede fade-in-up d1">{t.profileLede}</p>

      <section className="profile-hero fade-in-up d2">
        <div className="profile-hero-main">
          <div className="profile-avatar-wrap">
            {avatarUrl ? (
              <img src={userAvatarUrl} alt="" className="profile-avatar profile-avatar-large" />
            ) : (
              <div className="profile-avatar profile-avatar-large profile-avatar-fallback">{user.username.slice(0, 1)}</div>
            )}
            <span className="profile-online-dot" />
          </div>

          <div className="profile-hero-info">
            <div className="profile-name profile-name-large">{user.username}</div>
            <div className="profile-subline">
              <span className="profile-badge">CROSSOVER</span>
              <span>{t.profileGlobalStats}</span>
            </div>
            <div className="profile-mini-grid">
              <div><span>{t.accountRole}</span><strong>{owner ? t.roleOwner : t.roleMember}</strong></div>
              <div><span>{t.manageableServers}</span><strong>{guildCount ?? '—'}</strong></div>
              <div><span>{t.accountId}</span><strong className="mono">{user.id}</strong></div>
            </div>
          </div>
        </div>

        <div className="profile-level-card">
          <div className="profile-level-icon">XP</div>
          <div className="profile-level-copy">
            <span>{t.homeLevel}</span>
            <strong>{level}<small>/100</small></strong>
          </div>
          <div className="profile-level-track"><span style={{ width: `${levelProgress}%` }} /></div>
          <div className="profile-level-meta">
            <span>{levelProgress}/100 XP</span>
            <b>{points} {t.homePoints}</b>
          </div>
        </div>
      </section>

      {!profile ? (
        <section className="panel profile-empty fade-in-up d3">
          <div className="profile-empty-icon">🎮</div>
          <h2>{t.profileNoGamesTitle}</h2>
          <p>{t.homeNoProfile}</p>
        </section>
      ) : (
        <>
          <section className="profile-stat-grid profile-stat-grid-large fade-in-up d3">
            <div className="stat-box profile-stat-card">
              <span className="stat-icon">🏆</span>
              <div className="stat-num">{points}</div>
              <div className="stat-label">{t.homePoints}</div>
            </div>
            <div className="stat-box profile-stat-card">
              <span className="stat-icon">⚔️</span>
              <div className="stat-num">{wins} / {losses} / {draws}</div>
              <div className="stat-label">{t.profileWLD}</div>
            </div>
            <div className="stat-box profile-stat-card">
              <span className="stat-icon">📈</span>
              <div className="stat-num">{winRate}%</div>
              <div className="stat-label">{t.profileWinRate}</div>
            </div>
            <div className="stat-box profile-stat-card">
              <span className="stat-icon">🎮</span>
              <div className="stat-num">{totalGames}</div>
              <div className="stat-label">{t.profileTotalGames}</div>
            </div>
            <div className="stat-box profile-stat-card">
              <span className="stat-icon">🔥</span>
              <div className="stat-num">{currentStreak}</div>
              <div className="stat-label">{t.profileCurrentStreak}</div>
            </div>
            <div className="stat-box profile-stat-card">
              <span className="stat-icon">⚡</span>
              <div className="stat-num">{bestStreak}</div>
              <div className="stat-label">{t.homeStreak}</div>
            </div>
          </section>

          <section className="profile-section fade-in-up d4">
            <div className="section-heading">
              <div>
                <h2>{t.profileCardTitle}</h2>
                <p className="lede">{t.profileCardLede}</p>
              </div>
            </div>

            <div className="profile-showcase">
              <div className="profile-showcase-avatar">
                {avatarUrl ? (
                  <img src={userAvatarUrl} alt="" />
                ) : (
                  <div>{user.username.slice(0, 1)}</div>
                )}
              </div>
              <div className="profile-showcase-copy">
                <div className="showcase-top"><span>XP</span><b>{t.homeLevel} {level}</b></div>
                <h3>{t.profileCardHeading}</h3>
                <div className="showcase-points"><span>★</span><strong>{points}</strong><small>{t.homePoints}</small></div>
              </div>
              <div className="showcase-trophy">🏆 <b>x{Math.max(1, achievementCount)}</b></div>
            </div>
          </section>

          <section className="profile-section fade-in-up d4">
            <div className="section-heading">
              <div>
                <h2>{t.profileGamesTitle}</h2>
                <p className="lede">{t.profileGamesLede}</p>
              </div>
              <span className="section-count">{profile.engines.length}</span>
            </div>

            <div className="profile-games-grid">
              {profile.engines.map((engine) => (
                <article key={engine.key} className={`profile-game-card ${engine.completed ? 'played' : 'locked'}`}>
                  <div className="profile-game-icon">{engine.icon}</div>
                  <div className="profile-game-body">
                    <h3>{engine.label}</h3>
                    <div className="profile-game-stats">
                      <span>{t.profilePlayed}: <b>{engine.played}</b></span>
                      <span>{t.homeWins}: <b>{engine.wins}</b></span>
                    </div>
                    <div className="profile-game-bar">
                      <span style={{ width: `${engine.played ? Math.min(100, engine.wins / engine.played * 100) : 0}%` }} />
                    </div>
                  </div>
                  <div className="profile-game-status">{engine.completed ? '✓' : '🔒'}</div>
                </article>
              ))}
            </div>
          </section>

          <section className="profile-section fade-in-up d4">
            <div className="section-heading">
              <div>
                <h2>{t.profileAchievementsTitle}</h2>
                <p className="lede">{t.profileAchievementsLede}</p>
              </div>
              <span className="section-count">{achievementCount}/4</span>
            </div>

            <div className="achievement-grid">
              {achievementSlots.map((achievement, index) => (
                <article key={achievement.id} className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
                  <div className="achievement-icon">{achievement.unlocked ? achievement.icon : '🔒'}</div>
                  <div>
                    <h3>{achievement.title}</h3>
                    <span>{achievement.unlocked ? t.profileUnlocked : t.profileLocked}</span>
                  </div>
                  {achievement.unlocked && <b>✓</b>}
                </article>
              ))}
            </div>
          </section>

          {achievements.length > 4 && (
            <section className="profile-section fade-in-up d4">
              <div className="panel">
                <h2>{t.profileOtherAchievements}</h2>
                <div className="achievement-raw-list">
                  {achievements.slice(4).map((item, i) => {
                    const meta = achievementMeta(item, t);
                    return <span key={`${item}-${i}`}>{meta.icon} {meta.title}</span>;
                  })}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <div className="profile-actions fade-in-up d4">
        <a className="btn glow" href="/premium">💎 Personal Premium</a>
        <a className="btn glow" href="/servers">{t.goToServers}</a>
        {owner && (
          <>
            <a className="btn secondary" href="/owner/blocklist">{t.ownerBlocklistLink}</a>
            <a className="btn secondary" href="/owner/inventory">{t.ownerInventoryLink}</a>
          </>
        )}
      </div>
    </div>
  );
}
