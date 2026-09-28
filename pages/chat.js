import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getSession } from '../lib/session';
import { useLanguage } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavBar from '../components/NavBar';

const THREAD_POLL_MS = 2000; // open conversation
const INBOX_POLL_MS = 6000; // friends list / unread / presence
const TYPING_THROTTLE_MS = 3000;
const MAX_LEN = 1000;

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session) return { redirect: { destination: '/', permanent: false } };
  return { props: { user: session.user } };
}

async function api(path, options) {
  const res = await fetch(`/api/chat/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.code = data.code;
    throw err;
  }
  return data;
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function Avatar({ name, src, online, size = 42 }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="chat-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        letter
      )}
      {online !== undefined && <span className={`chat-presence${online ? ' on' : ''}`} />}
    </span>
  );
}

export default function Chat({ user }) {
  const { t, lang } = useLanguage();
  const router = useRouter();

  const [friends, setFriends] = useState(null); // null = still loading
  const [filter, setFilter] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [peer, setPeer] = useState({ online: false, typing: false, readUpTo: 0 });
  const [peerProfile, setPeerProfile] = useState(null); // used when the friend isn't in the list yet (deep link)
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [loadingThread, setLoadingThread] = useState(false);

  const activeRef = useRef(null);
  const lastIdRef = useRef(0);
  const listRef = useRef(null);
  const stickRef = useRef(true); // keep scrolled to the bottom unless the reader scrolled up
  const typingSentRef = useRef(0);
  const inputRef = useRef(null);

  const active = useMemo(() => friends?.find((f) => f.id === activeId) || null, [friends, activeId]);

  // ── Friends list (poll) ────────────────────────────────────────────────
  const loadInbox = useCallback(async () => {
    try {
      const data = await api('inbox');
      setFriends(data.friends);
    } catch {
      setFriends((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    let timer;
    let stopped = false;
    const tick = async () => {
      if (!document.hidden) await loadInbox();
      if (!stopped) timer = window.setTimeout(tick, INBOX_POLL_MS);
    };
    tick();
    const onVisible = () => { if (!document.hidden) loadInbox(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadInbox]);

  // Deep link: /chat?with=<friendId>
  useEffect(() => {
    if (router.isReady && typeof router.query.with === 'string') setActiveId(router.query.with);
  }, [router.isReady, router.query.with]);

  // ── Open conversation (poll) ───────────────────────────────────────────
  const mergeMessages = useCallback((incoming) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const byId = new Map();
      // Keep pending / failed local messages that the server has not confirmed yet.
      const confirmedCids = new Set(incoming.map((m) => m.cid).filter(Boolean));
      for (const m of prev) {
        if (m.pending && confirmedCids.has(m.cid)) continue;
        byId.set(m.pending ? `p:${m.cid}` : m.id, m);
      }
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => (a.at - b.at) || ((a.id || Infinity) - (b.id || Infinity)));
    });
    const maxId = Math.max(...incoming.map((m) => m.id));
    if (maxId > lastIdRef.current) lastIdRef.current = maxId;
  }, []);

  useEffect(() => {
    activeRef.current = activeId;
    lastIdRef.current = 0;
    stickRef.current = true;
    setMessages([]);
    setPeer({ online: false, typing: false, readUpTo: 0 });
    setPeerProfile(null);
    setError(null);
    if (!activeId) return undefined;

    let timer;
    let stopped = false;
    setLoadingThread(true);

    const poll = async () => {
      if (document.hidden) return;
      try {
        const data = await api(`thread?friendId=${encodeURIComponent(activeId)}&after=${lastIdRef.current}`);
        if (stopped || activeRef.current !== activeId) return;
        if (data.profile) setPeerProfile(data.profile);
        mergeMessages(data.messages);
        setPeer({ online: data.online, typing: data.typing, readUpTo: data.friendReadUpTo });
        setError((e) => (e && e.sticky ? e : null));
        // A poll that returned new messages also cleared the unread badge server-side.
        if (data.messages.length) setFriends((prev) => prev?.map((f) => (f.id === activeId ? { ...f, unread: 0 } : f)) ?? prev);
      } catch (err) {
        if (!stopped) setError({ text: err.message, sticky: err.code === 'NOT_FRIENDS' || err.code === 'BLOCKED' });
      } finally {
        if (!stopped) setLoadingThread(false);
      }
    };

    const loop = async () => {
      await poll();
      if (!stopped) timer = window.setTimeout(loop, THREAD_POLL_MS);
    };
    loop();
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeId, mergeMessages]);

  // Grow the input with its content (up to ~6 lines), shrink again after sending.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft, activeId]);

  // ── Scrolling ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, peer.typing]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  // ── Sending ────────────────────────────────────────────────────────────
  async function deliver(local) {
    try {
      const { message } = await api('send', {
        method: 'POST',
        body: JSON.stringify({ friendId: local.to, text: local.text, clientId: local.cid }),
      });
      if (activeRef.current === local.to) {
        setMessages((prev) => {
          const without = prev.filter((m) => !(m.pending && m.cid === local.cid) && m.id !== message.id);
          return [...without, message].sort((a, b) => (a.at - b.at) || ((a.id || Infinity) - (b.id || Infinity)));
        });
        if (message.id > lastIdRef.current) lastIdRef.current = message.id;
      }
      setFriends((prev) => prev?.map((f) => (f.id === local.to ? { ...f, last: { text: message.text.slice(0, 80), from: user.id, at: message.at } } : f)) ?? prev);
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.pending && m.cid === local.cid ? { ...m, failed: true, failText: err.message } : m)));
    }
  }

  function send() {
    const text = draft.trim();
    if (!text || !activeId) return;
    if (text.length > MAX_LEN) return;
    const local = {
      id: null,
      cid: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      from: user.id,
      to: activeId,
      text,
      at: Date.now(),
      pending: true,
    };
    setMessages((prev) => [...prev, local]);
    setDraft('');
    stickRef.current = true;
    deliver(local);
    inputRef.current?.focus();
  }

  function retry(local) {
    setMessages((prev) => prev.map((m) => (m.cid === local.cid ? { ...m, failed: false } : m)));
    deliver(local);
  }

  function onDraftChange(value) {
    setDraft(value);
    const now = Date.now();
    if (value.trim() && activeId && now - typingSentRef.current > TYPING_THROTTLE_MS) {
      typingSentRef.current = now;
      api('typing', { method: 'POST', body: JSON.stringify({ friendId: activeId }) }).catch(() => {});
    }
  }

  function onKeyDown(e) {
    // Enter sends, Shift+Enter adds a new line. Ignore Enter while an IME is composing (Arabic/CJK keyboards).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  async function clearChat() {
    if (!activeId || !window.confirm(t.chatClearConfirm)) return;
    try {
      await api('clear', { method: 'POST', body: JSON.stringify({ friendId: activeId }) });
      setMessages([]);
      lastIdRef.current = 0;
      loadInbox();
    } catch (err) {
      setError({ text: err.message });
    }
  }

  function openFriend(id) {
    setActiveId(id);
    router.replace({ pathname: '/chat', query: { with: id } }, undefined, { shallow: true });
  }

  function closeThread() {
    setActiveId(null);
    router.replace('/chat', undefined, { shallow: true });
    loadInbox();
  }

  // ── Derived view data ──────────────────────────────────────────────────
  const shownFriends = useMemo(() => {
    if (!friends) return [];
    const q = filter.trim().toLowerCase();
    return q ? friends.filter((f) => `${f.name || ''} ${f.username || ''}`.toLowerCase().includes(q)) : friends;
  }, [friends, filter]);

  const timeFmt = useMemo(() => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' }), [lang]);
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), [lang]);

  function dayLabel(ts) {
    const today = dayKey(Date.now());
    const yesterday = dayKey(Date.now() - 86400000);
    const k = dayKey(ts);
    if (k === today) return t.chatToday;
    if (k === yesterday) return t.chatYesterday;
    return dateFmt.format(ts);
  }

  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].from === user.id && !messages[i].pending) return messages[i].id;
    return null;
  }, [messages, user.id]);

  const rows = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    if (!prev || dayKey(prev.at) !== dayKey(m.at)) rows.push({ type: 'day', key: `d${m.at}`, label: dayLabel(m.at) });
    const grouped = prev && prev.from === m.from && dayKey(prev.at) === dayKey(m.at) && m.at - prev.at < 5 * 60 * 1000;
    rows.push({ type: 'msg', key: m.id ?? `p${m.cid}`, m, grouped });
  });

  const totalUnread = (friends || []).reduce((n, f) => n + (f.id === activeId ? 0 : (f.unread || 0)), 0);
  const peerName = active?.name || peerProfile?.name || active?.username || t.chatUnknown;
  const peerAvatar = active?.avatar || peerProfile?.avatar || null;

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

      <NavBar active="chat" />
      <h1 className="page-title fade-in-up d1">{t.chatTitle}</h1>
      <p className="lede fade-in-up d1">{t.chatLede}</p>

      <div className={`chat-app fade-in-up d2${activeId ? ' has-thread' : ''}`}>
        {/* ── Friends ── */}
        <aside className="chat-side" aria-label={t.chatFriends}>
          <div className="chat-side-head">
            <input
              type="text"
              className="chat-search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t.chatSearch}
              aria-label={t.chatSearch}
            />
            {totalUnread > 0 && <span className="chat-badge" title={t.chatUnread}>{totalUnread}</span>}
          </div>

          <div className="chat-friends">
            {friends === null && <div className="chat-note">{t.chatLoading}</div>}

            {friends !== null && friends.length === 0 && (
              <div className="chat-note">
                {t.chatNoFriends}
                <Link href="/friends" className="btn secondary" style={{ marginTop: 12 }}>{t.chatFindFriends}</Link>
              </div>
            )}

            {friends !== null && friends.length > 0 && shownFriends.length === 0 && <div className="chat-note">{t.chatNoMatch}</div>}

            {shownFriends.map((f) => (
              <button
                type="button"
                key={f.id}
                className={`chat-friend${f.id === activeId ? ' active' : ''}`}
                onClick={() => openFriend(f.id)}
              >
                <Avatar name={f.name} src={f.avatar} online={f.online} />
                <span className="chat-friend-body">
                  <span className="chat-friend-top">
                    <strong>{f.name || f.username || t.chatUnknown}</strong>
                    {f.last && <time>{timeFmt.format(f.last.at)}</time>}
                  </span>
                  <span className="chat-friend-preview">
                    {f.last
                      ? `${f.last.from === user.id ? `${t.chatYou}: ` : ''}${f.last.text}`
                      : (f.online ? t.chatOnline : t.chatOffline)}
                  </span>
                </span>
                {f.unread > 0 && f.id !== activeId && <span className="chat-badge">{f.unread > 99 ? '99+' : f.unread}</span>}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Conversation ── */}
        <section className="chat-main" aria-live="off">
          {!activeId && (
            <div className="chat-empty">
              <div className="chat-empty-icon" aria-hidden="true">💬</div>
              <p>{t.chatPick}</p>
            </div>
          )}

          {activeId && (
            <>
              <header className="chat-head">
                <button type="button" className="icon-btn chat-back" onClick={closeThread} aria-label={t.chatBack}>←</button>
                <Avatar name={peerName} src={peerAvatar} online={peer.online} size={40} />
                <div className="chat-head-body">
                  <strong>{peerName}</strong>
                  {(active?.username || peerProfile?.username) && (active?.username || peerProfile?.username) !== peerName && (
                    <span className="chat-handle">@{active?.username || peerProfile?.username}</span>
                  )}
                  <span className={`chat-status${peer.online ? ' on' : ''}`}>
                    {peer.typing ? t.chatTyping : peer.online ? t.chatOnline : t.chatOffline}
                  </span>
                </div>
                <button type="button" className="icon-btn" onClick={clearChat} title={t.chatClear} aria-label={t.chatClear}>🗑️</button>
              </header>

              <div className="chat-scroll" ref={listRef} onScroll={onScroll}>
                {loadingThread && messages.length === 0 && <div className="chat-note">{t.chatLoading}</div>}
                {!loadingThread && messages.length === 0 && !error && (
                  <div className="chat-note">{t.chatEmptyThread(peerName)}</div>
                )}

                {rows.map((row) => {
                  if (row.type === 'day') return <div className="chat-day" key={row.key}><span>{row.label}</span></div>;
                  const { m, grouped } = row;
                  const mine = m.from === user.id;
                  const seen = mine && m.id != null && m.id === lastMineId && m.id <= peer.readUpTo;
                  return (
                    <div className={`chat-row ${mine ? 'mine' : 'theirs'}${grouped ? ' grouped' : ''}`} key={row.key}>
                      {!mine && (
                        <div className="chat-side-avatar">
                          {!grouped && <Avatar name={peerName} src={peerAvatar} size={30} />}
                        </div>
                      )}
                      <div className="chat-col">
                        {!mine && !grouped && <span className="chat-author">{peerName}</span>}
                        <div className={`chat-bubble${m.pending ? ' pending' : ''}${m.failed ? ' failed' : ''}`} dir="auto">
                          {m.text}
                        </div>
                        {!grouped || m.failed || seen ? (
                          <div className="chat-meta">
                            <time>{timeFmt.format(m.at)}</time>
                            {mine && m.pending && !m.failed && <span>{t.chatSending}</span>}
                            {mine && !m.pending && <span className={seen ? 'seen' : ''}>{seen ? `✓✓ ${t.chatSeen}` : '✓'}</span>}
                            {m.failed && (
                              <button type="button" className="chat-retry" onClick={() => retry(m)}>
                                {m.failText || t.chatFailed} · {t.chatRetry}
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {peer.typing && (
                  <div className="chat-row theirs">
                    <div className="chat-side-avatar"><Avatar name={peerName} src={peerAvatar} size={30} /></div>
                    <div className="chat-col"><div className="chat-bubble typing" aria-label={t.chatTyping}><i /><i /><i /></div></div>
                  </div>
                )}
              </div>

              {error && <div className="banner error chat-error">{error.text}</div>}

              <div className="chat-compose">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  maxLength={MAX_LEN}
                  dir="auto"
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t.chatPlaceholder}
                  disabled={error?.sticky}
                  aria-label={t.chatPlaceholder}
                />
                <button type="button" className="btn glow" onClick={send} disabled={!draft.trim() || error?.sticky}>
                  {t.chatSend}
                </button>
              </div>
              {draft.length > MAX_LEN - 150 && <div className="chat-count">{MAX_LEN - draft.length}</div>}
            </>
          )}
        </section>
      </div>

      <p className="players-hint">{t.chatFootnote}</p>
    </div>
  );
}
