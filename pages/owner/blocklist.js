import { getSession } from '../../lib/session';
import { isOwner } from '../../lib/owner';
import { getAllBlocks } from '../../lib/redis';
import { useLanguage } from '../../lib/i18n';
import LanguageSwitcher from '../../components/LanguageSwitcher';

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
  const { t } = useLanguage();

  return (
    <div className="shell">
      <div className="topline fade-in-down">
        <div className="brand">
          Crossover <span>{t.brandSuffix}</span>
        </div>
        <div className="topline-right">
          <LanguageSwitcher />
          <div className="user-chip">
            <a href="/profile" className="user-link">{user.username}</a>
            <a href="/api/auth/logout">{t.signOut}</a>
          </div>
        </div>
      </div>

      <a href="/servers" className="back-link fade-in-up">← {t.allServers}</a>
      <h1 className="page-title fade-in-up d1">{t.blocklistTitle}</h1>
      <p className="lede fade-in-up d1">{t.blocklistLede}</p>

      {blocks.length === 0 ? (
        <div className="empty fade-in-up d2">{t.noBlocks}</div>
      ) : (
        <table className="board fade-in-up d2">
          <tbody>
            {blocks.map((b, i) => (
              <tr key={`${b.blockerId}-${b.blockedId}`} className="stagger-in" style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}>
                <td className="name">
                  <code>{b.blockerId}</code>
                  <span className="muted-inline"> {t.blocked} </span>
                  {b.blockedUsername ? `@${b.blockedUsername}` : <code>{b.blockedId}</code>}
                </td>
                <td className="wl">{b.at ? new Date(b.at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {total > blocks.length && <div className="hint">{t.blocksTotal(total, blocks.length)}</div>}
    </div>
  );
}
