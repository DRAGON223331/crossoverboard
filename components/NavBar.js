import { useLanguage } from '../lib/i18n';
import Notifications from './Notifications';
import ThemeToggle from './ThemeToggle';

export default function NavBar({ active }) {
  const { t } = useLanguage();

  const items = [
    { key: 'home', href: '/home', label: t.navHome },
    { key: 'servers', href: '/servers', label: t.navServers },
    { key: 'commands', href: '/commands', label: t.navCommands },
    { key: 'profile', href: '/profile', label: t.navProfile },
  ];

  return (
    <nav className="site-nav fade-in-down">
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className={`site-nav-link${active === item.key ? ' active' : ''}`}
        >
          {item.label}
        </a>
      ))}
      <div className="nav-tools">
        <Notifications />
        <ThemeToggle />
      </div>
    </nav>
  );
}
