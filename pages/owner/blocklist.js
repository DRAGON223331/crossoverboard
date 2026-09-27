import { getSession } from '../../lib/session';
import { isOwner } from '../../lib/owner';
import { getAllBlocks } from '../../lib/redis';

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };
  // Not an admin-permissions check like the guild pages — this is data with
  // no server to be an admin of, so it's gated to the bot owner specifically.
  if (!isOwner(session)) return { redirect: { destination: '/servers', permanent: false } };

  const { rows, total } = await getAllBlocks();

  return {
    props: {
      user: session.user,
      blocks: rows,
      total,
    },
  };
}

export default function OwnerBlocklist({ user, blocks, total }) {
  return (
    <div className="shell">
      <div className="topline">
        <div className="brand">Crossover <span>Dashboard</span></div>
        <div className="user-chip">
          {user.username}
          <a href="/api/auth/logout">Sign out</a>
        </div>
      </div>

      <a href="/servers" style={{ fontSize: 16, color: 'var(--muted)' }}>← All servers</a>
      <h1 style={{ marginTop: 12 }}>Block list</h1>
      <p className="lede">
        Every personal block currently in effect, across every server — read-only. A block isn&apos;t
        tied to any one server, so this lives here instead of on a server&apos;s own settings page.
      </p>

      {blocks.length === 0 ? (
        <div className="empty">No one has blocked anyone yet.</div>
      ) : (
        <table className="board">
          <tbody>
            {blocks.map((b) => (
              <tr key={`${b.blockerId}-${b.blockedId}`}>
                <td className="name">
                  <code>{b.blockerId}</code>
                  <span style={{ color: 'var(--muted)' }}> blocked </span>
                  {b.blockedUsername ? `@${b.blockedUsername}` : <code>{b.blockedId}</code>}
                </td>
                <td className="wl">{b.at ? new Date(b.at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {total > blocks.length && (
        <div className="hint">{total} blocks total — showing the most recent {blocks.length}.</div>
      )}
    </div>
  );
}
