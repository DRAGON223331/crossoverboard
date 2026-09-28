import { useUnread } from './ChatNotifier';

// Small unread counter shown next to "Chat" in the nav bar. It no longer polls
// by itself: the number comes from UnreadProvider (components/ChatNotifier.js),
// the same source the tab title uses.
export default function ChatBadge() {
  const { unread } = useUnread();
  if (!unread) return null;
  return <span className="nav-badge">{unread > 99 ? '99+' : unread}</span>;
}
