import { useMemo, useState } from 'react';
import { getSession } from '../lib/session';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';
import AccountMenu from '../components/AccountMenu';

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  return { props: { user: session?.user ?? null } };
}

const GAME_DATA = [
  { key: 'xo', icon: '⭕❌', name: 'Tic Tac Toe', ar: 'إكس أو', players: '2', category: 'classic', command: '!play xo', description: 'Classic 1v1 X/O with your Crossover skins.' },
  { key: 'connect4', icon: '🔴🟡', name: 'Connect 4', ar: 'كونكت 4', players: '2', category: 'classic', command: '!play connect4', description: 'Drop discs, make four in a row and win the match.' },
  { key: 'memory', icon: '🃏', name: 'Memory Match', ar: 'تطابق الذاكرة', players: '2+', category: 'party', command: '!play memory', description: 'Flip cards, remember positions and find the matching pairs.' },
  { key: 'rps', icon: '🪨📄✂️', name: 'Rock Paper Scissors', ar: 'حجر ورق مقص', players: '2', category: 'classic', command: '!play rps', description: 'A quick head-to-head round of Rock, Paper, Scissors.' },
  { key: 'fast', icon: '⚡', name: 'Fastest Click', ar: 'أسرع ضغطة', players: '2+', category: 'party', command: '!play fast', description: 'React first when the signal appears and beat everyone.' },
  { key: 'flag', icon: '🌍', name: 'Guess the Flag', ar: 'خمن العلم', players: '1+', category: 'quiz', command: '!play flag', description: 'Test your geography knowledge by identifying flags.' },
  { key: 'trivia', icon: '🧠', name: 'Trivia', ar: 'معلومات عامة', players: '1+', category: 'quiz', command: '!play trivia', description: 'Answer questions quickly and build your score.' },
  { key: 'word', icon: '🔤', name: 'Guess the Word', ar: 'خمن الكلمة', players: '1+', category: 'quiz', command: '!play word', description: 'Use clues and letters to reveal the hidden word.' },
  { key: 'math', icon: '🧮', name: 'Math Race', ar: 'سباق الحساب', players: '2+', category: 'quiz', command: '!play math', description: 'Solve the equation before the other players do.' },
  { key: 'mafia', icon: '🕵️', name: 'Mafia', ar: 'مافيا', players: '2–100', category: 'party', command: '!play mafia', premium: true, description: 'A large social-deduction game with configurable player limits.' },
  { key: 'chairs', icon: '🪑', name: 'Musical Chairs', ar: 'الكراسي الموسيقية', players: '2–100', category: 'party', command: '!play chairs', premium: true, description: 'A fast elimination party game built for bigger groups.' },
];

const CATEGORIES = [
  ['all', 'All games', 'كل الألعاب'],
  ['classic', 'Classic', 'كلاسيك'],
  ['party', 'Party', 'حفلات'],
  ['quiz', 'Quiz', 'أسئلة'],
];

export default function Games({ user }) {
  const { t, lang } = useLanguage();
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');

  const games = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GAME_DATA.filter((game) => {
      const categoryMatch = category === 'all' || game.category === category;
      const text = `${game.name} ${game.ar} ${game.command}`.toLowerCase();
      return categoryMatch && (!q || text.includes(q));
    });
  }, [category, query]);

  async function copyCommand(command, key) {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1400);
    } catch {
      // Clipboard can be unavailable in some browsers; the command remains visible.
    }
  }

  const isAr = lang === 'ar';

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
          {user ? <AccountMenu user={user} /> : <a className="btn secondary" href="/api/auth/login">{t.signIn}</a>}
        </div>
      </div>

      <NavBar active="games" />

      <section className="games-hero fade-in-up d1">
        <div>
          <div className="kicker">🎮 {isAr ? 'Crossover Gaming' : 'Crossover Gaming'}</div>
          <h1>{isAr ? 'مركز الألعاب' : 'Game Center'}</h1>
          <p className="lede">{isAr ? 'كل ألعاب Crossover في مكان واحد. اختار لعبة، شوف عدد اللاعبين، وانسخ الأمر وشغّلها من ديسكورد.' : 'Every Crossover game in one place. Pick a game, see the player count, then copy its command and start playing in Discord.'}</p>
        </div>
        <div className="games-hero-stat">
          <strong>{GAME_DATA.length}</strong>
          <span>{isAr ? 'لعبة متاحة' : 'games available'}</span>
        </div>
      </section>

      <section className="games-toolbar fade-in-up d2">
        <div className="game-filters">
          {CATEGORIES.map(([key, en, ar]) => (
            <button key={key} type="button" className={`chip ${category === key ? 'active' : ''}`} onClick={() => setCategory(key)}>
              {isAr ? ar : en}
            </button>
          ))}
        </div>
        <label className="game-search">
          <span>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isAr ? 'ابحث عن لعبة…' : 'Search games…'} />
        </label>
      </section>

      <section className="game-center-grid fade-in-up d3">
        {games.map((game) => (
          <article key={game.key} className={`game-center-card ${game.premium ? 'premium-game' : ''}`}>
            <div className="game-card-top">
              <div className="game-big-icon">{game.icon}</div>
              {game.premium && <span className="game-premium-badge">💎 Premium</span>}
            </div>
            <div className="game-card-copy">
              <h2>{isAr ? game.ar : game.name}</h2>
              <p>{isAr ? `${game.description === 'Classic 1v1 X/O with your Crossover skins.' ? 'لعبة إكس أو كلاسيكية للاعبين مع أشكال Crossover.' : game.description}` : game.description}</p>
            </div>
            <div className="game-card-meta">
              <span>👥 {game.players}</span>
              <code>{game.command}</code>
            </div>
            <div className="game-card-actions">
              <button type="button" className="btn glow" onClick={() => copyCommand(game.command, game.key)}>
                {copied === game.key ? (isAr ? '✓ اتنسخ' : '✓ Copied') : (isAr ? 'نسخ الأمر' : 'Copy command')}
              </button>
              <a className="btn secondary" href="/commands">{isAr ? 'التفاصيل' : 'Details'}</a>
            </div>
          </article>
        ))}
      </section>

      {games.length === 0 && (
        <div className="empty game-empty">{isAr ? 'مفيش ألعاب مطابقة للبحث ده.' : 'No games match your search.'}</div>
      )}

      <section className="game-center-tip fade-in-up d4">
        <div className="tip-icon">💡</div>
        <div>
          <strong>{isAr ? 'جاهز للعب؟' : 'Ready to play?'}</strong>
          <p>{isAr ? 'شغّل Crossover في سيرفرك، افتح روم اللعب، واستخدم الأمر اللي ظاهر على كارت اللعبة.' : 'Open Crossover in your server, use the game room, and run the command shown on the game card.'}</p>
        </div>
        <a className="btn secondary" href="/servers">{isAr ? 'إدارة السيرفرات' : 'Manage servers'}</a>
      </section>
    </div>
  );
}
