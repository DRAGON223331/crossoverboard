import { getSession } from '../lib/session';
import { fetchManageableMutualGuilds, guildIconUrl, fetchBotStatus } from '../lib/discord';
import { getUserProfile } from '../lib/redis';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';
import AccountMenu from '../components/AccountMenu';
import BotStatusCard from '../components/BotStatusCard';

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };

  let guilds = [];
  let profile = null;
  let botStatus = null;
  try {
    [guilds, profile, botStatus] = await Promise.all([
      fetchManageableMutualGuilds(session.accessToken),
      getUserProfile(session.user.id),
      fetchBotStatus(),
    ]);
  } catch {
    // Keep the home page useful even if one remote source is temporarily down.
    try { guilds = await fetchManageableMutualGuilds(session.accessToken); } catch {}
    try { profile = await getUserProfile(session.user.id); } catch {}
    try { botStatus = await fetchBotStatus(); } catch {}
  }

  return {
    props: {
      user: session.user,
      profile,
      botStatus,
      guilds: guilds.map((g) => ({ id: g.id, name: g.name, icon: guildIconUrl(g) })),
    },
  };
}

export default function Home({ user, profile, guilds, botStatus }) {
  const { t } = useLanguage();
  const engines = profile?.engines || [
    { key: 'xo', label: 'Tic Tac Toe', icon: '⭕❌', played: 0, wins: 0, completed: false },
    { key: 'connect4', label: 'Connect 4', icon: '🔴🟡', played: 0, wins: 0, completed: false },
    { key: 'memory', label: 'Memory Match', icon: '🃏', played: 0, wins: 0, completed: false },
    { key: 'rps', label: 'Rock Paper Scissors', icon: '🪨📄✂️', played: 0, wins: 0, completed: false },
    { key: 'fast', label: 'Fastest Click', icon: '⚡', played: 0, wins: 0, completed: false },
    { key: 'flag', label: 'Guess the Flag', icon: '🌍', played: 0, wins: 0, completed: false },
    { key: 'trivia', label: 'Trivia', icon: '🧠', played: 0, wins: 0, completed: false },
    { key: 'word', label: 'Guess the Word', icon: '🔤', played: 0, wins: 0, completed: false },
    { key: 'math', label: 'Math Race', icon: '🧮', played: 0, wins: 0, completed: false },
    { key: 'mafia', label: 'Mafia', icon: '🕵️', played: 0, wins: 0, completed: false },
    { key: 'chairs', label: 'Musical Chairs', icon: '🪑', played: 0, wins: 0, completed: false },
  ];
  const playedCount = engines.filter((e) => e.completed).length;
  const totalGames = (profile?.w || 0) + (profile?.l || 0) + (profile?.d || 0);

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

      <NavBar active="home" />

      <BotStatusCard status={botStatus} />

      <section className="home-hero fade-in-up">
        <div>
          <p className="kicker">{t.homeGreeting(user.username)}</p>
          <h1>{t.homeLede}</h1>
          <div className="hero-actions">
            <a className="btn glow" href="/profile">{t.homeViewProfile}</a>
            <a className="btn secondary" href="/commands">{t.homeExploreCommands}</a>
          </div>
        </div>
        <div className="home-level-card">
          <div className="home-level-top">
            <span>{t.homeLevel}</span>
            <strong>{profile?.level ?? 1}<small>/100</small></strong>
          </div>
          <div className="level-track">
            <span style={{ width: `${Math.min(100, ((profile?.level ?? 1) / 100) * 100)}%` }} />
          </div>
          <div className="home-level-meta">
            <span>{profile?.points ?? 0} {t.homePoints}</span>
            <span>{t.homeProgress(playedCount, engines.length)}</span>
          </div>
        </div>
      </section>

      <div className="stats-row home-stats fade-in-up d1">
        <div className="stat-box"><div className="stat-num">{profile?.points ?? 0}</div><div className="stat-label">{t.homePoints}</div></div>
        <div className="stat-box"><div className="stat-num">{profile ? `${profile.w}/${profile.l}` : '0/0'}</div><div className="stat-label">{t.homeRecord}</div></div>
        <div className="stat-box"><div className="stat-num">{profile?.best ?? 0}</div><div className="stat-label">{t.homeStreak}</div></div>
        <div className="stat-box"><div className="stat-num">{profile?.achievements?.length ?? 0}/4</div><div className="stat-label">{t.homeAchievements}</div></div>
      </div>

      <section className="home-section fade-in-up d2">
        <div className="section-heading">
          <div>
            <h2>{t.homeEnginesTitle}</h2>
            <p className="lede">{t.homeEnginesLede}</p>
          </div>
          <span className="section-count">{playedCount}/{engines.length}</span>
        </div>
        <div className="engine-grid">
          {engines.map((engine) => (
            <div key={engine.key} className={`engine-card ${engine.completed ? 'done' : 'todo'}`}>
              <div className="engine-icon">{engine.icon}</div>
              <div className="engine-body">
                <div className="engine-name">{engine.label}</div>
                <div className="engine-meta">
                  {engine.completed ? `${t.homePlayed} · ${engine.played} · ${engine.wins} ${t.homeWins}` : t.homeNotPlayedTag}
                </div>
              </div>
              <span className="engine-state">{engine.completed ? '✓' : '○'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section fade-in-up d3">
        <div className="section-heading">
          <div>
            <h2>{t.homeServersTitle}</h2>
            <p className="lede">{t.homeServersLede}</p>
          </div>
          <a href="/servers" className="btn secondary">{t.homeViewAllServers}</a>
        </div>
        {guilds.length === 0 ? (
          <p className="empty">{t.homeNoServers}</p>
        ) : (
          <div className="server-grid">
            {guilds.slice(0, 6).map((g) => (
              <a key={g.id} href={`/servers/${g.id}`} className="server-card">
                {g.icon ? <img src={g.icon} alt="" /> : <div className="guild-fallback">{g.name.slice(0, 1)}</div>}
                <div className="name">{g.name}</div>
                <span className="manage-tag">{t.manage} →</span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
