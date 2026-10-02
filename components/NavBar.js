import Link from 'next/link';
import { useLanguage } from '../lib/i18n';
import Notifications from './Notifications';
import ThemeToggle from './ThemeToggle';
import ChatBadge from './ChatBadge';

export default function NavBar({ active }) {
  const { t } = useLanguage();

  const items = [
    { key: 'home', href: '/home', label: t.navHome },
    { key: 'servers', href: '/servers', label: t.navServers },
    { key: 'players', href: '/players', label: t.navPlayers },
    { key: 'friends', href: '/friends', label: t.navFriends },
    { key: 'chat', href: '/chat', label: t.navChat },
    { key: 'store', href: '/store', label: t.navStore },
    { key: 'commands', href: '/commands', label: t.navCommands },
    { key: 'profile', href: '/profile', label: t.navProfile },
    { key: 'premium', href: '/premium', label: '💎 Premium' },
  ];

  // Ask Next.js to prefetch all primary dashboard routes as soon as the nav
  // mounts. This makes the next click feel instant on normal connections.
  // `prefetch` is still set on each Link as a fallback.

  return (
    <nav className="site-nav fade-in-down">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          prefetch
          className={`site-nav-link${active === item.key ? ' active' : ''}`}
        >
          {item.label}
          {item.key === 'chat' && active !== 'chat' && <ChatBadge />}
        </Link>
      ))}
      <div className="nav-tools">
        <Notifications />
        <ThemeToggle />
      </div>
    </nav>
  );
}
