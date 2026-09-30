import { getSession } from '../../../lib/session';
import { userCanManageGuild, fetchUserGuilds } from '../../../lib/discord';
import { getGuildStats, getGuildLeaderboard } from '../../../lib/redis';
import { useLanguage } from '../../../lib/i18n';
import LanguageSwitcher from '../../../components/LanguageSwitcher';

export async function getServerSideProps({ req, params }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };

  const { guildId } = params;
  const allowed = await userCanManageGuild(session.accessToken, guildId);
  if (!allowed) return { redirect: { destination: '/servers', permanent: false } };

  const [userGuilds, stats, leaderboard] = await Promise.all([
    fetchUserGuilds(session.accessToken),
    getGuildStats(guildId),
    getGuildLeaderboard(guildId),
  ]);
  const guild = userGuilds.find((g) => g.id === guildId);

  return {
    props: {
      user: session.user,
      guildId,
      guildName: guild?.name || 'This server',
      stats,
      leaderboard,
    },
  };
}

export default function GuildLeaderboard({ user, guildId, guildName, stats, leaderboard }) {
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
          <div className="user-chip">
            <a href="/profile" className="user-link">{user.username}</a>
            <a href="/api/auth/logout">{t.signOut}</a>
          </div>
        </div>
      </div>

      <a href="/servers" className="back-link fade-in-up">← {t.allServers}</a>
      <h1 className="page-title fade-in-up d1">{guildName}</h1>
      <p className="lede fade-in-up d1">{t.changesLive}</p>

      <div className="guild-layout fade-in-up d2">
        <nav className="guild-sidebar">
          <a className="tab" href={`/servers/${guildId}`}>⚙️ {t.tabManage}</a>
          <span className="tab active">🏆 {t.tabLeaderboard}</span>
          <a className="tab" href={`/servers/${guildId}/premium`}>💎 {t.tabPremium}</a>
        </nav>

        <div className="guild-content">
          <div className="stats-row">
            <div className="stat-box">
              <div className="stat-num">{stats.today}</div>
              <div className="stat-label">{t.gamesToday}</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">{stats.last7Days}</div>
              <div className="stat-label">{t.last7Days}</div>
            </div>
          </div>

          <div className="panel">
            <label className="field-label-standalone">{t.leaderboard}</label>
            {leaderboard.rows.length === 0 ? (
              <div className="empty">{t.noScores}</div>
            ) : (
              <table className="board">
                <tbody>
                  {leaderboard.rows.map((row, i) => (
                    <tr key={row.userId} className="stagger-in" style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}>
                      <td className="rank">{i + 1}</td>
                      <td className="name">{row.name}</td>
                      <td className="pts">{row.points} pts</td>
                      <td className="wl">{row.w}W/{row.l}L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {leaderboard.total > leaderboard.rows.length && (
              <div className="hint">{t.rankedTotal(leaderboard.total, leaderboard.rows.length)}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
