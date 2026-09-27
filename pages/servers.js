import { getSession } from '../lib/session';
import { fetchManageableMutualGuilds, guildIconUrl } from '../lib/discord';
import { isOwner } from '../lib/owner';

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
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`
    : null;

  return (
    <div className="shell">
      <div className="topline">
        <div className="brand">Crossover <span>Dashboard</span></div>
        <div className="user-chip">
          {avatarUrl && <img src={avatarUrl} alt="" />}
          {user.username}
          <a href="/api/auth/logout">Sign out</a>
        </div>
      </div>

      <h1>Your servers</h1>
      <p className="lede">Servers where you can manage settings and the bot is already a member.</p>

      {showOwnerLinks && (
        <p style={{ marginTop: -20, marginBottom: 32 }}>
          <a href="/owner/blocklist" style={{ fontSize: 13 }}>🔒 Owner: view block list →</a>
        </p>
      )}

      {loadError && <div className="banner error">Couldn&apos;t load your servers: {loadError}</div>}

      {!loadError && guilds.length === 0 && (
        <p className="empty">
          No matching servers found. Either you don&apos;t manage any server the bot is in, or the
          bot hasn&apos;t been invited yet — use <code>!invite</code> in Discord to add it.
        </p>
      )}

      <ul className="guild-list">
        {guilds.map((g) => (
          <li key={g.id}>
            <a href={`/servers/${g.id}`} style={{ textDecoration: 'none' }}>
              <div className="guild-row">
                {g.icon ? <img src={g.icon} alt="" /> : <div className="guild-fallback">{g.name.slice(0, 1)}</div>}
                <div className="name">{g.name}</div>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>Manage →</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
