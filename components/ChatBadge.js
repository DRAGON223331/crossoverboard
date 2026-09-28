import { useEffect, useState } from 'react';

// Small unread counter shown next to "Chat" in the nav bar. Polls a very
// cheap endpoint (one Redis round trip) and only while the tab is visible.
export default function ChatBadge() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let timer;
    let stopped = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch('/api/chat/unread', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (!stopped) setUnread(data.unread || 0);
        }
      } catch {
        // Network hiccup: keep the last known number.
      }
    };
    const loop = async () => {
      await load();
      if (!stopped) timer = window.setTimeout(loop, 15000);
    };
    loop();
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!unread) return null;
  return <span className="nav-badge">{unread > 99 ? '99+' : unread}</span>;
}
