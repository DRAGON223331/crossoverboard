import { getSession } from '../lib/session';

const ERROR_MESSAGES = {
  invalid_state: 'That login link expired — try again.',
  login_failed: 'Discord could not verify that login — try again.',
  access_denied: 'Login was cancelled.',
};

export async function getServerSideProps({ req, query }) {
  const session = await getSession(req);
  if (session) return { redirect: { destination: '/servers', permanent: false } };
  return { props: { error: typeof query.error === 'string' ? query.error : null } };
}

export default function Home({ error }) {
  return (
    <div className="shell">
      <div className="topline">
        <div className="brand">Crossover <span>Dashboard</span></div>
      </div>

      {error && <div className="banner error">{ERROR_MESSAGES[error] || 'Something went wrong logging in.'}</div>}

      <div className="hero">
        <h1>Run your servers without typing commands.</h1>
        <p className="lede">
          Sign in with the Discord account that manages your server, and change the prefix, the
          game room, the language and cross-server play from a form instead of `!settings`.
        </p>
        <a className="btn" href="/api/auth/login">Sign in with Discord</a>
      </div>
    </div>
  );
}
